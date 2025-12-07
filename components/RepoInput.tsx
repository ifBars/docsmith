import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Terminal, Command, Hash, Loader2 } from 'lucide-react';

export type AnalysisStep = 'CONNECT' | 'FETCH' | 'ANALYZE' | 'GENERATE';

export interface LoadingState {
  status: string;
  progress: number;
  currentStep: AnalysisStep;
  logs: string[];
}

interface RepoInputProps {
  onAnalyze: (url: string) => void;
  loadingState: LoadingState | null;
}

export const RepoInput: React.FC<RepoInputProps> = ({ onAnalyze, loadingState }) => {
  const [url, setUrl] = useState('');
  const logContainerRef = useRef<HTMLDivElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (url.trim()) onAnalyze(url);
  };

  // Auto-scroll logs
  useEffect(() => {
    if (logContainerRef.current) {
      logContainerRef.current.scrollTop = logContainerRef.current.scrollHeight;
    }
  }, [loadingState?.logs]);

  const isLoading = loadingState !== null;

  const steps: { id: AnalysisStep; label: string }[] = [
    { id: 'CONNECT', label: 'Connection' },
    { id: 'FETCH', label: 'Retrieval' },
    { id: 'ANALYZE', label: 'Analysis' },
    { id: 'GENERATE', label: 'Synthesis' }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
      {/* Background Grid Pattern */}
      <div className="absolute inset-0 z-0 opacity-[0.03]" 
           style={{ backgroundImage: 'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)', backgroundSize: '40px 40px' }}>
      </div>

      <div className="z-10 w-full max-w-2xl px-6">
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 tracking-tighter">
            DOC<span className="text-zinc-600">SMITH</span>
          </h1>
          <p className="font-mono text-zinc-500 text-sm tracking-wide">
            AUTOMATED DOCUMENTATION INFRASTRUCTURE
          </p>
        </div>

        <div className="bg-zinc-900 border border-zinc-700 p-1 shadow-2xl shadow-black/50 transition-all duration-300">
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-0">
            <div className="flex-grow relative group">
              <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
                <Command className="h-4 w-4 text-zinc-500" />
              </div>
              <input
                type="text"
                className="block w-full h-14 pl-12 pr-4 bg-zinc-950 text-white placeholder-zinc-600 focus:outline-none focus:bg-zinc-900 font-mono text-sm transition-colors border-none disabled:opacity-50"
                placeholder="Paste repository URL..."
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={isLoading}
                autoFocus
              />
            </div>
            
            <Button 
              type="submit" 
              size="lg" 
              className="h-14 md:w-48 rounded-none" 
              loading={isLoading}
              disabled={!url}
              icon={<Hash className="w-4 h-4" />}
            >
              INITIALIZE
            </Button>
          </form>
        </div>

        <div className="mt-8 flex justify-center gap-8 text-xs font-mono text-zinc-600">
           <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-zinc-600"></div> CLEAR DOCUMENTATION</span>
           <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-zinc-600"></div> GEMINI 3 PRO</span>
           <span className="flex items-center gap-2"><div className="w-1.5 h-1.5 bg-zinc-600"></div> MARKDOWN OUTPUT</span>
        </div>

        {loadingState && (
          <div className="mt-12 w-full animate-in fade-in slide-in-from-bottom-4 duration-500 bg-zinc-900/50 border border-zinc-800 p-6 rounded-sm backdrop-blur-sm">
             
             {/* Step Indicator */}
             <div className="flex justify-between mb-8 relative">
                {/* Connecting Line */}
                <div className="absolute top-1/2 left-0 w-full h-px bg-zinc-800 -z-10 -translate-y-1/2"></div>
                
                {steps.map((step, idx) => {
                   const isCompleted = steps.findIndex(s => s.id === loadingState.currentStep) > idx;
                   const isActive = step.id === loadingState.currentStep;
                   
                   return (
                      <div key={step.id} className="flex flex-col items-center bg-zinc-900 px-2">
                         <div className={`
                            w-3 h-3 rounded-full mb-2 transition-all duration-300
                            ${isCompleted ? 'bg-accent scale-110' : isActive ? 'bg-accent animate-pulse scale-125' : 'bg-zinc-800'}
                         `}></div>
                         <span className={`text-[10px] font-mono uppercase tracking-wider ${isActive ? 'text-white' : 'text-zinc-600'}`}>
                           {step.label}
                         </span>
                      </div>
                   )
                })}
             </div>

             <div className="flex justify-between items-end mb-2">
                <div className="flex items-center gap-2 font-mono text-xs text-accent uppercase tracking-wider">
                  <Loader2 className="w-3 h-3 animate-spin" />
                  {loadingState.status}
                </div>
                <div className="font-mono text-xs text-zinc-500">
                  {Math.round(loadingState.progress)}%
                </div>
             </div>
             
             {/* Progress Track */}
             <div className="h-1 w-full bg-zinc-950 border border-zinc-800 relative overflow-hidden mb-6">
                <div 
                  className="h-full bg-accent shadow-[0_0_10px_rgba(245,158,11,0.5)] transition-all duration-300 ease-out relative overflow-hidden"
                  style={{ width: `${loadingState.progress}%` }}
                >
                  {/* Animated texture for liveness */}
                  <div className="absolute inset-0 bg-white/20 w-full h-full animate-[shimmer_2s_infinite] -translate-x-full" 
                       style={{ backgroundImage: 'linear-gradient(90deg, transparent, rgba(255,255,255,0.5), transparent)' }}>
                  </div>
                </div>
             </div>
             
             <style>{`
               @keyframes shimmer {
                 100% { transform: translateX(100%); }
               }
             `}</style>

             {/* Terminal Logs */}
             <div className="bg-zinc-950 border border-zinc-800 p-3 h-32 overflow-hidden flex flex-col font-mono text-[10px] shadow-inner">
                <div className="flex items-center gap-2 border-b border-zinc-900 pb-2 mb-2 text-zinc-500 select-none">
                  <Terminal className="w-3 h-3" />
                  <span>SYSTEM_LOGS</span>
                </div>
                <div ref={logContainerRef} className="overflow-y-auto flex-1 space-y-1 pr-2 scrollbar-thin">
                   {loadingState.logs.map((log, i) => (
                      <div key={i} className="flex gap-2 animate-in fade-in slide-in-from-left-1 duration-200">
                        <span className="text-zinc-600 shrink-0">
                          {new Date().toLocaleTimeString('en-US', {hour12: false, hour: "2-digit", minute:"2-digit", second:"2-digit"})}
                        </span>
                        <span className="text-zinc-400 font-light">{log}</span>
                      </div>
                   ))}
                   <div className="animate-pulse text-accent">_</div>
                </div>
             </div>
          </div>
        )}
      </div>
    </div>
  );
};