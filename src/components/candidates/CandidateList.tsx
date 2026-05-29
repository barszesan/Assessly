import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CvUploadFlow } from "@/components/candidates/CvUploadFlow";
import { DeleteCandidateDialog } from "@/components/candidates/DeleteCandidateDialog";
import { toast } from "sonner";
import { FileText, Trash2, Upload } from "lucide-react";
import type { Candidate } from "@/types";

const MAX_CANDIDATES = 10;
const SNIPPET_CHARS = 140;

interface CandidateListProps {
  positionId: string;
}

interface ListResponse {
  candidates: Candidate[];
}

interface ErrorResponse {
  error?: string;
}

async function parseError(res: Response): Promise<string> {
  try {
    const data = (await res.json()) as ErrorResponse;
    return data.error ?? `Request failed (${res.status.toString()})`;
  } catch {
    return `Request failed (${res.status.toString()})`;
  }
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

function snippet(text: string | null): string {
  if (!text) return "No extracted text";
  const trimmed = text.trim();
  if (trimmed.length <= SNIPPET_CHARS) return trimmed;
  return `${trimmed.slice(0, SNIPPET_CHARS)}…`;
}

export function CandidateList({ positionId }: CandidateListProps) {
  const [candidates, setCandidates] = useState<Candidate[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [reloadToken, setReloadToken] = useState(0);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState<Candidate | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/positions/${positionId}/candidates`)
      .then(async (res) => {
        if (!res.ok) {
          const msg = await parseError(res);
          if (!cancelled) setLoadError(msg);
          return;
        }
        const data = (await res.json()) as ListResponse;
        if (!cancelled) {
          setCandidates(data.candidates);
          setLoadError(null);
        }
      })
      .catch(() => {
        if (!cancelled) setLoadError("Failed to load candidates");
      });
    return () => {
      cancelled = true;
    };
  }, [positionId, reloadToken]);

  function refetch() {
    setCandidates(null);
    setLoadError(null);
    setReloadToken((n) => n + 1);
  }

  async function handleDelete() {
    if (!deleteTarget) return;
    const target = deleteTarget;
    setIsDeleting(true);
    // Optimistic removal.
    const snapshot = candidates;
    setCandidates((prev) => (prev ? prev.filter((c) => c.id !== target.id) : prev));
    try {
      const res = await fetch(`/api/positions/${positionId}/candidates?candidateId=${encodeURIComponent(target.id)}`, {
        method: "DELETE",
      });
      if (!res.ok) {
        // Roll back.
        setCandidates(snapshot);
        toast.error(await parseError(res));
        return;
      }
      toast.success(`Removed "${target.file_name}"`);
    } catch {
      setCandidates(snapshot);
      toast.error("Failed to delete candidate");
    } finally {
      setIsDeleting(false);
      setDeleteTarget(null);
    }
  }

  function handleUploadComplete() {
    setUploadOpen(false);
    refetch();
  }

  if (candidates === null && loadError === null) {
    return (
      <div className="space-y-2">
        <div className="bg-muted h-16 animate-pulse rounded-lg" />
        <div className="bg-muted h-16 animate-pulse rounded-lg" />
      </div>
    );
  }

  if (loadError !== null) {
    return (
      <div className="rounded-lg border border-dashed p-6 text-center">
        <p className="text-destructive text-sm">{loadError}</p>
        <Button
          variant="outline"
          size="sm"
          className="mt-3"
          onClick={() => {
            refetch();
          }}
        >
          Retry
        </Button>
      </div>
    );
  }

  const list = candidates ?? [];
  const remainingSlots = Math.max(0, MAX_CANDIDATES - list.length);
  const existingFileNames = list.map((c) => c.file_name);

  return (
    <>
      {list.length === 0 ? (
        <div className="rounded-lg border border-dashed p-6 text-center">
          <p className="text-muted-foreground text-sm">No candidates uploaded yet</p>
          <Button
            className="mt-3"
            onClick={() => {
              setUploadOpen(true);
            }}
          >
            <Upload className="size-4" />
            Upload CVs
          </Button>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-muted-foreground text-xs">
              {list.length.toString()} of {MAX_CANDIDATES.toString()} candidates
            </p>
            <Button
              size="sm"
              onClick={() => {
                setUploadOpen(true);
              }}
              disabled={remainingSlots === 0}
            >
              <Upload className="size-4" />
              Upload CVs
            </Button>
          </div>
          {list.map((candidate) => (
            <Card key={candidate.id}>
              <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
                <div className="flex min-w-0 flex-1 items-start gap-2">
                  <FileText className="text-muted-foreground mt-0.5 size-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium" title={candidate.file_name}>
                      {candidate.file_name}
                    </p>
                    <p className="text-muted-foreground mt-0.5 text-xs">Uploaded {formatDate(candidate.created_at)}</p>
                  </div>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => {
                    setDeleteTarget(candidate);
                  }}
                  aria-label={`Delete ${candidate.file_name}`}
                >
                  <Trash2 className="text-destructive size-4" />
                </Button>
              </CardHeader>
              <CardContent>
                <p className="text-muted-foreground line-clamp-2 text-xs whitespace-pre-wrap">
                  {snippet(candidate.extracted_text)}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={uploadOpen} onOpenChange={setUploadOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>Upload CVs</DialogTitle>
            <DialogDescription>
              Select PDF files to upload. Text is extracted in your browser so you can review it before saving.
            </DialogDescription>
          </DialogHeader>
          <CvUploadFlow
            positionId={positionId}
            existingCount={list.length}
            existingFileNames={existingFileNames}
            onComplete={handleUploadComplete}
            onCancel={() => {
              setUploadOpen(false);
            }}
          />
        </DialogContent>
      </Dialog>

      <DeleteCandidateDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open) setDeleteTarget(null);
        }}
        fileName={deleteTarget?.file_name ?? ""}
        onConfirm={() => {
          void handleDelete();
        }}
        isDeleting={isDeleting}
      />
    </>
  );
}
