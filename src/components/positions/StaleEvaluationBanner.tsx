import { AlertTriangle } from "lucide-react";

export function StaleEvaluationBanner() {
  return (
    <div className="flex items-center gap-2 rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
      <AlertTriangle className="size-4 shrink-0" />
      <p>This position has been evaluated. Editing may invalidate results.</p>
    </div>
  );
}
