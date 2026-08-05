import { AlertCircle, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";

type Props = {
  message: string;
  onRetry?: () => void;
  onDismiss?: () => void;
};

export function UploadErrorBanner({ message, onRetry, onDismiss }: Props) {
  return (
    <div
      role="alert"
      className="rounded-2xl border border-rose-200/80 dark:border-rose-900/40 bg-rose-50 dark:bg-rose-950/20 p-4 flex items-start gap-3"
    >
      <AlertCircle className="size-4 text-rose-500 mt-0.5 shrink-0" aria-hidden />
      <div className="min-w-0 flex-1">
        <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-rose-700 dark:text-rose-300">
          Something went wrong
        </p>
        <p className="mt-1 text-xs text-rose-800/90 dark:text-rose-200/90 leading-relaxed">
          {message}
        </p>
        <div className="mt-3 flex flex-wrap gap-2">
          {onRetry ? (
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
              <RotateCcw className="size-3.5" />
              Retry
            </Button>
          ) : null}
          {onDismiss ? (
            <Button type="button" size="sm" variant="ghost" onClick={onDismiss}>
              Dismiss
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  );
}
