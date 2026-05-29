/**
 * Client-side PDF text extraction via pdfjs-dist.
 *
 * The library and its worker are dynamically imported so they only ship to the
 * client when the upload flow actually runs (keeps the initial bundle lean and
 * avoids any SSR-time evaluation in Astro / Cloudflare Workers).
 */

export type PdfExtractResult = { text: string } | { error: string };

let workerConfigured = false;

async function configureWorker(): Promise<void> {
  if (workerConfigured) return;
  const pdfjs = await import("pdfjs-dist");
  // Bundle the worker locally via Vite's URL import — same-origin, cached
  // with the app, no third-party CDN at runtime, no CSP carve-out.
  const workerUrl = (await import("pdfjs-dist/build/pdf.worker.min.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerUrl;
  workerConfigured = true;
}

export async function extractTextFromPdf(file: File): Promise<PdfExtractResult> {
  try {
    await configureWorker();
    const pdfjs = await import("pdfjs-dist");

    const arrayBuffer = await file.arrayBuffer();
    const loadingTask = pdfjs.getDocument({ data: new Uint8Array(arrayBuffer) });
    const pdf = await loadingTask.promise;

    const pageTexts: string[] = [];
    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ")
        .replace(/\s+/g, " ")
        .trim();
      pageTexts.push(pageText);
    }

    const text = pageTexts.filter(Boolean).join("\n\n").trim();
    return { text };
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown extraction error";
    return { error: message };
  }
}
