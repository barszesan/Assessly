import { useState, useEffect } from "react";
import { PositionCard } from "@/components/positions/PositionCard";
import { DeletePositionDialog } from "@/components/positions/DeletePositionDialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import type { Position } from "@/types";
import { Plus } from "lucide-react";

async function loadPositions(): Promise<Position[]> {
  const res = await fetch("/api/positions/");
  if (!res.ok) throw new Error("Failed to fetch positions");
  return (await res.json()) as Position[];
}

export function PositionList() {
  const [positions, setPositions] = useState<Position[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState<Position | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadPositions()
      .then((data) => {
        if (!cancelled) setPositions(data);
      })
      .catch(() => {
        if (!cancelled) toast.error("Failed to load positions");
      })
      .finally(() => {
        if (!cancelled) setIsLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  async function handleDelete() {
    if (!deleteTarget) return;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/positions/${deleteTarget.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed to delete position");
      setPositions((prev) => prev.filter((p) => p.id !== deleteTarget.id));
      toast.success(`"${deleteTarget.title}" deleted`);
      setDeleteTarget(null);
    } catch {
      toast.error("Failed to delete position");
    } finally {
      setIsDeleting(false);
    }
  }

  function handleEdit(id: string) {
    window.location.href = `/positions/${id}/edit`;
  }

  if (isLoading) {
    return (
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="bg-muted h-48 animate-pulse rounded-xl border" />
        ))}
      </div>
    );
  }

  if (positions.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
        <p className="text-muted-foreground text-lg">No positions yet</p>
        <p className="text-muted-foreground text-sm">Create your first position to get started</p>
        <Button asChild>
          <a href="/positions/new">
            <Plus className="size-4" />
            Create your first position
          </a>
        </Button>
      </div>
    );
  }

  return (
    <>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
        {positions.map((position) => (
          <PositionCard
            key={position.id}
            position={position}
            onDelete={(id) => {
              const target = positions.find((p) => p.id === id);
              if (target) setDeleteTarget(target);
            }}
            onEdit={handleEdit}
          />
        ))}
      </div>

      <DeletePositionDialog
        open={!!deleteTarget}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        positionTitle={deleteTarget?.title ?? ""}
        onConfirm={handleDelete}
        isDeleting={isDeleting}
      />
    </>
  );
}
