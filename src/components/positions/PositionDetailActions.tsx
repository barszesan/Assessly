import { useState } from "react";
import { Button } from "@/components/ui/button";
import { DeletePositionDialog } from "@/components/positions/DeletePositionDialog";
import { toast } from "sonner";
import { Pencil, Trash2 } from "lucide-react";

interface PositionDetailActionsProps {
  positionId: string;
  positionTitle: string;
}

export function PositionDetailActions({ positionId, positionTitle }: PositionDetailActionsProps) {
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/positions/${positionId}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete position");
      toast.success(`"${positionTitle}" deleted`);
      window.location.href = "/positions";
    } catch {
      toast.error("Failed to delete position");
      setIsDeleting(false);
    }
  }

  return (
    <>
      <div className="flex gap-2">
        <Button variant="outline" asChild>
          <a href={`/positions/${positionId}/edit`}>
            <Pencil className="size-4" />
            Edit
          </a>
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            setDeleteOpen(true);
          }}
        >
          <Trash2 className="size-4" />
          Delete
        </Button>
      </div>

      <DeletePositionDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        positionTitle={positionTitle}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}
