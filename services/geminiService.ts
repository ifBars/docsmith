

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
  onProgress?: (status: string, progress: number) => void
): Promise<RepoContext> => {
  const filesContext = files.map(f => `File: ${f.path}\nContent:\n${f.contentSnippet}`).join('\n---\n');
  
  // Phase 1 Prompt: Investigation Only
  const investigationPrompt = `
    You are an expert Principal Software Engineer. 
    Analyze the following file summaries from a GitHub repository to prepare for writing high-quality documentation.
    
    Goal: Deeply understand the business logic, architecture, and developer workflows.
    
    Files provided:
    ${filesContext}
    
    PHASE 1 INSTRUCTIONS:
    1. You are in 'INVESTIGATION MODE'. 
    2. Do NOT output the final JSON yet. Do NOT output markdown.
    3. Use the 'report_progress' tool to describe your analysis steps (e.g., "Scanning file relationships", "Extracting key workflows").
    4. You MUST call 'report_progress' at least 3-4 times to inform the user of your thinking process.
    5. When you have sufficient understanding of the codebase, call the 'signal_ready_for_synthesis' tool.
  `;

  const progressTool: FunctionDeclaration = {
    name: "report_progress",
    description: "Report analysis progress to the user.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        status: { type: Type.STRING, description: "Current activity log message (e.g. 'Analyzing Auth Logic')." },
        progress: { type: Type.INTEGER, description: "Percentage complete (0-90)." }
      },
      required: ["status", "progress"]
    }
  };

  const readyTool: FunctionDeclaration = {
    name: "signal_ready_for_synthesis",
    description: "Signal that you have finished analysis and are ready to generate the JSON report.",
    parameters: {
      type: Type.OBJECT,
      properties: {
        summary: { type: Type.STRING, description: "Brief confirmation." }
      }
    }
  };

  const schema: Schema = {
    type: Type.OBJECT,
    properties: {
      summary: { type: Type.STRING },
      techStack: { type: Type.ARRAY, items: { type: Type.STRING } },
      entryPoints: { type: Type.ARRAY, items: { type: Type.STRING } },
      keyModules: { 
        type: Type.ARRAY, 
        items: { 
          type: Type.OBJECT, 
          properties: { 
            name: { type: Type.STRING }, 
            responsibility: { type: Type.STRING } 
          } 
        } 
      },
      workflows: { type: Type.ARRAY, items: { type: Type.STRING } },
      artifacts: {
        type: Type.OBJECT,
        properties: {
          projectOverview: { type: Type.STRING },
          gettingStarted: { type: Type.STRING },
          architecture: { type: Type.STRING },
          commonTasks: { type: Type.STRING },
        }
      },
      benchmarks: {
        type: Type.ARRAY,
        items: {
          type: Type.OBJECT,
          properties: {
            question: { type: Type.STRING },
            answer: { type: Type.STRING }
          }
        }
      }
    },
    required: ["summary", "techStack", "artifacts", "benchmarks"]
  };

  try {
    // --- Phase 1: Investigation Loop (No Schema, Tools Enabled) ---
    let messages: any[] = [{ role: 'user', parts: [{ text: investigationPrompt }] }];
    let readyForSynthesis = false;

    // We loop to handle tool calls.
    // We do NOT set responseSchema here to allow the model to use tools freely.
    for (let turn = 0; turn < 12; turn++) {
      const response = await ai.models.generateContent({
        model: ANALYSIS_MODEL,
        contents: messages,
        config: {
          tools: [{ functionDeclarations: [progressTool, readyTool] }],
        }
      });

      const modelContent = response.candidates?.[0]?.content;
      if (modelContent) messages.push(modelContent);

      const functionCalls = response.functionCalls;
      
      if (functionCalls && functionCalls.length > 0) {
        const toolParts: any[] = [];
        
        for (const call of functionCalls) {
          if (call.name === "report_progress") {
             const { status, progress } = call.args as any;
             if (onProgress) onProgress(status, progress);
             
             toolParts.push({
               functionResponse: {
                 name: call.name,
                 id: call.id,
                 response: { result: "ok" }
               }
             });
          } else if (call.name === "signal_ready_for_synthesis") {
             readyForSynthesis = true;
             toolParts.push({
               functionResponse: {
                 name: call.name,
                 id: call.id,
                 response: { result: "ready" }
               }
             });
          }
        }

        if (toolParts.length > 0) {
          messages.push({ role: 'user', parts: toolParts });
        }

        if (readyForSynthesis) break;
      } else {
        // If the model talks without calling tools, we just nudge it back or ignore.
        // But usually it follows instructions.
        if (readyForSynthesis) break;
      }
    }

    // --- Phase 2: Synthesis (Schema Enabled, No Tools) ---
    if (onProgress) onProgress("Synthesizing final JSON report structure...", 95);

    // We append a final instruction to force the JSON output.
    messages.push({ 
      role: 'user', 
      parts: [{ text: "PHASE 2: Generate the final JSON object now based on your analysis. Adhere strictly to the schema." }] 
    });

    const finalResponse = await ai.models.generateContent({
      model: ANALYSIS_MODEL,
      contents: messages,
      config: {
        responseMimeType: "application/json",
        responseSchema: schema,
      }
    });

    const finalJsonText = finalResponse.text;
    if (!finalJsonText) throw new Error("Gemini did not return a final JSON response.");
    
    const parsed = JSON.parse(finalJsonText);
    
    return {
      summary: parsed.summary || "No summary available",
      techStack: parsed.techStack || [],
      entryPoints: parsed.entryPoints || [],
      keyModules: parsed.keyModules || [],
      workflows: parsed.workflows || [],
      artifacts: parsed.artifacts || {
        projectOverview: "",
        gettingStarted: "",
        architecture: "",
        commonTasks: ""
      },
      benchmarks: parsed.benchmarks || []
    };
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
