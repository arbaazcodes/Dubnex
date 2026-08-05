import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function UploadSkeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("space-y-4 rounded-3xl border border-zinc-200/50 dark:border-zinc-900 p-6", className)}
      aria-busy="true"
      aria-label="Loading upload workspace"
    >
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-8 w-2/3 max-w-sm" />
        <Skeleton className="h-3 w-full max-w-md" />
      </div>
      <Skeleton className="h-40 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-2">
        <Skeleton className="h-10 rounded-xl" />
        <Skeleton className="h-10 rounded-xl" />
      </div>
      <Skeleton className="h-11 w-full rounded-xl" />
    </div>
  );
}

export function ShimmerBlock({ className }: { className?: string }) {
  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-xl bg-zinc-100 dark:bg-zinc-900",
        className
      )}
    >
      <div className="absolute inset-0 -translate-x-full animate-[shimmer_1.4s_infinite] bg-gradient-to-r from-transparent via-white/40 to-transparent dark:via-white/10" />
      <style>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
      `}</style>
    </div>
  );
}
