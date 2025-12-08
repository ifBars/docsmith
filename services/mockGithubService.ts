import { FileSummary, RepoData } from '../types';

const GITHUB_API_BASE = 'https://api.github.com/repos';

// Fallback list if tree fetch fails
const COMMON_FILES = [
  'README.md', 'README.txt', 'readme.md',
  'CONTRIBUTING.md', 'contributing.md',
  'package.json', 
  'tsconfig.json',
  'pyproject.toml', 'requirements.txt',
  'go.mod', 
  'Cargo.toml', 
  'Dockerfile',
  'docker-compose.yml',
  'src/index.ts', 'src/main.ts',
  'app/page.tsx',
  'main.go', 'main.py'
];

const getRawUrl = (owner: string, repo: string, branch: string, path: string) => 
  `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${path}`;

export const fetchRepoData = async (url: string): Promise<RepoData> => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL. Format should be https://github.com/owner/repo');
  }
  const [, owner, repo] = match;

  let defaultBranch = 'main';
  try {
    const metaRes = await fetch(`${GITHUB_API_BASE}/${owner}/${repo}`);
    if (metaRes.ok) {
      const meta = await metaRes.json();
      defaultBranch = meta.default_branch || 'main';
    }
  } catch (e) {
    console.warn('Failed to fetch repo metadata, defaulting to main branch.', e);
  }

  let filesToFetch: string[] = [];
  
  try {
    // Recursive tree fetch to find the best files
    const treeRes = await fetch(`${GITHUB_API_BASE}/${owner}/${repo}/git/trees/${defaultBranch}?recursive=1`);
    if (treeRes.ok) {
      const treeData = await treeRes.json();
      if (treeData.tree && Array.isArray(treeData.tree)) {
        const allFiles = treeData.tree
          .filter((node: any) => node.type === 'blob')
          .map((node: any) => node.path);
        filesToFetch = selectRelevantFiles(allFiles);
      } else {
        filesToFetch = COMMON_FILES;
      }
    } else {
      filesToFetch = COMMON_FILES;
    }
  } catch (e) {
    console.warn('Tree fetch failed', e);
    filesToFetch = COMMON_FILES;
  }

  const files: FileSummary[] = [];
  // Use batched fetching to avoid overwhelming the browser/network while maintaining speed
  const BATCH_SIZE = 6; 

  for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
      const batch = filesToFetch.slice(i, i + BATCH_SIZE);
      const promises = batch.map(path => fetchFileContent(owner, repo, defaultBranch, path));
      const results = await Promise.all(promises);
      results.forEach(f => {
          if (f) files.push(f);
      });
  }

  if (files.length === 0) {
    throw new Error('Could not fetch any readable files from this repository.');
  }

  return { url, files };
};

async function fetchFileContent(owner: string, repo: string, branch: string, path: string): Promise<FileSummary | null> {
    try {
      const res = await fetch(getRawUrl(owner, repo, branch, path));
      if (!res.ok) return null;
      
      const text = await res.text();
      // Binary check
      if (text.includes('\u0000')) return null;

      // Limit individual file size to avoid blowing up memory/token limits with a single massive log file
      // 300KB is generous for code files; anything larger is likely not optimal for LLM context anyway
      if (text.length > 300000) {
         return null;
      }

      return {
        path,
        contentSnippet: text // Full text up to limit
      };
    } catch (e) {
      return null;
    }
}

function selectRelevantFiles(allPaths: string[]): string[] {
  // Intelligent filtering to maximize context quality
  const scored = allPaths.map(p => {
    let score = 0;
    const lower = p.toLowerCase();
    
    // 1. Documentation is highest priority (Context for current state)
    if (lower.includes('docs/') && (lower.endsWith('.md') || lower.endsWith('.mdx'))) score += 100;
    if (lower === 'readme.md') score += 100;
    if (lower.includes('contributing')) score += 80;
    if (lower.endsWith('.md')) score += 50;
    
    // 2. Configuration defines the framework & architecture
    if (lower.endsWith('package.json') || lower.endsWith('go.mod') || lower.endsWith('cargo.toml') || lower.endsWith('pom.xml')) score += 90;
    if (lower.includes('tsconfig') || lower.includes('vite.config') || lower.includes('next.config') || lower.includes('webpack')) score += 70;
    if (lower.includes('dockerfile') || lower.includes('docker-compose')) score += 60;
    
    // 3. Source Code Entry Points & Structure
    if (lower.match(/(src|app|lib)\/.*(index|main|server|app)\.(ts|js|go|py|rs|java|c|cpp)/)) score += 60;
    if (lower.match(/app\/page\.(tsx|jsx)/)) score += 60;
    
    // 4. Core Logic & Definitions
    if (lower.includes('types') || lower.includes('interface') || lower.includes('schema') || lower.includes('models')) score += 50;
    if (lower.includes('api/') || lower.includes('services/') || lower.includes('utils/') || lower.includes('lib/')) score += 40;
    if (lower.includes('components/')) score += 30; // UI Components
    if (lower.includes('hooks/')) score += 30;

    // 5. Negatives (Noise Reduction)
    if (lower.includes('node_modules')) score -= 1000;
    if (lower.includes('.git/')) score -= 1000;
    if (lower.includes('dist/') || lower.includes('build/') || lower.includes('.next/') || lower.includes('out/')) score -= 1000;
    if (lower.includes('coverage/')) score -= 1000;
    
    // Deprioritize tests slightly - we want them, but not at the expense of core logic if we hit limits
    if (lower.includes('__tests__/') || lower.includes('.test.') || lower.includes('.spec.')) score -= 20; 
    
    if (lower.endsWith('.lock') || lower.endsWith('-lock.json')) score -= 50;
    if (lower.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot|mp4|webm|mp3|wav|zip|tar|gz|map)$/)) score -= 1000;
    if (lower.endsWith('.min.js') || lower.endsWith('.min.css')) score -= 1000;

    return { path: p, score };
  });

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);

  // Expanded limit for Gemini 3 Pro (Large Context)
  // We can comfortably handle ~100-150 files to get a very complete picture of the repo.
  return scored.filter(s => s.score > 0).slice(0, 120).map(s => s.path);
}