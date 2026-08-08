import { motion, useReducedMotion } from "motion/react";
import { CheckCircle2, Download, FolderOpen, Plus } from "lucide-react";
import type { Project } from "@/types";
import { Button } from "@/components/ui/button";
import TranscriptEditor from "@/components/chat/TranscriptEditor";
import type { TranscriptSegment } from "@/types";

type Props = {
  project: Project | null;
  videoSrc: string;
  onDownload: (project: Project) => void | Promise<void>;
  onOpenProject: (project: Project) => void;
  onCreateNew: () => void;
  onSaveTranscript: (
    projectId: string,
    segments: TranscriptSegment[]
  ) => void | Promise<void>;
};

export function CompletionScreen({
  project,
  videoSrc,
  onDownload,
  onOpenProject,
  onCreateNew,
  onSaveTranscript,
}: Props) {
  const reduced = useReducedMotion();

  return (
    <div className="space-y-6">
      <div className="text-center space-y-3">
        <motion.div
          className="mx-auto flex size-16 items-center justify-center rounded-full bg-emerald-500/15 text-emerald-500"
          initial={reduced ? false : { scale: 0.85, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
        >
          <motion.div
            initial={reduced ? false : { scale: 0.6, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.08, duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
          >
            <CheckCircle2 className="size-8" />
          </motion.div>
        </motion.div>
        <div>
          <p className="text-[10px] font-mono font-bold uppercase tracking-widest text-emerald-600 dark:text-emerald-400">
            Ready to download
          </p>
          <h2 className="mt-1 text-xl font-semibold tracking-tight text-zinc-900 dark:text-white">
            {project?.title || "Translated video"}
          </h2>
        </div>
      </div>

      <div className="aspect-video w-full overflow-hidden rounded-2xl border border-zinc-200/50 dark:border-zinc-900 bg-zinc-950">
        <video
          src={videoSrc}
          className="h-full w-full object-contain"
          controls
          autoPlay
          playsInline
        />
      </div>

      {project ? (
        <TranscriptEditor
          project={project}
          onSaveTranscript={(segments) => onSaveTranscript(project.id, segments)}
        />
      ) : null}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
        <Button
          type="button"
          className="h-11 bg-emerald-500 hover:bg-emerald-400 text-zinc-950 font-bold sm:col-span-3"
          disabled={!project}
          onClick={() => project && onDownload(project)}
        >
          <Download className="size-4" />
          Download
        </Button>
        <Button
          type="button"
          variant="outline"
          className="h-10"
          disabled={!project}
          onClick={() => project && onOpenProject(project)}
        >
          <FolderOpen className="size-4" />
          Open Project
        </Button>
        <Button
          type="button"
          variant="secondary"
          className="h-10 sm:col-span-2"
          onClick={onCreateNew}
        >
          <Plus className="size-4" />
          Create New
        </Button>
      </div>
    </div>
  );
}
