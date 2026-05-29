import { useState } from "react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { MAX_EXTRACTED_TEXT_CHARS } from "@/lib/schemas/candidate";

export type CvPreviewStatus = "success" | "warning" | "failed";

export interface CvPreviewItem {
  file: File;
  fileName: string;
  extractedText: string | null;
  status: CvPreviewStatus;
  errorMessage?: string;
}

interface CvPreviewCardProps {
  candidate: CvPreviewItem;
  onRemove: () => void;
  onUpdateText: (text: string) => void;
  disabled?: boolean;
}

const PREVIEW_CHARS = 200;

function statusLabel(status: CvPreviewStatus): string {
  switch (status) {
    case "success":
      return "Extracted";
    case "warning":
      return "Low content";
    case "failed":
      return "Failed";
  }
}

function statusVariant(status: CvPreviewStatus): "default" | "secondary" | "destructive" {
  switch (status) {
    case "success":
      return "default";
    case "warning":
      return "secondary";
    case "failed":
      return "destructive";
  }
}

export function CvPreviewCard({ candidate, onRemove, onUpdateText, disabled }: CvPreviewCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const text = candidate.extractedText ?? "";
  const isTruncated = text.length > PREVIEW_CHARS;
  const displayed = isExpanded || isEditing ? text : text.slice(0, PREVIEW_CHARS);

  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <Badge variant={statusVariant(candidate.status)}>{statusLabel(candidate.status)}</Badge>
            <span className="truncate text-sm font-medium" title={candidate.fileName}>
              {candidate.fileName}
            </span>
          </div>
          {candidate.status === "warning" && (
            <p className="text-muted-foreground mt-1 text-xs">
              Extraction returned very little text. This PDF may be scanned or image-based. You can edit the text below
              before confirming.
            </p>
          )}
          {candidate.status === "failed" && (
            <p className="text-destructive mt-1 text-xs">
              {candidate.errorMessage ?? "Could not extract text from this PDF."}
            </p>
          )}
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={onRemove} disabled={disabled} className="shrink-0">
          Remove
        </Button>
      </CardHeader>
      <CardContent className="space-y-2">
        {isEditing ? (
          <Textarea
            value={text}
            onChange={(e) => {
              onUpdateText(e.target.value);
            }}
            rows={8}
            maxLength={MAX_EXTRACTED_TEXT_CHARS}
            disabled={disabled}
            placeholder="Paste or edit extracted text here..."
          />
        ) : (
          <pre
            className={cn(
              "bg-muted text-foreground max-h-48 overflow-auto rounded-md p-3 text-xs whitespace-pre-wrap",
              !text && "text-muted-foreground italic",
            )}
          >
            {text ? displayed : "No text extracted."}
            {!isExpanded && isTruncated ? "…" : ""}
          </pre>
        )}
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setIsEditing((v) => !v);
            }}
            disabled={disabled}
          >
            {isEditing ? "Done editing" : "Edit text"}
          </Button>
          {!isEditing && isTruncated && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => {
                setIsExpanded((v) => !v);
              }}
              disabled={disabled}
            >
              {isExpanded ? "Show less" : "Show more"}
            </Button>
          )}
          <span className="text-muted-foreground ml-auto self-center text-xs">{text.length.toString()} characters</span>
        </div>
      </CardContent>
    </Card>
  );
}
