
import React, { useState } from 'react';
import { DocFramework, DocFile } from '../types';
import { Button } from './ui/Button';
import { FileText, ChevronRight, RefreshCw, Layers, Plus, X, List, Box, FileCode, FolderGit2 } from 'lucide-react';

interface DocPlannerProps {
  onGenerateStructure: (framework: DocFramework) => Promise<DocFile[]>;
  onStartDrafting: (framework: DocFramework, files: DocFile[]) => void;
  loading: boolean;
}

export const DocPlanner: React.FC<DocPlannerProps> = ({ onGenerateStructure, onStartDrafting, loading }) => {
  const [selectedFramework, setSelectedFramework] = useState<DocFramework | null>(null);
  const [files, setFiles] = useState<DocFile[]>([]);
  const [structureLoading, setStructureLoading] = useState(false);

  const handleSelectFramework = async (framework: DocFramework) => {
    setSelectedFramework(framework);
    setStructureLoading(true);
    const generatedFiles = await onGenerateStructure(framework);
    setFiles(generatedFiles);
    setStructureLoading(false);
  };

  const frameworks = [
    { type: DocFramework.SINGLE_FILE, label: 'Single File', desc: 'README, CONTRIBUTING, etc', icon: FileText },
    { type: DocFramework.VITEPRESS, label: 'VitePress', desc: 'Vue-powered static site', icon: Layers },
    { type: DocFramework.DOCUSAURUS, label: 'Docusaurus', desc: 'React-based documentation', icon: Box },
    { type: DocFramework.FUMADOCS, label: 'Fumadocs', desc: 'Modern Next.js docs', icon: FileCode },
    { type: DocFramework.DOCFX, label: 'DocFX', desc: '.NET ecosystem standard', icon: FolderGit2 },
  ];

  if (selectedFramework && files.length > 0) {
    return (
      <div className="h-full flex flex-col bg-zinc-950">
        <div className="border-b border-zinc-800 p-6 flex justify-between items-center bg-zinc-900/50">
           <div className="flex items-center gap-4">
              <Button variant="secondary" size="sm" onClick={() => setSelectedFramework(null)}>
                BACK
              </Button>
              <div className="h-6 w-px bg-zinc-800"></div>
              <div>
                <h2 className="text-xs font-mono text-zinc-500 uppercase tracking-widest">Target Framework</h2>
                <h1 className="text-lg font-bold text-white font-mono">{selectedFramework}</h1>
              </div>
           </div>
           <Button onClick={() => onStartDrafting(selectedFramework, files)} icon={<ChevronRight className="w-4 h-4"/>}>
            INITIALIZE EDITOR
           </Button>
        </div>

        <div className="flex-1 overflow-auto p-4 md:p-8">
           <div className="max-w-4xl mx-auto">
             <div className="flex items-center justify-between mb-4">
                <h3 className="text-xs font-mono text-zinc-400 uppercase tracking-wider flex items-center gap-2">
                  <List className="w-4 h-4" /> Proposed File Structure
                </h3>
                <span className="text-xs font-mono text-zinc-600">{files.length} FILES</span>
             </div>

             <div className="border border-zinc-800 bg-zinc-900/50 rounded-sm overflow-hidden">
                {files.map((file, idx) => (
                  <div key={file.id} className="group border-b border-zinc-800 last:border-0 p-4 hover:bg-zinc-900 transition-colors flex gap-4 items-start">
                     <div className="font-mono text-xs text-zinc-600 pt-3 min-w-[24px]">
                       {String(idx + 1).padStart(2, '0')}
                     </div>
                     <div className="flex-grow">
                        <input 
                          value={file.path}
                          onChange={(e) => {
                            const newFiles = [...files];
                            newFiles[idx].path = e.target.value;
                            setFiles(newFiles);
                          }}
                          className="bg-transparent text-sm font-bold text-zinc-200 focus:text-accent focus:outline-none w-full mb-1 font-mono tracking-tight"
                          placeholder="path/to/file.md"
                        />
                        <input 
                             value={file.description}
                             onChange={(e) => {
                              const newFiles = [...files];
                              newFiles[idx].description = e.target.value;
                              setFiles(newFiles);
                            }}
                             className="bg-zinc-950/50 border-none p-0 w-full text-xs text-zinc-500 font-mono focus:outline-none focus:text-zinc-300"
                             placeholder="File purpose..."
                        />
                     </div>
                     <button 
                       className="opacity-0 group-hover:opacity-100 text-zinc-600 hover:text-red-500 transition-all p-2"
                       onClick={() => {
                         setFiles(files.filter(f => f.id !== file.id));
                       }}
                     >
                        <X className="w-4 h-4" />
                     </button>
                  </div>
                ))}
                
                <button 
                  onClick={() => {
                    setFiles([...files, {
                      id: Math.random().toString(),
                      path: 'new-page.md',
                      title: 'New Page',
                      description: 'Custom page',
                      sections: [],
                      isLoaded: false
                    }]);
                  }}
                  className="w-full py-3 bg-zinc-900 hover:bg-zinc-800 text-zinc-500 hover:text-accent font-mono text-xs uppercase flex items-center justify-center gap-2 transition-colors"
                >
                  <Plus className="w-3 h-3" /> Add File
                </button>
             </div>
           </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 bg-zinc-950">
      <div className="max-w-4xl w-full">
        <h2 className="text-xs font-mono text-accent uppercase tracking-widest mb-4">Phase 2: Configuration</h2>
        <h1 className="text-3xl font-bold text-white mb-8 tracking-tight">Select System Architecture</h1>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {frameworks.map((fw) => {
            const Icon = fw.icon;
            return (
              <button
                key={fw.type}
                onClick={() => handleSelectFramework(fw.type)}
                disabled={structureLoading}
                className={`
                  group relative border p-6 text-left transition-all h-40 flex flex-col justify-between
                  ${selectedFramework === fw.type 
                    ? 'bg-zinc-900 border-accent' 
                    : 'bg-zinc-900/30 border-zinc-800 hover:border-zinc-600 hover:bg-zinc-900'
                  }
                `}
              >
                <div className="flex justify-between items-start">
                  <Icon className={`w-8 h-8 ${selectedFramework === fw.type ? 'text-accent' : 'text-zinc-600 group-hover:text-zinc-400'}`} />
                  {structureLoading && selectedFramework === fw.type && <RefreshCw className="w-4 h-4 animate-spin text-accent" />}
                </div>
                <div>
                  <h3 className="font-mono text-sm font-bold text-white mb-1">{fw.label}</h3>
                  <p className="text-[10px] text-zinc-500 font-mono uppercase leading-tight">{fw.desc}</p>
                </div>
                
                {/* Corner accent */}
                <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-transparent group-hover:border-accent/50 transition-colors"></div>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
};
