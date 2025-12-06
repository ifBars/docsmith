
import React, { useState } from 'react';
import { RepoContext } from '../types';
import { Button } from './ui/Button';
import { Box, Play, ArrowRight, Cpu, FileJson, CheckCircle2, AlertCircle, Target } from 'lucide-react';

interface AnalysisViewProps {
  context: RepoContext;
  onNext: () => void;
}

export const AnalysisView: React.FC<AnalysisViewProps> = ({ context, onNext }) => {
  const [showBenchmarks, setShowBenchmarks] = useState(true);

  // Safety checks
  const modules = context.keyModules || [];
  const workflows = context.workflows || [];
  const stack = context.techStack || [];
  const benchmarks = context.benchmarks || [];

  return (
    <div className="h-full flex flex-col bg-zinc-950">
      {/* Header Panel */}
      <div className="border-b border-zinc-800 p-6 flex justify-between items-end bg-zinc-900/50">
        <div>
          <h2 className="text-xs font-mono text-accent uppercase tracking-widest mb-2">Phase 1: Analysis Complete</h2>
          <h1 className="text-2xl font-bold text-white tracking-tight">System Specifications</h1>
        </div>
        <Button onClick={onNext} icon={<ArrowRight className="w-4 h-4" />}>
          PROCEED TO PLANNING
        </Button>
      </div>

      <div className="flex-1 overflow-auto p-0 md:p-8">
        <div className="max-w-7xl mx-auto border border-zinc-800 bg-zinc-900">
          
          {/* Top Grid: Summary & Stack */}
          <div className="grid grid-cols-1 lg:grid-cols-3 border-b border-zinc-800">
            <div className="col-span-2 p-8 border-b lg:border-b-0 lg:border-r border-zinc-800">
              <div className="flex items-center gap-2 text-zinc-500 mb-4 font-mono text-xs uppercase">
                <CheckCircle2 className="w-4 h-4 text-green-500" /> Executive Summary
              </div>
              <p className="text-zinc-300 leading-relaxed font-light text-lg">
                {context.summary}
              </p>
            </div>
            <div className="p-8 bg-zinc-950/30">
              <div className="flex items-center gap-2 text-zinc-500 mb-4 font-mono text-xs uppercase">
                <Cpu className="w-4 h-4" /> Tech Stack
              </div>
              <div className="flex flex-wrap gap-2">
                {stack.map(tech => (
                  <span key={tech} className="px-3 py-1 bg-zinc-800 border border-zinc-700 text-zinc-300 font-mono text-xs">
                    {tech}
                  </span>
                ))}
                {stack.length === 0 && <span className="text-zinc-600 italic text-xs">No stack detected</span>}
              </div>
            </div>
          </div>

          {/* Verification Benchmarks */}
          <div className="p-8 border-b border-zinc-800 bg-zinc-900/50">
             <div 
               className="flex items-center justify-between cursor-pointer"
               onClick={() => setShowBenchmarks(!showBenchmarks)}
             >
               <div className="flex items-center gap-2 text-zinc-400 font-mono text-xs uppercase">
                  <Target className={`w-4 h-4 ${showBenchmarks ? 'text-accent' : 'text-zinc-600'}`} /> 
                  AI Context Verification (Benchmarks)
               </div>
               <span className="text-xs text-zinc-600 underline">{showBenchmarks ? 'Hide' : 'Show Results'}</span>
             </div>
             
             {showBenchmarks && benchmarks.length > 0 && (
               <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-6 animate-in slide-in-from-top-2 fade-in duration-300">
                  {benchmarks.map((bm, i) => (
                    <div key={i} className="bg-zinc-950 border border-zinc-800 p-5 rounded-sm relative group">
                       <div className="absolute top-0 right-0 p-2 opacity-10 font-black text-4xl text-zinc-700">{i+1}</div>
                       <h3 className="text-accent text-xs font-bold mb-3 pr-4 uppercase tracking-wider">Q: {bm.question}</h3>
                       <p className="text-zinc-400 text-sm leading-relaxed border-t border-zinc-800 pt-3">{bm.answer}</p>
                    </div>
                  ))}
               </div>
             )}
          </div>

          {/* Middle Grid: Modules & Workflows */}
          <div className="grid grid-cols-1 md:grid-cols-2 border-b border-zinc-800">
            {/* Key Modules */}
            <div className="border-r border-zinc-800">
               <div className="bg-zinc-950/50 p-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-500 uppercase flex items-center gap-2">
                    <Box className="w-3 h-3" /> Core Modules
                  </span>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5">{modules.length}</span>
               </div>
               <div className="divide-y divide-zinc-800/50 max-h-96 overflow-y-auto">
                  {modules.map((mod, i) => (
                    <div key={i} className="p-4 hover:bg-zinc-800/20 transition-colors">
                      <div className="font-mono text-sm text-accent mb-1">{mod.name}</div>
                      <div className="text-xs text-zinc-500">{mod.responsibility}</div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Workflows */}
            <div>
               <div className="bg-zinc-950/50 p-3 border-b border-zinc-800 flex items-center justify-between">
                  <span className="font-mono text-xs text-zinc-500 uppercase flex items-center gap-2">
                    <Play className="w-3 h-3" /> User Journeys
                  </span>
                  <span className="text-xs bg-zinc-800 text-zinc-400 px-1.5">{workflows.length}</span>
               </div>
               <div className="p-4">
                 <ul className="space-y-4">
                    {workflows.map((flow, i) => (
                      <li key={i} className="flex gap-3 text-sm">
                        <span className="font-mono text-zinc-600">0{i+1}</span>
                        <span className="text-zinc-300">{flow}</span>
                      </li>
                    ))}
                 </ul>
               </div>
            </div>
          </div>

          {/* Bottom Grid: Artifacts Raw View */}
          <div className="p-0">
             <div className="bg-zinc-950/50 p-3 border-b border-zinc-800 flex items-center gap-2">
                <FileJson className="w-3 h-3 text-zinc-500" />
                <span className="font-mono text-xs text-zinc-500 uppercase">Analysis Artifacts (Read-Only)</span>
             </div>
             <div className="grid grid-cols-1 lg:grid-cols-2 text-xs font-mono text-zinc-500">
                <div className="p-4 border-b lg:border-b-0 lg:border-r border-zinc-800 max-h-64 overflow-y-auto">
                   <strong className="block text-zinc-300 mb-2"># Project Overview</strong>
                   {context.artifacts.projectOverview}
                </div>
                <div className="p-4 max-h-64 overflow-y-auto">
                   <strong className="block text-zinc-300 mb-2"># Architecture</strong>
                   {context.artifacts.architecture}
                </div>
             </div>
          </div>

        </div>
      </div>
    </div>
  );
};
