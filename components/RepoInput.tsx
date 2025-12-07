import React, { useState, useEffect, useRef } from 'react';
import { Button } from './ui/Button';
import { Terminal, Command, Hash, Loader2 } from 'lucide-react';

export type AnalysisStep = 'CONNECT' | 'FETCH' | 'ANALYZE' | 'GENERATE';

export interface LogEntry {
  message: string;
  timestamp: string;
}

export interface LoadingState {
  status: string;
  progress: number;
  currentStep: AnalysisStep;
  logs: LogEntry[];
}

interface RepoInputProps {
  onAnalyze: (url: string) => void;
  loadingState: LoadingState | null;
}

// Visual Effect Component
const CircuitBackground = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let w = canvas.width = window.innerWidth;
    let h = canvas.height = window.innerHeight;

    const gridSize = 40;
    
    // Data Packets
    interface Packet {
      x: number;
      y: number;
      vx: number;
      vy: number;
      life: number;
      maxLife: number;
      color: string;
      size: number;
    }
    const packets: Packet[] = [];

    const spawnPacket = () => {
       const cols = Math.ceil(w / gridSize);
       const rows = Math.ceil(h / gridSize);
       const isHoriz = Math.random() > 0.5;
       const isAmber = Math.random() > 0.8;
       const color = isAmber ? 'rgba(245, 158, 11, 0.8)' : 'rgba(113, 113, 122, 0.4)'; // Amber or Zinc
       
       if (isHoriz) {
         packets.push({
           x: 0,
           y: Math.floor(Math.random() * rows) * gridSize,
           vx: 3 + Math.random() * 2,
           vy: 0,
           life: 0,
           maxLife: w + 100,
           color,
           size: isAmber ? 2 : 1.5
         });
       } else {
         packets.push({
           x: Math.floor(Math.random() * cols) * gridSize,
           y: 0,
           vx: 0,
           vy: 3 + Math.random() * 2,
           life: 0,
           maxLife: h + 100,
           color,
           size: isAmber ? 2 : 1.5
         });
       }
    };

    const animate = () => {
      ctx.clearRect(0, 0, w, h);
      
      // Calculate mouse grid pos
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;

      // Draw Grid
      ctx.lineWidth = 1;
      
      // Vertical Lines
      for(let x = 0; x <= w; x += gridSize) {
         const dist = Math.abs(x - mx);
         const opacity = Math.max(0.05, 0.5 - (dist / 800)); // Highlight near mouse
         ctx.strokeStyle = `rgba(39, 39, 42, ${opacity})`;
         ctx.beginPath();
         ctx.moveTo(x, 0); ctx.lineTo(x, h);
         ctx.stroke();
      }
      
      // Horizontal Lines
      for(let y = 0; y <= h; y += gridSize) {
         const dist = Math.abs(y - my);
         const opacity = Math.max(0.05, 0.5 - (dist / 800)); // Highlight near mouse
         ctx.strokeStyle = `rgba(39, 39, 42, ${opacity})`;
         ctx.beginPath();
         ctx.moveTo(0, y); ctx.lineTo(w, y);
         ctx.stroke();
      }

      // Spawn packets randomly
      if (Math.random() > 0.95) spawnPacket();

      // Update & Draw Packets
      for(let i = packets.length - 1; i >= 0; i--) {
        const p = packets[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life += Math.abs(p.vx) + Math.abs(p.vy);

        ctx.fillStyle = p.color;
        
        // Glow effect
        ctx.shadowColor = p.color;
        ctx.shadowBlur = 4;
        
        ctx.fillRect(p.x - p.size, p.y - p.size, p.size * 2, p.size * 2);
        
        ctx.shadowBlur = 0; // Reset

        if (p.life > p.maxLife) packets.splice(i, 1);
      }
      
      requestAnimationFrame(animate);
    };
    
    const animId = requestAnimationFrame(animate);
    
    const handleResize = () => {
        w = canvas.width = window.innerWidth;
        h = canvas.height = window.innerHeight;
    }

    const handleMouseMove = (e: MouseEvent) => {
        mouseRef.current = { x: e.clientX, y: e.clientY };
    }

    window.addEventListener('resize', handleResize);
    window.addEventListener('mousemove', handleMouseMove);
    
    return () => {
        cancelAnimationFrame(animId);
        window.removeEventListener('resize', handleResize);
        window.removeEventListener('mousemove', handleMouseMove);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 z-0 pointer-events-none" />;
};

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
  }, [loadingState?.logs.length, loadingState?.status]);

  const isLoading = loadingState !== null;

  const steps: { id: AnalysisStep; label: string }[] = [
    { id: 'CONNECT', label: 'Connection' },
    { id: 'FETCH', label: 'Retrieval' },
    { id: 'ANALYZE', label: 'Analysis' },
    { id: 'GENERATE', label: 'Synthesis' }
  ];

  return (
    <div className="h-full flex flex-col items-center justify-center bg-zinc-950 relative overflow-hidden">
      
      {/* Animated Circuit Background */}
      <CircuitBackground />
      
      {/* Radial Vignette for depth */}
      <div className="absolute inset-0 z-0 pointer-events-none bg-[radial-gradient(circle_at_center,transparent_0%,#09090b_90%)]"></div>

      <div className="z-10 w-full max-w-2xl px-6">
        <div className="mb-12 text-center">
          <h1 className="text-5xl md:text-7xl font-bold text-white mb-2 tracking-tighter">
            DOC<span className="text-zinc-600">SMITH</span>
          </h1>
          <p className="font-mono text-zinc-500 text-sm tracking-wide">
            A documentation workflow that feels like Cursor
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
                          {log.timestamp}
                        </span>
                        <span className="text-zinc-400 font-light">{log.message}</span>
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