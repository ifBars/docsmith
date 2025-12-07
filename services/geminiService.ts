import { GoogleGenAI, Type, Schema, FunctionDeclaration } from "@google/genai";
import { DocFramework, FileSummary, RepoContext, Section, DocFile } from '../types';

const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

// Heavy lifting: Analysis & Architecture Planning
const ANALYSIS_MODEL = "gemini-3-pro-preview";
// Fast response: Drafting & Refinement
const DRAFTING_MODEL = "gemini-2.5-flash"; 

export const analyzeRepo = async (
  files: FileSummary[], 
  onProgress?: (status: string, progress: number) => void,
  onPartialUpdate?: (partial: Partial<RepoContext>) => void
): Promise<RepoContext> => {
  const filesContext = files.map(f => `File: ${f.path}\nContent:\n${f.contentSnippet}`).join('\n---\n');
  
  // Initialize empty context
  const currentContext: RepoContext = {
    summary: "",
    techStack: [],
    entryPoints: [],
    keyModules: [],
    workflows: [],
    artifacts: {
      projectOverview: "",
      gettingStarted: "",
      architecture: "",
      commonTasks: "",
    },
    benchmarks: []
  };

  const systemPrompt = `
    You are a Principal Software Architect conducting a deep-dive audit of a codebase.
    
    GOAL:
    Analyze the provided source code to build a comprehensive mental model of the system.
    You must populate the system report progressively using the provided tools.

    FILES PROVIDED:
    ${filesContext}

    INSTRUCTIONS:
    1. **Iterative Discovery**: Do not try to do everything at once. Analyze one aspect, then call the relevant tool to save it.
    2. **Deep Dive**: When analyzing architecture, look for data flow, state management patterns, and external integrations.
    3. **Strict Grounding**: 
       - Do NOT hallucinate features not present in the code. 
       - If a file mentions a config but the config file isn't present, note it as "inferred".
    
    REQUIRED STEPS (Call these tools in any logical order, but ALL must be called):
    - \`commit_overview\`: High-level summary and tech stack.
    - \`commit_architecture\`: Modules, entry points, and responsibilities.
    - \`commit_workflows\`: Critical user journeys (e.g., "User logs in -> Token stored -> Dashboard fetches data").
    - \`commit_artifacts\`: Draft the raw documentation content based on findings.
    - \`commit_benchmarks\`: Generate QA verification questions.

    CRITICAL RULE FOR BENCHMARKS:
    - You MUST avoid generic questions like "How does the code work?".
    - Questions MUST reference specific file names, variable names, or specific logic pathways found in the provided text.
    - Bad: "What database is used?"
    - Good: "In db.ts, how does the connection pool handle timeouts during high load?"
    - If you hallucinate functionality in benchmarks, the audit will fail.
  `;

  // --- TOOLS DEFINITION ---

  const tools: FunctionDeclaration[] = [
    {
      name: "commit_overview",
      description: "Save the Executive Summary and Tech Stack identification.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          summary: { type: Type.STRING, description: "2-3 sentences describing the business value and technical nature of the repo." },
          techStack: { type: Type.ARRAY, items: { type: Type.STRING }, description: "List of languages, frameworks, and key libraries detected." }
        },
        required: ["summary", "techStack"]
      }
    },
    {
      name: "commit_architecture",
      description: "Save the architectural modules and entry points.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          entryPoints: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Main files that start the application." },
          keyModules: { 
            type: Type.ARRAY, 
            items: { 
              type: Type.OBJECT, 
              properties: { 
                name: { type: Type.STRING }, 
                responsibility: { type: Type.STRING } 
              } 
            },
            description: "List of 4-8 core functional modules/folders and what they do."
          }
        },
        required: ["entryPoints", "keyModules"]
      }
    },
    {
      name: "commit_workflows",
      description: "Save the primary user journeys or data flows.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          workflows: { type: Type.ARRAY, items: { type: Type.STRING }, description: "Step-by-step descriptions of key operations." }
        },
        required: ["workflows"]
      }
    },
    {
      name: "commit_artifacts",
      description: "Save the drafted documentation artifacts.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          projectOverview: { type: Type.STRING, description: "Detailed markdown for the Project Overview section." },
          gettingStarted: { type: Type.STRING, description: "Detailed markdown for Installation/Setup." },
          architecture: { type: Type.STRING, description: "Detailed markdown for Architecture concepts." },
          commonTasks: { type: Type.STRING, description: "Detailed markdown for Common usage tasks." }
        },
        required: ["projectOverview", "gettingStarted", "architecture", "commonTasks"]
      }
    },
    {
      name: "commit_benchmarks",
      description: "Save 3-5 specific, code-grounded QA questions to verify context understanding.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          benchmarks: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING, description: "A specific question about a specific file or function." },
                answer: { type: Type.STRING, description: "The correct answer based on the code analysis." }
              }
            }
          }
        },
        required: ["benchmarks"]
      }
    },
    {
      name: "signal_complete",
      description: "Signal that all data has been analyzed and committed.",
      parameters: {
        type: Type.OBJECT,
        properties: {
          completion_message: { type: Type.STRING }
        }
      }
    }
  ];

  try {
    let messages: any[] = [{ role: 'user', parts: [{ text: systemPrompt }] }];
    let isComplete = false;
    
    // We allow up to 15 turns for deep analysis
    for (let turn = 0; turn < 15; turn++) {
      if (isComplete) break;

      const response = await ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: messages,
        config: {
          tools: [{ functionDeclarations: tools }],
          temperature: 0.2, // Lower temperature for more factual extraction
        }
      });

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) messages.push(modelContent);

      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const toolParts: any[] = [];
        
        for (const call of functionCalls) {
          const args = call.args as any;
          let toolResult = "ok";
          let statusUpdate = "";
          let progressUpdate = 0;

          // Process specific tools and update state
          if (call.name === "commit_overview") {
             currentContext.summary = args.summary;
             currentContext.techStack = args.techStack;
             statusUpdate = "Identified Tech Stack & Summary";
             progressUpdate = 20;
          } 
          else if (call.name === "commit_architecture") {
             currentContext.entryPoints = args.entryPoints;
             currentContext.keyModules = args.keyModules;
             statusUpdate = "Mapped Architecture & Modules";
             progressUpdate = 40;
          }
          else if (call.name === "commit_workflows") {
             currentContext.workflows = args.workflows;
             statusUpdate = "Traced User Journeys";
             progressUpdate = 60;
          }
          else if (call.name === "commit_artifacts") {
             currentContext.artifacts = args;
             statusUpdate = "Drafted Documentation Artifacts";
             progressUpdate = 80;
          }
          else if (call.name === "commit_benchmarks") {
             currentContext.benchmarks = args.benchmarks;
             statusUpdate = "Verified Context with QA";
             progressUpdate = 95;
          }
          else if (call.name === "signal_complete") {
             isComplete = true;
             statusUpdate = "Analysis Finalized";
             progressUpdate = 100;
          }

          if (onProgress && statusUpdate) {
            onProgress(statusUpdate, progressUpdate);
          }

          // Emit partial update to UI
          if (onPartialUpdate) {
            onPartialUpdate({ ...currentContext });
          }

          toolParts.push({
            functionResponse: {
              name: call.name,
              id: call.id,
              response: { result: toolResult }
            }
          });
        }

        if (toolParts.length > 0) {
          messages.push({ role: 'user', parts: toolParts });
        }
      } 
    }

    return currentContext;
  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    throw error;
  }
};

export const proposeFileStructure = async (framework: DocFramework, context: RepoContext): Promise<DocFile[]> => {
  const prompt = `
    You are a Documentation Architect. 
    Design a file structure for a ${framework} documentation site for the project described below.
    
    Project Analysis:
    ${JSON.stringify(context.artifacts)}
    
    Framework Standards:
    - VITEPRESS: Use .md files in docs/ folder. Suggest a logical sidebar structure (Guide, Config, API).
    - DOCUSAURUS: Use .md files in docs/ folder. Intro, Tutorial, Extras.
    - DOCFX: Use .md files in 'articles/' and 'api/' and an index.md.
    - FUMADOCS: Use .mdx files in 'content/docs/'.
    - SINGLE FILE: Only suggest a detailed README.md and CONTRIBUTING.md.

    Output a JSON array of files. Each object should have:
    - path: logical file path (e.g. "docs/guide/intro.md")
    - title: Human readable title for the sidebar
    - description: Specific instructions on what content goes in this file. Be detailed.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        path: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING },
      },
      required: ["path", "title", "description"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const files = JSON.parse(response.text || '[]') as any[];
    return files.map((f: any) => ({
      id: Math.random().toString(36).substring(7),
      path: f.path,
      title: f.title,
      description: f.description,
      sections: [],
      isLoaded: false
    }));
  } catch (error) {
    console.error("Structure Plan Error", error);
    return [{ 
      id: '1', 
      path: 'README.md', 
      title: 'Readme', 
      description: 'Project root', 
      sections: [], 
      isLoaded: false 
    }];
  }
};

export const generateDocOutline = async (fileName: string, filePurpose: string, context: RepoContext): Promise<Section[]> => {
  const prompt = `
    You are a Technical Writer using ${ANALYSIS_MODEL}.
    Create a detailed content plan (outline) for a file named "${fileName}".
    
    File Purpose: ${filePurpose}
    
    Project Context:
    ${JSON.stringify(context.artifacts)}
    
    Rules:
    - Structure it logically with H2/H3 level granularity.
    - Return a JSON array of sections.
    - Each section 'description' should be a prompt for the writer AI that includes specific details from the context to include in that section.
  `;

  const schema: Schema = {
    type: Type.ARRAY,
    items: {
      type: Type.OBJECT,
      properties: {
        id: { type: Type.STRING },
        title: { type: Type.STRING },
        description: { type: Type.STRING, description: "Detailed instructions for the writer model" },
      },
      required: ["id", "title", "description"]
    }
  };

  try {
    const response = await ai.models.generateContent({
      model: ANALYSIS_MODEL, // Use Pro for better outlining logic
      contents: prompt,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const text = response.text;
    const sections = JSON.parse(text || '[]') as any[];
    return sections.map((s: any) => ({ ...s, isDrafted: false }));
  } catch (error) {
    return [
      { id: '1', title: 'Introduction', description: 'Overview of the topic', isDrafted: false },
    ];
  }
};

export const draftSectionContent = async (
  section: Section, 
  fileName: string,
  context: RepoContext
): Promise<string> => {
  const prompt = `
    You are a Technical Writer. Write the content for one section of a documentation file.
    
    File: "${fileName}"
    Section Title: "${section.title}"
    
    Instructions:
    ${section.description}
    
    Context Information:
    ${JSON.stringify(context.artifacts)}
    
    Guidelines:
    - Format: Markdown.
    - Use clear headings, code blocks, and lists.
    - Do NOT include the section title as an H1/H2 at the top (it is handled by the parent renderer). Start directly with content.
    - Be concise but comprehensive.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DRAFTING_MODEL, // Flash is faster for generation
      contents: prompt,
    });

    return response.text || "";
  } catch (error) {
    console.error("Gemini Drafting Error:", error);
    return "Error generating content. Please try again.";
  }
};

export const refineContent = async (
  content: string, 
  instruction: string
): Promise<string> => {
  const prompt = `
    You are a collaborative editor.
    
    Original Text:
    ${content}
    
    User Request: ${instruction}
    
    Output the rewritten markdown only. Maintain the rest of the context.
  `;

  try {
    const response = await ai.models.generateContent({
      model: DRAFTING_MODEL,
      contents: prompt,
    });
    return response.text || content;
  } catch (error) {
    return content;
  }
};

/**
 * NEW: Analyzes existing repo files to reconstruct a DocSmith project structure
 * so users can edit existing documentation.
 */
export const importExistingDocs = (files: FileSummary[]): DocFile[] => {
  const docFiles = files.filter(f => 
    f.path.endsWith('.md') || 
    f.path.endsWith('.mdx') ||
    f.path.toLowerCase() === 'readme.md' ||
    f.path.toLowerCase().includes('docs/')
  );
  
  return docFiles.map(f => {
     // Parse content into sections for the editor
     const sections = parseMarkdownSections(f.contentSnippet);
     
     return {
        id: Math.random().toString(36).substring(7),
        path: f.path,
        title: f.path.split('/').pop()?.replace(/\.mdx?$/, '') || 'Untitled',
        description: 'Existing file imported from repository.',
        sections: sections,
        isLoaded: true,
        isExisting: true
     };
  });
};

// Helper to split markdown into editable sections
function parseMarkdownSections(content: string): Section[] {
  const lines = content.split('\n');
  const sections: Section[] = [];
  
  let currentTitle = "Introduction";
  let currentBuffer: string[] = [];
  
  const flush = () => {
    if (currentBuffer.length > 0 || currentTitle !== "Introduction") {
      // Clean up the buffer - remove leading blank lines
      let text = currentBuffer.join('\n').trim();
      
      sections.push({
        id: Math.random().toString(36).substring(7),
        title: currentTitle,
        description: `Existing content for ${currentTitle}`,
        content: text,
        isDrafted: true
      });
      currentBuffer = [];
    }
  };

  for (const line of lines) {
    // Detect H1 or H2 as section breaks
    const headerMatch = line.match(/^(#{1,2})\s+(.+)$/);
    if (headerMatch) {
      flush();
      currentTitle = headerMatch[2].trim();
      // We do NOT add the header line to the content buffer, 
      // as the Editor renders the title separately.
    } else {
      currentBuffer.push(line);
    }
  }
  flush();

  if (sections.length === 0) {
    // Fallback for empty file
     sections.push({
        id: Math.random().toString(36).substring(7),
        title: "Content",
        description: "Existing content",
        content: content,
        isDrafted: true
      });
  }

  return sections;
}
