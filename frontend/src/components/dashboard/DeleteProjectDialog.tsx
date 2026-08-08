// DeleteProjectDialog — confirmation for the permanent deletion of a project.
// Requirements: clearly state what will be deleted, that it cannot be undone,
// and separate Cancel / destructive Delete actions (no browser confirm()).
import { AlertTriangle, Loader2 } from 'lucide-react';
import { Button } from '../ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '../ui/dialog';

interface DeleteProjectDialogProps {
  open: boolean;
  projectTitle: string;
  isDeleting: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}

export default function DeleteProjectDialog({
  open,
  projectTitle,
  isDeleting,
  onCancel,
  onConfirm,
}: DeleteProjectDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !next && !isDeleting && onCancel()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex items-center gap-2.5 text-rose-600 dark:text-rose-400">
            <AlertTriangle className="h-5 w-5" aria-hidden />
            <DialogTitle className="text-base font-semibold">Delete project?</DialogTitle>
          </div>
          <DialogDescription className="pt-1">
            <span className="block font-medium text-zinc-800 dark:text-zinc-200">
              “{projectTitle || 'Untitled project'}” will be permanently deleted.
            </span>
            <span className="mt-1.5 block">
              This removes the project record and its generated video and audio files.
              This action <strong>cannot be undone</strong>.
            </span>
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={isDeleting}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? (
              <>
                <Loader2 className="animate-spin" aria-hidden />
                Deleting…
              </>
            ) : (
              'Delete Project'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
