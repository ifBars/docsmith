import { Octokit } from "octokit";
import { FileSummary, RepoData } from '../types';

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

export const fetchRepoData = async (url: string, token?: string): Promise<RepoData> => {
  const match = url.match(/github\.com\/([^\/]+)\/([^\/\.]+)/);
  if (!match) {
    throw new Error('Invalid GitHub URL. Format should be https://github.com/owner/repo');
  }
  const [, owner, repo] = match;

  const octokit = new Octokit({ 
      auth: token || undefined,
  });

  let defaultBranch = 'main';
  try {
    const { data: repoData } = await octokit.request('GET /repos/{owner}/{repo}', {
      owner,
      repo,
    });
    defaultBranch = repoData.default_branch;
  } catch (e: any) {
    if (e.status === 404 || e.status === 403) {
        throw new Error(`Access denied to ${owner}/${repo}. Please check the URL or provide a valid Personal Access Token if this is a private repository.`);
    }
    console.warn('Failed to fetch repo metadata, defaulting to main branch.', e);
  }

  let filesToFetch: { path: string, sha?: string }[] = [];
  
  try {
    const { data: treeData } = await octokit.request('GET /repos/{owner}/{repo}/git/trees/{tree_sha}', {
      owner,
      repo,
      tree_sha: defaultBranch,
      recursive: 'true'
    });

    if (treeData.tree && Array.isArray(treeData.tree)) {
      const allNodes = treeData.tree
        .filter((node: any) => node.type === 'blob' && node.path);
        
      const allPaths = allNodes.map((n:any) => n.path);
      const relevantPaths = selectRelevantFiles(allPaths);
      
      filesToFetch = relevantPaths.map(p => {
          const node = allNodes.find((n:any) => n.path === p);
          return { path: p, sha: node?.sha };
      });
    } else {
      filesToFetch = COMMON_FILES.map(p => ({ path: p }));
    }
  } catch (e) {
    console.warn('Tree fetch failed, falling back to common files.', e);
    filesToFetch = COMMON_FILES.map(p => ({ path: p }));
  }

  const files: FileSummary[] = [];
  // Use batched fetching to avoid overwhelming the browser/network
  const BATCH_SIZE = 6; 

  for (let i = 0; i < filesToFetch.length; i += BATCH_SIZE) {
      const batch = filesToFetch.slice(i, i + BATCH_SIZE);
      const promises = batch.map(f => fetchFileContent(octokit, owner, repo, defaultBranch, f.path, f.sha));
      const results = await Promise.all(promises);
      results.forEach(f => {
          if (f) files.push(f);
      });
  }

  if (files.length === 0) {
    throw new Error('Could not fetch any readable files. Ensure the repo is not empty and your token has permissions.');
  }

  return { url, files };
};

async function fetchFileContent(octokit: Octokit, owner: string, repo: string, branch: string, path: string, sha?: string): Promise<FileSummary | null> {
    try {
        let contentBase64 = '';
        
        // Strategy 1: Git Blob API (Preferred: Cheaper, supports up to 100MB, requires SHA)
        if (sha) {
            const { data } = await octokit.request('GET /repos/{owner}/{repo}/git/blobs/{file_sha}', {
                owner,
                repo,
                file_sha: sha,
            });
            contentBase64 = data.content;
        } 
        // Strategy 2: Contents API (Fallback: Supports up to 1MB, no SHA needed)
        else {
             const { data } = await octokit.request('GET /repos/{owner}/{repo}/contents/{path}', {
                owner,
                repo,
                path,
                ref: branch
            });
            
            if (Array.isArray(data) || !data.content) return null; // Directory or no content
            contentBase64 = data.content;
        }

        // Clean base64 (remove newlines)
        const cleanBase64 = contentBase64.replace(/\n/g, '');
        
        // Decode with UTF-8 support
        const binaryString = atob(cleanBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }
        const text = new TextDecoder().decode(bytes);

        // Binary check
        if (text.includes('\u0000')) return null;
        
        // Size Check (approx chars)
        if (text.length > 300000) return null;

        return {
            path,
            contentSnippet: text
        };

    } catch (e) {
        // Silent fail for individual files
        // console.warn(`Failed to fetch content for ${path}`, e);
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