import { useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { extractTextFromPdf } from "@/lib/pdf-extract";
import { validateFiles, ACCEPTED_EXTENSION, ACCEPTED_MIME_TYPE } from "@/lib/file-validation";
import { MAX_EXTRACTED_TEXT_CHARS } from "@/lib/schemas/candidate";
import { CvPreviewList } from "@/components/candidates/CvPreviewList";
import type { CvPreviewItem } from "@/components/candidates/CvPreviewCard";
import type { Candidate } from "@/types";
import type { PdfExtractResult } from "@/lib/pdf-extract";

type FlowState = "idle" | "extracting" | "previewing" | "uploading";

const WARNING_TEXT_THRESHOLD = 50;
const MAX_TOTAL = 10;
const EXTRACTION_CONCURRENCY = 2;

interface CvUploadFlowProps {
  positionId: string;
  existingCount: number;
  existingFileNames: string[];
  onComplete: () => void;
  onCancel?: () => void;
}

interface UploadResponse {
  uploads: { file_name: string; file_path: string }[];
}

interface ConfirmResponse {
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

async function extractWithConcurrency(files: File[]): Promise<PromiseSettledResult<PdfExtractResult>[]> {
  const results: PromiseSettledResult<PdfExtractResult>[] = [];
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < files.length) {
      const index = nextIndex;
      nextIndex += 1;
      try {
        results[index] = { status: "fulfilled", value: await extractTextFromPdf(files[index]) };
      } catch (reason) {
        results[index] = { status: "rejected", reason };
      }
    }
  }

  await Promise.all(Array.from({ length: Math.min(EXTRACTION_CONCURRENCY, files.length) }, worker));
  return results;
}

export function CvUploadFlow({
  positionId,
  existingCount,
  existingFileNames,
  onComplete,
  onCancel,
}: CvUploadFlowProps) {
  const [state, setState] = useState<FlowState>("idle");
  const [previews, setPreviews] = useState<CvPreviewItem[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const remainingSlots = Math.max(0, MAX_TOTAL - existingCount);

  function resetToIdle() {
    setPreviews([]);
    setState("idle");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  async function handleFilesSelected(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    const files = Array.from(fileList);

    const { valid, errors } = validateFiles(files, existingFileNames, remainingSlots);
    for (const err of errors) {
      toast.error(`${err.fileName}: ${err.reason}`);
    }
    if (valid.length === 0) {
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setState("extracting");

    const results = await extractWithConcurrency(valid);

    const items: CvPreviewItem[] = valid.map((file, idx) => {
      const result = results[idx];
      if (result.status === "rejected") {
        return {
          file,
          fileName: file.name,
          extractedText: null,
          status: "failed",
          errorMessage: result.reason instanceof Error ? result.reason.message : "Extraction failed",
        };
      }
      const outcome = result.value;
      if ("error" in outcome) {
        return {
          file,
          fileName: file.name,
          extractedText: null,
          status: "failed",
          errorMessage: outcome.error,
        };
      }
      const text = outcome.text;
      const status: CvPreviewItem["status"] =
        outcome.truncated || text.length < WARNING_TEXT_THRESHOLD ? "warning" : "success";
      return {
        file,
        fileName: file.name,
        extractedText: text,
        status,
        errorMessage: outcome.truncated ? "Extraction was truncated to keep browser performance stable." : undefined,
      };
    });

    setPreviews(items);
    setState("previewing");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }

  function handleRemove(index: number) {
    setPreviews((prev) => prev.filter((_, i) => i !== index));
  }

  function handleUpdateText(index: number, text: string) {
    setPreviews((prev) =>
      prev.map((item, i) => {
        if (i !== index) return item;
        const status: CvPreviewItem["status"] = text.trim().length < WARNING_TEXT_THRESHOLD ? "warning" : "success";
        return { ...item, extractedText: text, status };
      }),
    );
  }

  async function handleConfirm() {
    const confirmable = previews.filter(
      (item) => item.status !== "failed" && (item.extractedText ?? "").trim().length > 0,
    );
    if (confirmable.length === 0) {
      toast.error("Nothing to upload — all items failed or are empty.");
      return;
    }

    const tooLong = confirmable.find((item) => (item.extractedText ?? "").length > MAX_EXTRACTED_TEXT_CHARS);
    if (tooLong) {
      toast.error(`${tooLong.fileName}: extracted text is too long.`);
      return;
    }

    setState("uploading");
    try {
      // Step 1: upload binaries to Storage via server proxy.
      const formData = new FormData();
      for (const item of confirmable) {
        formData.append("files", item.file, item.fileName);
      }

      const uploadRes = await fetch(`/api/positions/${positionId}/candidates/upload`, {
        method: "POST",
        body: formData,
      });
      if (!uploadRes.ok) {
        toast.error(await parseError(uploadRes));
        setState("previewing");
        return;
      }
      // We don't actually use the upload response body — the confirm route
      // re-derives the canonical path server-side. Parsing it would just
      // shape-check that the route succeeded.
      (await uploadRes.json()) as UploadResponse;

      // Step 2: confirm — server creates DB rows from file_name + extracted_text.
      const confirmRes = await fetch(`/api/positions/${positionId}/candidates/confirm`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidates: confirmable.map((item) => ({
            file_name: item.fileName,
            extracted_text: item.extractedText ?? "",
          })),
        }),
      });
      if (!confirmRes.ok) {
        toast.error(await parseError(confirmRes));
        setState("previewing");
        return;
      }
      const data = (await confirmRes.json()) as ConfirmResponse;
      toast.success(`Added ${data.candidates.length.toString()} candidate(s).`);
      resetToIdle();
      onComplete();
    } catch {
      toast.error("An unexpected error occurred during upload.");
      setState("previewing");
    }
  }

  if (remainingSlots === 0) {
    return (
      <div className="space-y-3">
        <p className="text-muted-foreground text-sm">
          This position already has the maximum of {MAX_TOTAL.toString()} candidates. Delete one before adding more.
        </p>
        {onCancel && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Close
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (state === "idle") {
    return (
      <div className="space-y-4">
        <div className="space-y-2">
          <p className="text-sm">
            Select up to {remainingSlots.toString()} PDF file(s), max 5 MB each. Text will be extracted in your browser
            before upload.
          </p>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept={`${ACCEPTED_MIME_TYPE},${ACCEPTED_EXTENSION}`}
          multiple
          onChange={(e) => {
            void handleFilesSelected(e.target.files);
          }}
          className="file:border-input file:bg-background hover:file:bg-accent block w-full text-sm file:mr-3 file:rounded-md file:border file:px-3 file:py-1.5 file:text-sm file:font-medium"
        />
        {onCancel && (
          <div className="flex justify-end">
            <Button type="button" variant="outline" onClick={onCancel}>
              Cancel
            </Button>
          </div>
        )}
      </div>
    );
  }

  if (state === "extracting") {
    return (
      <div className="text-muted-foreground py-8 text-center text-sm">
        Extracting text from PDF(s)... this may take a few seconds.
      </div>
    );
  }

  return (
    <CvPreviewList
      candidates={previews}
      onRemove={handleRemove}
      onUpdateText={handleUpdateText}
      onConfirm={() => {
        void handleConfirm();
      }}
      onCancel={() => {
        resetToIdle();
        if (onCancel) onCancel();
      }}
      isUploading={state === "uploading"}
    />
  );
}
