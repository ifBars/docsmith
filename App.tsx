import React, { useState, useRef } from 'react';
import { AppStep, DocFramework, RepoContext, DocFile, FileSummary } from './types';
import { RepoInput, LoadingState, AnalysisStep, LogEntry } from './components/RepoInput';
import { AnalysisView } from './components/AnalysisView';
import { DocPlanner } from './components/DocPlanner';
import { DocEditor } from './components/DocEditor';
import { fetchRepoData } from './services/mockGithubService';
import { analyzeRepo, proposeFileStructure } from './services/geminiService';
import { SquareTerminal, FileSearch, Edit3, Settings, Github, Command } from 'lucide-react';

const App: React.FC = () => {
  const [step, setStep] = useState<AppStep>(AppStep.LANDING);
  const [loadingState, setLoadingState] = useState<LoadingState | null>(null);
  
  // Data State
  const [repoContext, setRepoContext] = useState<RepoContext | null>(null);
  const [activeFramework, setActiveFramework] = useState<DocFramework | null>(null);
  const [projectFiles, setProjectFiles] = useState<DocFile[]>([]);
  const [sourceFiles, setSourceFiles] = useState<FileSummary[]>([]);

  // We need refs to access current state inside intervals without dependencies
  const logsRef = useRef<LogEntry[]>([]);
  const progressRef = useRef<number>(0);

  // Helper to update loading state safely
  const updateLoading = (status: string, step: AnalysisStep, progress: number, newLog?: string) => {
    progressRef.current = progress;
    if (newLog) {
      logsRef.current = [...logsRef.current, {
        message: newLog,
        timestamp: new Date().toLocaleTimeString('en-US', {hour12: false, hour: "2-digit", minute:"2-digit", second:"2-digit"})
      }];
    }
    
    setLoadingState({
      status,
      currentStep: step,
      progress: progressRef.current,
      logs: logsRef.current
    });
  };

  const handleAnalyze = async (url: string) => {
    // Reset
    logsRef.current = [];
    progressRef.current = 0;
    setSourceFiles([]);
    setRepoContext(null); // Clear previous context
    
    // Phase 1: Connection
    updateLoading("Initializing secure connection...", 'CONNECT', 5, "Resolving host github.com...");
    
    try {
      await new Promise(resolve => setTimeout(resolve, 600));
      updateLoading("Handshake successful", 'CONNECT', 10, "Connection established via HTTPS/TLS 1.3");

      // Phase 2: Fetch
      updateLoading("Retrieving repository metadata...", 'FETCH', 15, `Targeting repository: ${url}`);
      const repoData = await fetchRepoData(url);
      setSourceFiles(repoData.files); // Store raw files
      
      updateLoading("Processing source files...", 'FETCH', 25, `Successfully retrieved ${repoData.files.length} candidate files.`);
      await new Promise(resolve => setTimeout(resolve, 500));
      
      const totalChars = repoData.files.reduce((acc, f) => acc + f.contentSnippet.length, 0);
      updateLoading("Tokenizing content...", 'FETCH', 30, `Loaded ${Math.round(totalChars / 4)} tokens into context buffer.`);
      
      // Phase 3: AI Analysis (Real-time updates via Tool Calls)
      updateLoading("Gemini 3 Pro Reasoning Engine engaged...", 'ANALYZE', 35, "Initializing analysis context window...");
      
      // We initialize context immediately so we can render the view
      const initialContext: RepoContext = {
        summary: "",
        techStack: [],
        entryPoints: [],
        keyModules: [],
        workflows: [],
        artifacts: { projectOverview: "", gettingStarted: "", architecture: "", commonTasks: "" },
        benchmarks: [],
        vectorIndex: [],
        referenceRepos: []
      };
      setRepoContext(initialContext);

      // Streaming Analysis Call
      const finalAnalysis = await analyzeRepo(
        repoData.files, 
        (status, progress) => {
          // Progress Callback
          let normalizedProgress = 35;
          // Scale 0-100 from service to 35-100 in UI
          normalizedProgress = 35 + Math.floor(progress * 0.65);
          updateLoading(status, 'ANALYZE', normalizedProgress, status);
        },
        (partialContext) => {
          // Partial Data Callback - Update UI in real-time
          setRepoContext(prev => prev ? ({ ...prev, ...partialContext }) : partialContext as RepoContext);
        }
      );
      
      // Phase 4: Finalization
      updateLoading("Analysis Complete", 'GENERATE', 100, "Ready for review.");
      await new Promise(resolve => setTimeout(resolve, 400));

      setRepoContext(finalAnalysis);
      setStep(AppStep.OVERVIEW);
    } catch (error) {
      console.error(error);
      const msg = error instanceof Error ? error.message : "Analysis Failed";
      updateLoading("Error", 'CONNECT', 0, `FATAL: ${msg}`);
      alert(msg);
      setLoadingState(null);
    } finally {
      // Don't clear immediately to let the user see "100%" briefly
      setTimeout(() => setLoadingState(null), 200);
    }
  };

  const handleGenerateStructure = async (framework: DocFramework) => {
    if (!repoContext) return [];
    return await proposeFileStructure(framework, repoContext);
  };

  const handleStartDrafting = (framework: DocFramework, files: DocFile[]) => {
    setActiveFramework(framework);
    setProjectFiles(files);
    setStep(AppStep.DRAFTING);
  };

  // Nav Item Component
  const NavItem = ({ icon: Icon, active, onClick }: { icon: any, active?: boolean, onClick?: () => void }) => (
    <button 
      onClick={onClick}
      className={`p-3 w-full flex justify-center mb-2 transition-colors border-l-2 ${
        active 
          ? 'border-accent text-white bg-zinc-900' 
          : 'border-transparent text-zinc-500 hover:text-zinc-300'
      }`}
    >
      <Icon className="w-5 h-5" />
    </button>
  );

  return (
    <div className="flex h-screen bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      
      {/* Activity Bar (Sidebar) */}
      <nav className="w-12 bg-zinc-950 border-r border-zinc-800 flex flex-col items-center py-4 z-20">
        <div className="mb-6">
          <div className="w-8 h-8 bg-accent text-black font-bold flex items-center justify-center font-mono text-xs rounded-sm">
            DS
          </div>
        </div>

        <NavItem 
          icon={SquareTerminal} 
          active={step === AppStep.LANDING} 
          onClick={() => { if(step !== AppStep.LANDING) setStep(AppStep.LANDING) }}
        />
        
        {step !== AppStep.LANDING && (
          <>
            <NavItem 
              icon={FileSearch} 
              active={step === AppStep.OVERVIEW} 
              onClick={() => setStep(AppStep.OVERVIEW)}
            />
            <NavItem 
              icon={Edit3} 
              active={step === AppStep.PLANNING || step === AppStep.DRAFTING} 
              onClick={() => setStep(AppStep.PLANNING)}
            />
          </>
        )}

        <div className="mt-auto">
          <NavItem icon={Github} />
          <NavItem icon={Settings} />
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col min-w-0 bg-zinc-950">
        <div className="flex-1 overflow-hidden relative">
          {step === AppStep.LANDING && (
            <RepoInput onAnalyze={handleAnalyze} loadingState={loadingState} />
          )}

          {step === AppStep.OVERVIEW && repoContext && (
            <AnalysisView 
              context={repoContext} 
              onNext={() => setStep(AppStep.PLANNING)}
              onUpdateContext={setRepoContext}
            />
          )}

          {step === AppStep.PLANNING && repoContext && (
            <DocPlanner 
              sourceFiles={sourceFiles}
              onGenerateStructure={handleGenerateStructure} 
              onStartDrafting={handleStartDrafting}
              loading={loadingState !== null} 
            />
          )}

          {step === AppStep.DRAFTING && repoContext && activeFramework && (
            <DocEditor 
              framework={activeFramework} 
              initialFiles={projectFiles} 
              context={repoContext}
              onBack={() => setStep(AppStep.PLANNING)}
            />
          )}
        </div>
        
        {/* Status Bar (Only visible if not inside Editor, as Editor has its own) */}
        {step !== AppStep.DRAFTING && (
          <div className="h-6 bg-accent text-black flex items-center px-4 text-[10px] font-bold tracking-wider select-none justify-between z-10">
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1"><Command className="w-3 h-3"/> DOCSMITH STUDIO</span>
              {repoContext && <span className="opacity-75">REPO CONNECTED</span>}
            </div>
            <div>
              v1.2.0 (MULTI-FILE SUPPORT)
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default App;