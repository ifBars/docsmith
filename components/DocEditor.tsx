import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import rehypeHighlight from 'rehype-highlight';
import * as Diff from 'diff';
import { DocFramework, RepoContext, Section, DocFile, Revision } from '../types';
import { Button } from './ui/Button';
import { ArrowLeft, Play, Download, Copy, FileText, PanelRightClose, PanelRightOpen, RefreshCw, Folder, AlignLeft, Split, Eye, Edit2, Send, Wand2, ShieldCheck, AlertCircle, Check, X, Database, Loader2, History, GitCommit, Bot, User, Trash2, Undo2 } from 'lucide-react';
import { draftSectionContent, proposeRefinement, generateDocOutline, auditSectionContent } from '../services/geminiService';

interface DocEditorProps {
  framework: DocFramework;
  initialFiles: DocFile[];
  context: RepoContext;
  onBack: () => void;
}

type ViewMode = 'edit' | 'split' | 'preview' | 'diff';

// --- Diff Logic Component ---
const DiffViewer = ({ oldText, newText }: { oldText: string, newText: string }) => {
  const diff = Diff.diffLines(oldText, newText);

  return (
    <div className="font-mono text-sm leading-6 whitespace-pre-wrap">
      {diff.map((part, index) => {
        const color = part.added ? 'bg-green-900/30 text-green-200' : part.removed ? 'bg-red-900/30 text-red-300' : 'text-zinc-400';
        const prefix = part.added ? '+ ' : part.removed ? '- ' : '  ';
        return (
          <span key={index} className={`block ${color} px-4 border-l-2 ${part.added ? 'border-green-700' : part.removed ? 'border-red-700' : 'border-transparent'}`}>
            {part.value.replace(/\n$/, '')} 
          </span>
        )
      })}
    </div>
  );
};

// Custom Markdown Components for "World Class" Rendering
const MarkdownComponents = {
  // Unwrap pre to allow div inside code
  pre: ({children}: any) => <>{children}</>,
  
  code: ({node, inline, className, children, ...props}: any) => {
      const match = /language-(\w+)/.exec(className || '')
      const lang = match ? match[1] : ''
      const codeString = String(children).replace(/\n$/, '');
      
      if (inline) {
          return <code className="bg-zinc-800 text-amber-500 px-1 py-0.5 rounded text-[0.85em] font-mono border border-zinc-700/50" {...props}>{children}</code>
      }

      return (
          <div className="group relative my-5 rounded-md border border-zinc-800 bg-[#0d1117] overflow-hidden shadow-sm">
              <div className="absolute right-2 top-2 opacity-0 group-hover:opacity-100 transition-opacity z-10 flex gap-2">
                 <button
                      onClick={() => navigator.clipboard.writeText(codeString)}
                      className="flex items-center gap-1.5 px-2 py-1 text-xs text-zinc-400 hover:text-white bg-zinc-800/90 hover:bg-zinc-700 rounded-md backdrop-blur-sm border border-zinc-700/50 transition-colors"
                  >
                      <Copy className="w-3 h-3" />
                      <span className="font-mono">Copy</span>
                  </button>
              </div>
              {lang && (
                 <div className="absolute left-0 top-0 px-3 py-1 text-[10px] font-mono font-bold text-zinc-500 bg-zinc-900/80 border-b border-r border-zinc-800/50 rounded-br-md select-none uppercase tracking-wider z-10">
                   {lang}
                 </div>
              )}
              <div className={`overflow-x-auto text-sm leading-relaxed ${lang ? 'pt-8' : 'pt-4'} p-4`}>
                 <code className={`${className} font-mono`} {...props}>
                     {children}
                 </code>
              </div>
          </div>
      )
  },
  h1: ({node, ...props}: any) => <h1 className="text-3xl font-bold text-white mb-6 pb-4 border-b border-zinc-800 tracking-tight" {...props} />,
  h2: ({node, ...props}: any) => <h2 className="text-xl font-bold text-zinc-100 mt-10 mb-4 flex items-center gap-2 tracking-tight" {...props} />,
  h3: ({node, ...props}: any) => <h3 className="text-lg font-semibold text-zinc-200 mt-8 mb-3 tracking-tight" {...props} />,
  h4: ({node, ...props}: any) => <h4 className="text-base font-semibold text-zinc-300 mt-6 mb-2 tracking-tight" {...props} />,
  p: ({node, ...props}: any) => <p className="text-zinc-400 leading-7 mb-4 font-light" {...props} />,
  ul: ({node, ...props}: any) => <ul className="list-disc list-outside ml-4 mb-4 text-zinc-400 space-y-2 marker:text-zinc-600" {...props} />,
  ol: ({node, ...props}: any) => <ol className="list-decimal list-outside ml-4 mb-4 text-zinc-400 space-y-2 marker:text-zinc-600" {...props} />,
  li: ({node, ...props}: any) => <li className="pl-1 leading-7" {...props} />,
  a: ({node, ...props}: any) => <a className="text-accent hover:text-amber-400 hover:underline decoration-accent/50 underline-offset-4 transition-colors font-medium" {...props} />,
  blockquote: ({node, ...props}: any) => (
      <blockquote className="border-l-2 border-accent/50 bg-zinc-900/50 pl-4 py-3 my-6 text-zinc-300 italic rounded-r-sm" {...props} />
  ),
  table: ({node, ...props}: any) => (
      <div className="overflow-x-auto my-8 border border-zinc-800 rounded-sm shadow-sm">
          <table className="w-full text-left text-sm" {...props} />
      </div>
  ),
  thead: ({node, ...props}: any) => <thead className="bg-zinc-900/80 text-zinc-200 border-b border-zinc-800" {...props} />,
  tbody: ({node, ...props}: any) => <tbody className="bg-zinc-950/30 divide-y divide-zinc-800/50" {...props} />,
  tr: ({node, ...props}: any) => <tr className="hover:bg-zinc-900/50 transition-colors" {...props} />,
  th: ({node, ...props}: any) => <th className="px-4 py-3 font-semibold font-mono text-xs uppercase tracking-wider text-zinc-500" {...props} />,
  td: ({node, ...props}: any) => <td className="px-4 py-3 text-zinc-400" {...props} />,
  hr: ({node, ...props}: any) => <hr className="border-zinc-800 my-10" {...props} />,
}

export const DocEditor: React.FC<DocEditorProps> = ({ framework, initialFiles, context, onBack }) => {
  const [files, setFiles] = useState<DocFile[]>(initialFiles);
  const [activeFileId, setActiveFileId] = useState<string>(initialFiles[0]?.id || '');
  const [activeSectionId, setActiveSectionId] = useState<string>('');
  const [isDrafting, setIsDrafting] = useState(false);
  const [isAuditing, setIsAuditing] = useState(false);
  const [showCopilot, setShowCopilot] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<'files' | 'outline'>('files');
  const [viewMode, setViewMode] = useState<ViewMode>('split');
  const [draftingLog, setDraftingLog] = useState<string>('');
  
  // Chat State
  const [chatMessages, setChatMessages] = useState<Array<{role: 'user' | 'ai', text: string}>>([
    { role: 'ai', text: "I'm your documentation copilot. Select a section and tell me how I can help improve it." }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  // History Modal State
  const [showHistory, setShowHistory] = useState(false);

  const activeFile = files.find(f => f.id === activeFileId);
  const activeSection = activeFile?.sections.find(s => s.id === activeSectionId);

  // Auto-scroll chat
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

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
        setDraftingLog("Generating file structure...");
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
        setDraftingLog("");
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
    const content = await draftSectionContent(section, activeFile.path, context, (log) => setDraftingLog(log));
    
    const newSections = [...activeFile.sections];
    newSections[idx] = { 
        ...section, 
        content, 
        isDrafted: true,
        revisions: [{ 
            id: Date.now().toString(), 
            timestamp: Date.now(), 
            content, 
            author: 'AI', 
            reason: 'Initial Draft' 
        }] 
    };
    
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
    setIsDrafting(false);
    setDraftingLog("");
  };

  useEffect(() => {
    if (activeSectionId) {
      draftSection(activeSectionId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeSectionId]);

  // --- Collaborative Workflow ---

  const handleCopilotRequest = async (instruction: string) => {
    if (!activeSection?.content || !activeFile) return;
    if (!instruction.trim()) return;

    // Add user message
    setChatMessages(prev => [...prev, { role: 'user', text: instruction }]);
    setChatInput('');
    
    setIsDrafting(true);
    setDraftingLog("Thinking...");
    
    try {
        const proposal = await proposeRefinement(activeSection.content, instruction, activeFile.path, activeSection.title);
        
        // Update section with proposal
        const newSections = activeFile.sections.map(s => 
            s.id === activeSectionId 
            ? { ...s, proposal } 
            : s
        );
        setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
        
        // Add AI response
        setChatMessages(prev => [...prev, { role: 'ai', text: `I've proposed a change: ${proposal.reason}. Please review the diff.` }]);
        setViewMode('diff');
        
    } catch (e) {
        setChatMessages(prev => [...prev, { role: 'ai', text: "I encountered an error trying to process that request." }]);
    } finally {
        setIsDrafting(false);
        setDraftingLog("");
    }
  };

  const acceptProposal = () => {
    if (!activeFile || !activeSection || !activeSection.proposal) return;

    const newRevision: Revision = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        content: activeSection.proposal.suggestedContent,
        author: 'AI',
        reason: activeSection.proposal.reason
    };

    const newSections = activeFile.sections.map(s => 
        s.id === activeSectionId 
        ? { 
            ...s, 
            content: s.proposal!.suggestedContent, 
            proposal: undefined,
            revisions: [newRevision, ...s.revisions]
          } 
        : s
    );
    
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
    setViewMode('edit');
    setChatMessages(prev => [...prev, { role: 'ai', text: "Changes applied successfully." }]);
  };

  const rejectProposal = () => {
    if (!activeFile || !activeSection) return;

    const newSections = activeFile.sections.map(s => 
        s.id === activeSectionId 
        ? { ...s, proposal: undefined } 
        : s
    );
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
    setViewMode('edit');
    setChatMessages(prev => [...prev, { role: 'ai', text: "Proposal discarded." }]);
  };

  const handleAuditSection = async () => {
    if (!activeFile || !activeSection || !activeSection.content) return;
    setIsAuditing(true);
    setDraftingLog(`Auditing section: ${activeSection.title}...`);
    
    const result = await auditSectionContent(activeSection, activeFile.path, context);
    if (result.hasIssues && result.suggestion) {
        // Map old audit format to new proposal format
        const proposal = {
            id: Date.now().toString(),
            suggestedContent: result.suggestion,
            reason: result.reason || "Audit findings",
            type: 'correction' as const
        };

        const newSections = activeFile.sections.map(s => 
            s.id === activeSectionId 
            ? { ...s, proposal } 
            : s
        );
        setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
        setChatMessages(prev => [...prev, { role: 'ai', text: `Audit complete. I found issues: ${result.reason}. Review the proposed fix.` }]);
        setViewMode('diff');
    } else {
        setChatMessages(prev => [...prev, { role: 'ai', text: "Audit passed. Content looks good." }]);
    }
    
    setIsAuditing(false);
    setDraftingLog("");
  };

  const handleRestoreRevision = (rev: Revision) => {
      if (!activeFile || !activeSection) return;
      
      const restoreRev: Revision = {
          id: Date.now().toString(),
          timestamp: Date.now(),
          content: rev.content,
          author: 'USER',
          reason: `Restored to version from ${new Date(rev.timestamp).toLocaleTimeString()}`
      };

      const newSections = activeFile.sections.map(s => 
        s.id === activeSectionId 
        ? { ...s, content: rev.content, revisions: [restoreRev, ...s.revisions] } 
        : s
      );
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
      setShowHistory(false);
      setChatMessages(prev => [...prev, { role: 'ai', text: "Restored previous version." }]);
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
      // We don't save every keystroke to revisions history, only manual saves or big AI events
      // But we update current state
      const newSections = activeFile.sections.map(s => s.id === activeSectionId ? { ...s, content: text } : s);
      setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
  };

  const saveManualEdit = () => {
    if (!activeFile || !activeSection) return;
    const newRevision: Revision = {
        id: Date.now().toString(),
        timestamp: Date.now(),
        content: activeSection.content || '',
        author: 'USER',
        reason: 'Manual Edit'
    };
    const newSections = activeFile.sections.map(s => 
        s.id === activeSectionId ? { ...s, revisions: [newRevision, ...s.revisions] } : s
    );
    setFiles(prev => prev.map(f => f.id === activeFileId ? { ...f, sections: newSections } : f));
  }

  return (
    <div className="h-full flex flex-col bg-zinc-950 text-zinc-300 font-mono text-sm relative">
      
      {/* Tool Bar */}
      <div className="h-14 border-b border-zinc-800 flex items-center justify-between px-4 bg-zinc-900 select-none flex-shrink-0">
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
          
          <Button 
            variant="secondary" 
            size="sm" 
            onClick={handleAuditSection} 
            loading={isAuditing}
            disabled={!activeFile || isAuditing || !activeSection?.content}
            icon={<ShieldCheck className="w-3 h-3"/>}
          >
            {isAuditing ? 'AUDITING...' : 'AUDIT'}
          </Button>
          
          <Button
             variant="ghost"
             size="sm"
             onClick={() => setShowHistory(!showHistory)}
             icon={<History className="w-3 h-3" />}
             className={showHistory ? 'text-white bg-zinc-800' : ''}
          >
             HISTORY
          </Button>

          <div className="h-4 w-px bg-zinc-800 mx-1"></div>

          {/* View Toggles */}
          <div className="bg-zinc-950 border border-zinc-800 rounded-sm p-0.5 flex mr-4">
             <button title="Editor Only" onClick={() => setViewMode('edit')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'edit' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Edit2 className="w-3 h-3" /></button>
             <button title="Split View" onClick={() => setViewMode('split')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'split' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Split className="w-3 h-3" /></button>
             <button title="Preview Only" onClick={() => setViewMode('preview')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'preview' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><Eye className="w-3 h-3" /></button>
             <button title="Diff View" onClick={() => setViewMode('diff')} className={`p-1.5 rounded-sm transition-colors ${viewMode === 'diff' ? 'bg-zinc-800 text-white' : 'text-zinc-500 hover:text-zinc-300'}`}><GitCommit className="w-3 h-3" /></button>
          </div>

          <Button variant="secondary" size="sm" onClick={() => activeFile && navigator.clipboard.writeText(getFullMarkdown(activeFile))} icon={<Copy className="w-3 h-3"/>}>
            COPY
          </Button>
          <Button variant="primary" size="sm" onClick={handleDownload} icon={<Download className="w-3 h-3"/>}>
            EXPORT
          </Button>
          <button 
            onClick={() => setShowCopilot(!showCopilot)} 
            className={`ml-2 p-1.5 rounded-sm hover:bg-zinc-800 transition-colors ${showCopilot ? 'text-accent bg-zinc-800' : 'text-zinc-500'}`}
          >
            {showCopilot ? <PanelRightOpen className="w-4 h-4" /> : <PanelRightClose className="w-4 h-4" />}
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
                    {files.map((file) => {
                      return (
                        <button
                            key={file.id}
                            onClick={() => {
                                setActiveFileId(file.id);
                            }}
                            className={`w-full text-left px-4 py-3 text-xs transition-colors flex flex-col gap-1 border-l-2 ${
                            activeFileId === file.id 
                                ? 'bg-zinc-900 text-white border-accent' 
                                : 'text-zinc-500 border-transparent hover:text-zinc-300 hover:bg-zinc-900/50'
                            }`}
                        >
                            <div className="flex items-center gap-2 justify-between w-full">
                                <div className="flex items-center gap-2 overflow-hidden">
                                  <FileText className="w-3 h-3 flex-shrink-0" />
                                  <span className="truncate font-bold">{file.path}</span>
                                </div>
                            </div>
                            <span className="pl-5 opacity-50 truncate text-[10px]">
                                {file.sections.length > 0 ? `${file.sections.length} sections` : 'Pending Analysis'}
                            </span>
                        </button>
                      );
                    })}
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
                                    {section.proposal ? (
                                      <GitCommit className="w-3 h-3 text-amber-500 flex-shrink-0 animate-pulse" />
                                    ) : section.isDrafted ? (
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
          
          {/* Revisions History Overlay */}
          {showHistory && activeSection && (
              <div className="absolute top-0 right-0 h-full w-80 bg-zinc-900 border-l border-zinc-800 z-30 shadow-2xl overflow-y-auto animate-in slide-in-from-right-10">
                 <div className="p-4 border-b border-zinc-800 flex justify-between items-center">
                    <span className="font-mono text-xs uppercase text-zinc-400">Version History</span>
                    <button onClick={() => setShowHistory(false)}><X className="w-4 h-4 text-zinc-500" /></button>
                 </div>
                 <div className="divide-y divide-zinc-800">
                    {activeSection.revisions.length === 0 ? (
                        <div className="p-4 text-zinc-600 text-xs italic">No previous versions</div>
                    ) : (
                        activeSection.revisions.map((rev) => (
                            <div key={rev.id} className="p-4 hover:bg-zinc-800/50 group">
                                <div className="flex justify-between items-start mb-2">
                                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${rev.author === 'AI' ? 'bg-amber-500/10 text-amber-500' : 'bg-blue-500/10 text-blue-400'}`}>
                                        {rev.author}
                                    </span>
                                    <span className="text-[10px] text-zinc-500 font-mono">{new Date(rev.timestamp).toLocaleTimeString()}</span>
                                </div>
                                <p className="text-xs text-zinc-300 mb-2">{rev.reason}</p>
                                <Button size="sm" variant="secondary" onClick={() => handleRestoreRevision(rev)} icon={<Undo2 className="w-3 h-3"/>} className="w-full opacity-0 group-hover:opacity-100 transition-opacity">
                                    Restore
                                </Button>
                            </div>
                        ))
                    )}
                 </div>
              </div>
          )}

          {activeSection ? (
            <>
              {isDrafting && (
                <div className="absolute top-0 left-0 w-full h-0.5 bg-zinc-900 overflow-hidden z-20">
                   <div className="h-full bg-accent animate-progress origin-left w-1/3"></div>
                </div>
              )}
              
              {/* Diff Mode (Priority View if proposal exists) */}
              {(viewMode === 'diff' || activeSection.proposal) ? (
                 <div className="flex-1 flex flex-col h-full bg-[#0d1117]">
                    {activeSection.proposal ? (
                        <div className="bg-amber-950/30 border-b border-amber-900/50 p-4">
                           <div className="flex items-start gap-4">
                              <GitCommit className="w-5 h-5 text-amber-500 mt-1" />
                              <div className="flex-1">
                                 <h3 className="text-amber-500 font-bold text-sm mb-1 uppercase tracking-wide">Change Proposed</h3>
                                 <p className="text-zinc-300 text-sm mb-4 leading-relaxed">{activeSection.proposal.reason}</p>
                                 <div className="flex gap-3">
                                    <Button variant="primary" onClick={acceptProposal} icon={<Check className="w-4 h-4"/>}>Accept Changes</Button>
                                    <Button variant="secondary" onClick={rejectProposal} icon={<X className="w-4 h-4"/>}>Reject</Button>
                                 </div>
                              </div>
                           </div>
                        </div>
                    ) : (
                        <div className="p-4 bg-zinc-900 border-b border-zinc-800 text-zinc-500 text-xs uppercase tracking-wider text-center">
                           Diff View Active
                        </div>
                    )}
                    
                    <div className="flex-1 overflow-auto p-4 md:p-8">
                       <h4 className="text-zinc-600 font-mono text-xs mb-4 uppercase">Comparing Changes</h4>
                       <div className="bg-zinc-950 border border-zinc-800 rounded-md p-4 overflow-x-auto">
                          <DiffViewer 
                             oldText={activeSection.content || ''} 
                             newText={activeSection.proposal ? activeSection.proposal.suggestedContent : (activeSection.content || '')} 
                          />
                       </div>
                    </div>
                 </div>
              ) : (
                <>
                  {/* Editor Pane */}
                  {(viewMode === 'edit' || viewMode === 'split') && (
                      <div className={`flex-1 overflow-y-auto border-r border-zinc-900 flex flex-col ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                        <div className="flex-1 p-8">
                            <textarea
                                className="w-full h-full bg-transparent text-zinc-300 font-mono text-sm leading-7 focus:outline-none resize-none p-0 border-none placeholder-zinc-700"
                                value={activeSection.content || ''}
                                placeholder="// Content is being generated by AI..."
                                spellCheck={false}
                                onChange={(e) => updateActiveSectionContent(e.target.value)}
                                onBlur={saveManualEdit}
                            />
                        </div>
                      </div>
                  )}

                  {/* Preview Pane */}
                  {(viewMode === 'preview' || viewMode === 'split') && (
                      <div className={`flex-1 overflow-y-auto bg-zinc-950 ${viewMode === 'split' ? 'w-1/2' : 'w-full'}`}>
                          <div className="p-8 pb-32">
                            <h2 className="text-zinc-500 text-xs font-mono uppercase tracking-widest border-b border-zinc-800 pb-2 mb-6">
                                Preview: {activeSection.title}
                            </h2>
                            <ReactMarkdown 
                              remarkPlugins={[remarkGfm]}
                              rehypePlugins={[rehypeHighlight]}
                              components={MarkdownComponents}
                            >
                                {activeSection.content || ''}
                            </ReactMarkdown>
                          </div>
                      </div>
                  )}
                </>
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

        {/* Pane 3: Copilot Chat (Right) */}
        {showCopilot && (
          <aside className="w-80 border-l border-zinc-800 bg-zinc-950 flex flex-col flex-shrink-0 z-20">
            <div className="p-3 border-b border-zinc-800 text-xs font-bold text-zinc-500 uppercase tracking-wider flex items-center gap-2">
              <Wand2 className="w-4 h-4 text-accent" />
              Copilot
            </div>
            
            {/* Chat History */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4">
              {chatMessages.map((msg, i) => (
                 <div key={i} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                    <div className={`w-6 h-6 rounded flex items-center justify-center shrink-0 ${msg.role === 'ai' ? 'bg-accent text-black' : 'bg-zinc-700 text-zinc-300'}`}>
                       {msg.role === 'ai' ? <Bot className="w-3 h-3"/> : <User className="w-3 h-3"/>}
                    </div>
                    <div className={`text-xs p-3 rounded-lg max-w-[85%] leading-relaxed ${msg.role === 'ai' ? 'bg-zinc-900 text-zinc-300' : 'bg-zinc-800 text-white'}`}>
                       {msg.text}
                    </div>
                 </div>
              ))}
              <div ref={chatEndRef} />
              
              {isDrafting && (
                  <div className="flex gap-3">
                     <div className="w-6 h-6 rounded bg-accent text-black flex items-center justify-center shrink-0">
                        <Loader2 className="w-3 h-3 animate-spin" />
                     </div>
                     <div className="text-xs p-3 rounded-lg bg-zinc-900 text-zinc-500 animate-pulse">
                        {draftingLog}
                     </div>
                  </div>
              )}
            </div>

            {/* Input Area */}
            <div className="p-4 border-t border-zinc-900 bg-zinc-950">
                {activeSection ? (
                   <div className="relative">
                      <input 
                         className="w-full bg-zinc-900 border border-zinc-800 rounded-sm py-3 pl-4 pr-10 text-xs text-white focus:outline-none focus:border-accent focus:ring-1 focus:ring-accent placeholder-zinc-600"
                         placeholder="Ask for changes (e.g., 'Make it friendlier')"
                         value={chatInput}
                         onChange={(e) => setChatInput(e.target.value)}
                         onKeyDown={(e) => e.key === 'Enter' && !isDrafting && handleCopilotRequest(chatInput)}
                         disabled={isDrafting}
                      />
                      <button 
                         className="absolute right-2 top-2.5 text-zinc-500 hover:text-white disabled:opacity-50"
                         onClick={() => handleCopilotRequest(chatInput)}
                         disabled={!chatInput || isDrafting}
                      >
                         <Send className="w-4 h-4" />
                      </button>
                   </div>
                ) : (
                    <div className="text-center text-xs text-zinc-600 py-2">
                        Select a section to start chatting
                    </div>
                )}
                
                {/* Quick Actions */}
                <div className="mt-3 grid grid-cols-2 gap-2">
                   {['Fix Grammar', 'Shorten', 'Add Example', 'Professional Tone'].map(action => (
                      <button 
                        key={action}
                        onClick={() => handleCopilotRequest(action)}
                        disabled={!activeSection || isDrafting}
                        className="text-[10px] py-1.5 bg-zinc-900 hover:bg-zinc-800 border border-zinc-800 text-zinc-400 rounded-sm transition-colors text-center"
                      >
                         {action}
                      </button>
                   ))}
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
            {isAuditing && <span className="animate-pulse">AUDITING SECTION...</span>}
         </div>
         <div className="flex items-center gap-4">
            <span>GEMINI 2.5 FLASH ACTIVE</span>
            <span>MARKDOWN</span>
         </div>
      </div>
    </div>
  );
};