
import React, { useState, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';
import { DocFramework, RepoContext, Section, DocFile } from '../types';
import { Button } from './ui/Button';
import { ArrowLeft, Play, Download, Copy, FileText, PanelRightClose, PanelRightOpen, RefreshCw, Folder, AlignLeft, Split, Eye, Edit2, Send, Wand2 } from 'lucide-react';
import { draftSectionContent, refineContent, generateDocOutline } from '../services/geminiService';

interface DocEditorProps {
  framework: DocFramework;
  initialFiles: DocFile[];
  context: RepoContext;
  onBack: () => void;
}

type ViewMode = 'edit' | 'split' | 'preview';

export const DocEditor: React.FC<DocEditorProps> = ({ framework, initialFiles, context, onBack }) => {
  const [files, setFiles] = useState<DocFile[]>(initialFiles);
  const [activeFileId, setActiveFileId] = useState<string>(initialFiles[0]?.id || '');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [showAssistant, setShowAssistant] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'outline'>('files');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [customRefinement, setCustomRefinement] = useState('');

  const activeFile = files.find(f => f.id === activeFileId);
  const activeSection = activeFile?.sections.find(s => s.id === activeSectionId);

  // Load outline when entering a file
  useEffect(() => {
    const loadOutlineIfNeeded = async () => {
        if (!activeFile) return;
        
        if (activeFile.isLoaded) {
            // If already loaded but no section selected, select first
            if (activeFile.sections.length > 0 && !activeSectionId) {
                setActiveSectionId(activeFile.sections[0].id);
            }
            return;
        }
        
        setIsDrafting(true);
        const sections = await generateDocOutline(activeFile.path, activeFile.description, context);
        
        setFiles(prev => prev.map(f => 
            f.id === activeFileId 
            ? { ...f, sections, isLoaded: true } 
            : f
        ));
        
        if (sections.length > 0) {
            setActiveSectionId(sections[0].id);
            setSidebarTab('outline');
        }
        setIsDrafting(false);
    };
    
    loadOutlineIfNeeded();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeFileId]);

  // Auto-draft section logic
  const draftSection = async (sectionId: string) => {
    if (!activeFile) return;
    
    const idx = activeFile.sections.findIndex(s => s.id === sectionId);
    if (idx === -1) return;
    
    const section = activeFile.sections[idx];
    if (section.isDrafted || section.content) return;

    setIsDrafting(true);
    const content = await draftSectionContent(section, activeFile.path, context);
    
    const newSections = [...activeFile.sections];
    newSections[idx] = { ...section, content, isDrafted: true };
    
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
    setIsDrafting(false);
  };

  useEffect(() => {
    if (activeSectionId) {
      draftSection(activeSectionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId]);

  const handleRefine = async (instruction: string) => {
    if (!activeSection?.content || !activeFile) return;
    setIsDrafting(true);
    const newContent = await refineContent(activeSection.content, instruction);
    
    const newSections = activeFile.sections.map(s => s.id === activeSectionId ? { ...s, content: newContent } : s);
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
    setIsDrafting(false);
    setCustomRefinement('');
  };

  const getFullMarkdown = (file: DocFile) => {
    return file.sections.map(s => `## ${s.title}\n\n${s.content || '(Drafting...)'}`).join('\n\n');
  };

  const handleDownload = () => {
    if (!activeFile) return;
    const element = document.createElement("a");
    const file = new Blob([getFullMarkdown(activeFile)], {type: 'text/markdown'});
    element.href = URL.createObjectURL(file);
    const parts = activeFile.path.split('/');
    const filename = parts[parts.length - 1];
    element.download = filename;
    document.body.appendChild(element);
    element.click();
  };

  const updateActiveSectionContent = (text: string) => {
      if (!activeFile) return;
      const newSections = activeFile.sections.map(s => s.id === activeSectionId ? { ...s, content: text } : s);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
  };

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-300 font-mono text-sm">
      {/* Tool Bar */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900 select-none">
        <div className="flex items-center gap-4">
          <button onClick={onBack} className="text-zinc-500 hover:text-white transition-colors">
            <ArrowLeft className="w-4 h-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="bg-accent/10 text-accent text-[10px] px-2 py-0.5 border border-accent/20 rounded-sm uppercase">{framework}</span>
            <span className="text-zinc-600 mx-2">/</span>
            <span className="font-bold text-zinc-200">{activeFile?.path || 'Select File'}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {/* View Toggles */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-0.5 flex mr-4">
             <button title="Editor Only" onClick={() => setViewMode('edit')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'edit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Edit2 className="w-3 h-3" /></button>
             <button title="Split View" onClick={() => setViewMode('split')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'split' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Split className="w-3 h-3" /></button>
             <button title="Preview Only" onClick={() => setViewMode('preview')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Eye className="w-3 h-3" /></button>
          </div>

          <Button variant="secondary" size="sm" onClick={() => activeFile && navigator.clipboard.writeText(getFullMarkdown(activeFile))} icon={<Copy className="w-3 h-3"/>}>
            COPY
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownload} icon={<Download className="w-3 h-3"/>}>
            EXPORT .MD
          </Button>
          <button 
            onClick={() => setShowAssistant(!showAssistant)} 
            className={`ml-2 p-1.5 rounded-sm hover:bg-zinc-800 transition-colors ${showAssistant ? 'text-accent bg-zinc-800' : 'text-zinc-500'}`}
          >
            {showAssistant ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div className="flex-1 flex overflow-hidden">
        {/* Pane 1: Navigation Sidebar */}
        <aside className="w-64 border-r border-zinc-800 flex flex-col bg-zinc-950 flex-shrink-0">
          <div className="flex border-b border-zinc-900">
             <button 
                onClick={() => setSidebarTab('files')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${sidebarTab === 'files' ? 'text-white border-b-2 border-accent bg-zinc-900' : 'text-zinc-600 hover:bg-zinc-900/50'}`}
             >
                <Folder className="w-3 h-3" /> Files
             </button>
             <button 
                onClick={() => setSidebarTab('outline')}
                className={`flex-1 py-3 text-[10px] font-bold uppercase tracking-wider flex items-center justify-center gap-2 transition-colors ${sidebarTab === 'outline' ? 'text-white border-b-2 border-accent bg-zinc-900' : 'text-zinc-600 hover:bg-zinc-900/50'}`}
             >
                <AlignLeft className="w-3 h-3" /> Outline
             </button>
          </div>
          
          <div className="flex-1 overflow-y-auto py-2">
            {sidebarTab === 'files' ? (
                <div>
                    {files.map((file) => (
                    <button
                        key={file.id}
                        onClick={() => {
                            setActiveFileId(file.id);
                            // If sidebar is file only, we might want to switch to outline automatically, 
                            // but usually user expects to see file list until they drill down.
                            // Let's keep it on files tab.
                        }}
                        className={`w-full text-left px-4 py-3 text-xs transition-colors flex flex-col gap-1 border-l-2 ${
                        activeFileId === file.id 
                            ? 'bg-zinc-900 text-white border-accent' 
                            : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/50'
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <FileText className="w-3 h-3" />
                            <span className="truncate font-bold">{file.path}</span>
                        </div>
                        <span className="pl-5 opacity-50 truncate text-[10px]">
                            {file.sections.length > 0 ? `${file.sections.length} sections` : 'Pending Analysis'}
                        </span>
                    </button>
                    ))}
                </div>
            ) : (
                <div>
                     {activeFile ? (
                        activeFile.sections.length > 0 ? (
                            activeFile.sections.map((section, idx) => (
                                <button
                                    key={section.id}
                                    onClick={() => setActiveSectionId(section.id)}
                                    className={`w-full text-left px-4 py-2 text-xs transition-colors flex items-center gap-2 border-l-2 ${
                                    activeSectionId === section.id 
                                        ? 'bg-zinc-900 text-white border-accent' 
                                        : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/50'
                                    }`}
                                >
                                    <span className="font-mono opacity-50 w-4 text-[10px]">{idx + 1}</span>
                                    <span className="truncate flex-1">{section.title}</span>
                                    {section.isDrafted ? (
                                    <div className="w-1.5 h-1.5 rounded-full bg-accent border-none shadow-[0_0_5px_rgba(245,158,11,0.5)]"></div>
                                    ) : (
                                    <div className="w-1.5 h-1.5 rounded-full bg-zinc-800"></div>
                                    )}
                                </button>
                            ))
                        ) : (
                            <div className="p-8 text-center">
                                {isDrafting ? (
                                   <div className="flex flex-col items-center gap-2">
                                     <RefreshCw className="w-4 h-4 animate-spin text-accent" />
                                     <span className="text-xs text-zinc-500">Generating outline...</span>
                                   </div>
                                ) : (
                                   <span className="text-xs text-zinc-600">No sections found.</span>
                                )}
                            </div>
                        )
                     ) : (
                         <div className="p-4 text-center text-zinc-600">Select a file first</div>
                     )}
                </div>
            )}
          </div>
        </aside>

        {/* Pane 2: Editor (Main) */}
        <main className="flex-1 flex min-w-0 bg-[#0d0d0d] relative">
          {activeSection ? (
            <>
              {isDrafting && (
                <div className="absolute top-0 left-0 w-full h-0.5 bg-zinc-900 overflow-hidden z-20">
                   <div className="h-full bg-accent animate-progress origin-left w-1/3"></div>
                </div>
              )}
              
              {/* Editor Pane */}
              {(viewMode === 'edit' || viewMode === 'split') && (
                  <div className={`flex-1 overflow-y-auto border-r border-zinc-900 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                    <div className="min-h-full p-8">
                        <textarea
                            className="w-full h-[calc(100vh-200px)] bg-transparent text-zinc-300 font-mono text-sm leading-7 focus:outline-none resize-none p-0 border-none placeholder-zinc-700"
                            value={activeSection.content || ''}
                            placeholder="// Content is being generated by AI..."
                            spellCheck={false}
                            onChange={(e) => updateActiveSectionContent(e.target.value)}
                        />
                    </div>
                  </div>
              )}

              {/* Preview Pane */}
              {(viewMode === 'preview' || viewMode === 'split') && (
                  <div className={`flex-1 overflow-y-auto bg-zinc-950 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                      <div className="p-8 prose prose-invert prose-sm max-w-none prose-headings:text-zinc-100 prose-a:text-accent prose-code:text-accent prose-pre:bg-zinc-900 prose-pre:border prose-pre:border-zinc-800">
                        <h2 className="text-zinc-500 text-xs font-mono uppercase tracking-widest border-b border-zinc-800 pb-2 mb-6">
                            Preview: {activeSection.title}
                        </h2>
                        <ReactMarkdown>{activeSection.content || ''}</ReactMarkdown>
                      </div>
                  </div>
              )}
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-zinc-600">
               {isDrafting ? (
                   <div className="flex flex-col items-center gap-4">
                       <RefreshCw className="w-8 h-8 animate-spin text-accent" />
                       <span className="text-xs uppercase tracking-widest">Analyzing File Structure...</span>
                   </div>
               ) : (
                   <div className="flex flex-col items-center gap-4">
                       <FileText className="w-12 h-12 text-zinc-800" />
                       <span className="uppercase text-xs tracking-widest">Select a section to begin</span>
                   </div>
               )}
            </div>
          )}
        </main>

        {/* Pane 3: Assistant (Right) */}
        {showAssistant && (
          <aside className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col flex-shrink-0">
            <div className="p-3 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-accent" />
              AI Copilot
            </div>
            
            <div className="p-4 space-y-6 flex-1 overflow-y-auto">
              <div>
                <label className="text-[10px] text-zinc-500 block mb-2 font-mono uppercase">Section Context</label>
                <div className="bg-zinc-900 border border-zinc-800 p-3 text-xs text-zinc-400 font-mono rounded-sm max-h-40 overflow-y-auto leading-relaxed whitespace-pre-wrap">
                   {activeSection?.description || "Select a section to see context."}
                </div>
              </div>

              <div>
                <label className="text-[10px] text-zinc-500 block mb-2 font-mono uppercase">Refine Selection</label>
                
                {/* Custom Input */}
                <div className="flex gap-0 mb-3 shadow-sm">
                   <input 
                      type="text" 
                      value={customRefinement}
                      onChange={(e) => setCustomRefinement(e.target.value)}
                      placeholder="e.g. 'Add a code example'"
                      className="bg-zinc-900 border border-zinc-800 border-r-0 text-xs text-white p-3 w-full focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent transition-all"
                      onKeyDown={(e) => e.key === 'Enter' && customRefinement && handleRefine(customRefinement)}
                   />
                   <button 
                     disabled={!customRefinement}
                     onClick={() => handleRefine(customRefinement)}
                     className="bg-zinc-800 border border-zinc-700 text-zinc-300 px-3 hover:bg-accent hover:text-black hover:border-accent disabled:opacity-50 disabled:hover:bg-zinc-800 disabled:hover:text-zinc-300 transition-colors"
                   >
                      <Send className="w-3 h-3" />
                   </button>
                </div>

                <div className="space-y-2">
                   {[
                     "Fix grammar & typos",
                     "Make it more concise",
                     "Add a code snippet",
                     "Format as a list",
                     "Make tone more professional"
                   ].map(action => (
                     <button
                       key={action}
                       onClick={() => handleRefine(action)}
                       disabled={isDrafting || !activeSection}
                       className="w-full text-left px-3 py-2 bg-zinc-950 border border-zinc-800 hover:border-accent/50 hover:bg-zinc-900 text-zinc-400 text-xs transition-colors rounded-sm flex items-center gap-2 group"
                     >
                       <Play className="w-2 h-2 text-zinc-700 group-hover:text-accent transition-colors" />
                       {action}
                     </button>
                   ))}
                </div>
              </div>
            </div>
          </aside>
        )}
      </div>
      
      {/* Footer Status Bar */}
      <div className="h-6 bg-accent text-black flex items-center px-3 text-[10px] font-bold tracking-wider select-none justify-between z-10">
         <div className="flex items-center gap-4">
            <span>MODE: {viewMode.toUpperCase()}</span>
            <span>{activeFile?.sections.filter(s => s.isDrafted).length || 0} / {activeFile?.sections.length || 0} SECTIONS DRAFTED</span>
         </div>
         <div className="flex items-center gap-4">
            <span>GEMINI 2.5 FLASH ACTIVE</span>
            <span>MARKDOWN</span>
         </div>
      </div>
    </div>
  );
};
