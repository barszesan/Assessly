import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface DeletePositionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  positionTitle: string;
  onConfirm: () => void;
  isDeleting: boolean;
}

export function DeletePositionDialog({
  open,
  onOpenChange,
  positionTitle,
  onConfirm,
  isDeleting,
}: DeletePositionDialogProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete Position</DialogTitle>
          <DialogDescription>
            Are you sure you want to delete <strong>{positionTitle}</strong>? This will also remove all associated
            candidates and evaluations. This action cannot be undone.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button
            variant="outline"
            onClick={() => {
              onOpenChange(false);
            }}
            disabled={isDeleting}
          >
            Cancel
          </Button>
          <Button variant="destructive" onClick={onConfirm} disabled={isDeleting}>
            {isDeleting ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
