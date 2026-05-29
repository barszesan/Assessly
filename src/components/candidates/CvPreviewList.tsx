import { Button } from "@/components/ui/button";
import { CvPreviewCard, type CvPreviewItem } from "@/components/candidates/CvPreviewCard";

interface CvPreviewListProps {
  candidates: CvPreviewItem[];
  onRemove: (index: number) => void;
  onUpdateText: (index: number, text: string) => void;
  onConfirm: () => void;
  onCancel: () => void;
  isUploading: boolean;
}

export function CvPreviewList({
  candidates,
  onRemove,
  onUpdateText,
  onConfirm,
  onCancel,
  isUploading,
}: CvPreviewListProps) {
  const confirmable = candidates.filter((c) => c.status !== "failed" && (c.extractedText ?? "").trim().length > 0);
  const canConfirm = confirmable.length > 0 && !isUploading;

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <p className="text-muted-foreground text-sm">
          Review extracted text for each CV. Edit if needed, then confirm to upload {confirmable.length.toString()} of{" "}
          {candidates.length.toString()}.
        </p>
      </div>

      <div className="space-y-3">
        {candidates.map((candidate, index) => (
          <CvPreviewCard
            key={`${candidate.fileName}-${index.toString()}`}
            candidate={candidate}
            onRemove={() => {
              onRemove(index);
            }}
            onUpdateText={(text) => {
              onUpdateText(index, text);
            }}
            disabled={isUploading}
          />
        ))}
      </div>

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onCancel} disabled={isUploading}>
          Cancel
        </Button>
        <Button type="button" onClick={onConfirm} disabled={!canConfirm}>
          {isUploading ? "Uploading..." : `Confirm ${confirmable.length.toString()} CV(s)`}
        </Button>
      </div>
    </div>
  );
}
