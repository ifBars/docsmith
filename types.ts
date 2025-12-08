

export enum AppStep {
  LANDING = 'LANDING',
  ANALYZING = 'ANALYZING',
  OVERVIEW = 'OVERVIEW',
  PLANNING = 'PLANNING',
  DRAFTING = 'DRAFTING',
}

export enum DocFramework {
  EXISTING = 'Existing Documentation',
  SINGLE_FILE = 'Single File (README)',
  VITEPRESS = 'VitePress',
  DOCUSAURUS = 'Docusaurus',
  FUMADOCS = 'Fumadocs',
  DOCFX = 'DocFX',
}

// RAG Types
export interface VectorChunk {
  id: string;
  text: string;
  sourceFile: string;
  embedding: number[];
  type: 'MAIN' | 'REFERENCE';
}

export interface ReferenceRepo {
  url: string;
  files: FileSummary[];
  status: 'indexed' | 'indexing' | 'error';
}

// Result from Gemini Analysis
export interface RepoContext {
  summary: string;
  techStack: string[];
  entryPoints: string[];
  keyModules: Array<{ name: string; responsibility: string }>;
  workflows: string[]; // User journeys
  artifacts: {
    projectOverview: string;
    gettingStarted: string;
    architecture: string;
    commonTasks: string;
  };
  // Q&A to verify AI understanding and measure context quality
  benchmarks: Array<{ question: string; answer: string }>; 
  // RAG Storage
  vectorIndex: VectorChunk[];
  referenceRepos: ReferenceRepo[];
}

export interface Revision {
  id: string;
  timestamp: number;
  content: string;
  reason: string; // "User edit" or "AI: refined tone"
  author: 'USER' | 'AI';
}

export interface SectionProposal {
  id: string;
  suggestedContent: string;
  reason: string;
  type: 'refinement' | 'expansion' | 'rewrite' | 'correction';
}

export interface Section {
  id: string;
  title: string;
  description: string; // Prompt hint for the AI
  content?: string; // The generated markdown
  isDrafted: boolean;
  
  // History & Revision Control
  revisions: Revision[];
  
  // Collaborative Editing
  proposal?: SectionProposal;

  // Audit & Review State
  suggestion?: string; // Legacy field for audit, mapped to proposal now
  suggestionReason?: string; // Legacy field
  isAuditing?: boolean; 
  lastRefinedWithBenchmarks?: boolean;
}

export interface DocFile {
  id: string;
  path: string; // e.g. "docs/guide/intro.md" or "README.md"
  title: string; // Display title
  description: string; // Purpose of this file
  sections: Section[]; // The content structure of this file
  isLoaded: boolean; // Have we generated the outline (sections) yet?
  isExisting?: boolean; // Was this imported from the repo?
}

export interface FileSummary {
  path: string;
  contentSnippet: string; // First 30k chars
}

// Real representation of a repo data structure
export interface RepoData {
  url: string;
  files: FileSummary[];
}