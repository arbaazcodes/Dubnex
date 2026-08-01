import React, { useRef, useEffect } from 'react';
import { Play, Check, AlertCircle, Cpu, Loader2, FileCode, RefreshCw } from 'lucide-react';
import { Project } from '../../types';

interface PipelineWorkflowProps {
  project: Project | null;
  onRetry?: (projectId: string) => void;
}

const steps = [
  { step: 1, name: 'Upload Video', desc: 'Secure local upload & sanitization check' },
  { step: 2, name: 'Extract Audio', desc: 'Separate stereo stream with FFmpeg codec copy' },
  { step: 3, name: 'Detect Language', desc: 'Acoustic spoken language auto-identification' },
  { step: 4, name: 'Speech Recognition', desc: 'Faster Whisper model multi-speaker diarization' },
  { step: 5, name: 'Generate Transcript', desc: 'Build word-level timestamps and speaker map' },
  { step: 6, name: 'Translate', desc: 'Meta NLLB-200 context translation passes' },
  { step: 7, name: 'Voice Clone', desc: 'Cloning vocal timbres via CosyVoice zero-shot' },
  { step: 8, name: 'Merge Audio', desc: 'Multiplexing newly dubbed audio track' },
  { step: 9, name: 'Render Video', desc: 'Render final output file stream and cache' }
];

export default function PipelineWorkflow({ project, onRetry }: PipelineWorkflowProps) {
  const terminalEndRef = useRef<HTMLDivElement>(null);

  // Auto scroll terminal logs to bottom on update
  useEffect(() => {
    if (terminalEndRef.current) {
      terminalEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [project?.logs]);

  if (!project) {
    return (
      <div 
        className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800 rounded-2xl p-8 text-center shadow-sm dark:shadow-none" 
        id="empty-pipeline-workflow"
      >
        <p className="text-sm text-zinc-500 dark:text-zinc-400">Select or start a translation project to view the active processing pipeline.</p>
      </div>
    );
  }

  // Map project status to active step index
  const getActiveStepIndex = (status: string) => {
    switch (status) {
      case 'Uploading': return 1;
      case 'Extract Audio': return 2;
      case 'Detect Language': return 3;
      case 'Speech Recognition': return 4;
      case 'Generate Transcript': return 5;
      case 'Translate': return 6;
      case 'Voice Clone': return 7;
      case 'Merge Audio': return 8;
      case 'Render Video': return 9;
      case 'Completed': return 10;
      case 'Failed': return -1;
      default: return 1;
    }
  };

  const activeStepIndex = getActiveStepIndex(project.status);

  return (
    <div 
      className="bg-white dark:bg-zinc-900/60 backdrop-blur-md border border-zinc-200 dark:border-zinc-800/80 rounded-2xl p-6 space-y-6 transition-all shadow-sm dark:shadow-none" 
      id={`pipeline-workflow-${project.id}`}
    >
      {/* Failure Banner with retry */}
      {project.status === 'Failed' && (
        <div className="bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/30 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-rose-500 mt-0.5 flex-shrink-0" />
            <div>
              <h4 className="text-sm font-bold text-rose-900 dark:text-rose-400">Pipeline Failed at "{project.failedStep || 'Voice Clone'}"</h4>
              <p className="text-xs text-rose-700 dark:text-rose-350 mt-0.5">{project.failureReason || 'An unexpected socket exception occurred.'}</p>
            </div>
          </div>
          <button
            onClick={() => onRetry && onRetry(project.id)}
            className="bg-rose-600 hover:bg-rose-700 text-white font-semibold text-xs px-4 py-2 rounded-lg cursor-pointer transition-all flex items-center gap-1.5 shadow-sm hover:shadow-rose-500/20 whitespace-nowrap"
          >
            <RefreshCw className="w-3.5 h-3.5 animate-spin" style={{ animationDuration: '4s' }} />
            <span>Retry Step</span>
          </button>
        </div>
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-zinc-100 dark:border-zinc-800/80 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-md font-bold text-zinc-900 dark:text-white tracking-tight">{project.title}</h3>
            <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold ${
              project.status === 'Completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20' :
              project.status === 'Failed' ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20' :
              'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20 animate-pulse'
            }`}>
              {project.status}
            </span>
          </div>
          <p className="text-xs text-zinc-500 dark:text-zinc-400 mt-1">
            Pipeline Engine: <span className="text-zinc-800 dark:text-zinc-200 font-semibold">{project.voiceSettings.voiceName} ({project.voiceSettings.gender})</span> • Source Language: <span className="text-zinc-800 dark:text-zinc-300 font-semibold uppercase">{project.originalLanguage}</span> • Target: <span className="text-emerald-600 dark:text-emerald-400 font-semibold uppercase">{project.targetLanguage}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 flex-shrink-0">
          <div className="text-right">
            <span className="text-xs text-zinc-400 dark:text-zinc-500 block">Progress</span>
            <span className="text-lg font-bold text-zinc-900 dark:text-white font-mono">{project.progress}%</span>
          </div>
          <div className="w-16 h-2 bg-zinc-200 dark:bg-zinc-800 rounded-full overflow-hidden">
            <div 
              className={`h-full transition-all duration-500 ${project.status === 'Failed' ? 'bg-rose-500' : 'bg-emerald-500'}`} 
              style={{ width: `${project.progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Grid of 9 Steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3" id="pipeline-steps-grid">
        {steps.map((s) => {
          let stepStatus: 'pending' | 'processing' | 'completed' | 'failed' = 'pending';
          
          if (project.status === 'Failed' && s.name === project.failedStep) {
            stepStatus = 'failed';
          } else if (project.status === 'Failed' && s.step < getActiveStepIndex(project.failedStep || 'Voice Clone')) {
            stepStatus = 'completed';
          } else if (s.step < activeStepIndex) {
            stepStatus = 'completed';
          } else if (s.step === activeStepIndex) {
            stepStatus = project.status === 'Completed' ? 'completed' : 'processing';
          }

          return (
            <div 
              key={s.step} 
              className={`p-3 rounded-xl border transition-all relative overflow-hidden ${
                stepStatus === 'completed' ? 'bg-emerald-500/[0.01] dark:bg-emerald-500/[0.02] border-emerald-500/20 dark:border-emerald-500/20' :
                stepStatus === 'processing' ? 'bg-blue-500/[0.02] dark:bg-blue-500/[0.04] border-blue-500/40 dark:border-blue-500/40 shadow-[0_0_15px_-3px_rgba(59,130,246,0.12)]' :
                stepStatus === 'failed' ? 'bg-rose-500/[0.01] dark:bg-rose-500/[0.02] border-rose-500/30 dark:border-rose-500/30' :
                'bg-zinc-50/50 dark:bg-zinc-950/20 border-zinc-200 dark:border-zinc-800/60 opacity-60'
              }`}
            >
              {/* Step indicator glow */}
              {stepStatus === 'processing' && (
                <div className="absolute top-0 right-0 w-2 h-2 bg-blue-500 rounded-full animate-ping m-2" />
              )}

              <div className="flex items-start gap-2.5">
                <div className={`mt-0.5 flex-shrink-0 w-5 h-5 rounded-md flex items-center justify-center text-[10px] font-mono font-bold ${
                  stepStatus === 'completed' ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' :
                  stepStatus === 'processing' ? 'bg-blue-500/20 text-blue-600 dark:text-blue-400 animate-pulse' :
                  stepStatus === 'failed' ? 'bg-rose-500/20 text-rose-600 dark:text-rose-400' :
                  'bg-zinc-200 dark:bg-zinc-800 text-zinc-500 dark:text-zinc-400'
                }`}>
                  {stepStatus === 'completed' ? <Check className="w-3.5 h-3.5 animate-bounce-slow" /> : s.step}
                </div>
                <div className="min-w-0">
                  <h4 className={`text-xs font-bold ${stepStatus === 'completed' ? 'text-zinc-700 dark:text-zinc-300' : stepStatus === 'processing' ? 'text-blue-600 dark:text-blue-300 font-bold' : stepStatus === 'failed' ? 'text-rose-600 dark:text-rose-400' : 'text-zinc-500 dark:text-zinc-400'}`}>
                    {s.name}
                  </h4>
                  <p className="text-[10px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">{s.desc}</p>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Real-time Telemetry & Container Logs */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono text-zinc-500 dark:text-zinc-400">
          <div className="flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5 text-blue-500 animate-pulse" />
            <span>CONTAINER TELEMETRY • SPEECH PIPELINE</span>
          </div>
          <span>ID: {project.id}</span>
        </div>
        <div className="bg-zinc-950 border border-zinc-800 dark:border-zinc-800 rounded-xl p-4 font-mono text-[11px] leading-relaxed text-zinc-300 h-40 overflow-y-auto shadow-inner space-y-1">
          {project.logs.map((log) => (
            <div key={log.id} className="flex items-start gap-2 hover:bg-zinc-900/50 py-0.5 px-1 rounded transition-colors">
              <span className="text-zinc-600 select-none">[{log.timestamp.split(' ')[1]}]</span>
              <span className={`uppercase font-bold ${
                log.level === 'error' ? 'text-rose-500' : log.level === 'warning' ? 'text-amber-500' : 'text-emerald-500'
              }`}>
                [{log.level}]
              </span>
              {log.step && (
                <span className="text-blue-400 font-semibold bg-blue-950/50 px-1 py-px rounded text-[10px]">
                  {log.step}
                </span>
              )}
              <span className="text-zinc-300">{log.message}</span>
            </div>
          ))}
          <div ref={terminalEndRef} />
        </div>
      </div>
    </div>
  );
}
