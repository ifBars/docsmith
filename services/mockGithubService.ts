
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

  const fetchFile = async (path: string): Promise<FileSummary | null> => {
    try {
      const res = await fetch(getRawUrl(owner, repo, defaultBranch, path));
      if (!res.ok) return null;
      
      const text = await res.text();
      // Binary check
      if (text.includes('\u0000')) return null;

      // Skip huge lock files or minified code if they slip through
      if (text.length > 150000) return null;

      return {
        path,
        // Increase context limit for Gemini 3 Pro
        contentSnippet: text.slice(0, 45000) 
      };
    } catch (e) {
      return null;
    }
  };

  const results = await Promise.all(filesToFetch.map(fetchFile));
  const files = results.filter((f): f is FileSummary => f !== null);

  if (files.length === 0) {
    throw new Error('Could not fetch any readable files from this repository.');
  }

  return { url, files };
};

function selectRelevantFiles(allPaths: string[]): string[] {
  // Intelligent filtering to maximize context quality
  const scored = allPaths.map(p => {
    let score = 0;
    const lower = p.toLowerCase();
    
    // 1. Existing Documentation is highest priority
    if (lower.includes('docs/') && lower.endsWith('.md')) score += 20;
    if (lower === 'readme.md') score += 15;
    if (lower.includes('contributing')) score += 10;
    
    // 2. Configuration defines the framework
    if (lower.endsWith('package.json') || lower.endsWith('go.mod') || lower.endsWith('cargo.toml')) score += 8;
    if (lower.includes('tsconfig')) score += 5;
    if (lower.includes('dockerfile')) score += 5;
    
    // 3. Entry points and Core Logic
    if (lower.match(/src\/(index|main|app|server)\.(ts|js|go|py|rs)/)) score += 6;
    if (lower.match(/app\/page\.(tsx|jsx)/)) score += 6;
    
    // 4. API Definitions
    if (lower.includes('schema') || lower.includes('interface') || lower.includes('types.ts')) score += 4;

    // Negatives (Noise Reduction)
    if (lower.includes('node_modules')) score -= 1000;
    if (lower.includes('dist/') || lower.includes('build/') || lower.includes('.next/')) score -= 1000;
    if (lower.includes('.lock') || lower.includes('-lock')) score -= 50;
    if (lower.includes('test') || lower.includes('spec.')) score -= 20; // Tests are useful but secondary to implementation for high-level docs
    if (lower.match(/\.(png|jpg|jpeg|gif|svg|ico|woff|woff2|ttf|eot)$/)) score -= 1000;

    return { path: p, score };
  });

  // Sort by score desc
  scored.sort((a, b) => b.score - a.score);

  // Take top 40 files for Gemini 3 Pro (Large Context)
  return scored.filter(s => s.score > 0).slice(0, 40).map(s => s.path);
}
