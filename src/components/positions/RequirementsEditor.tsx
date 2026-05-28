import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import type { Requirement } from "@/types";
import { Plus, X, ChevronDown, ChevronUp } from "lucide-react";

interface RequirementsEditorProps {
  value: Requirement[];
  onChange: (reqs: Requirement[]) => void;
}

export function RequirementsEditor({ value, onChange }: RequirementsEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [expandedIndex, setExpandedIndex] = useState<number | null>(null);

  const maxReached = value.length >= 20;

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed || maxReached) return;
    onChange([...value, { name: trimmed }]);
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  function handleRemove(index: number) {
    const next = value.filter((_, i) => i !== index);
    onChange(next);
    if (expandedIndex === index) setExpandedIndex(null);
    else if (expandedIndex !== null && expandedIndex > index) {
      setExpandedIndex(expandedIndex - 1);
    }
  }

  function handleDescriptionChange(index: number, description: string) {
    const next = value.map((req, i) => (i === index ? { ...req, description: description || undefined } : req));
    onChange(next);
  }

  function toggleExpand(index: number) {
    setExpandedIndex(expandedIndex === index ? null : index);
  }

  return (
    <div className="space-y-3">
      <div className="flex gap-2">
        <Input
          placeholder={maxReached ? "Maximum 20 requirements reached" : "Type a requirement and press Enter"}
          value={inputValue}
          onChange={(e) => {
            setInputValue(e.target.value);
          }}
          onKeyDown={handleKeyDown}
          disabled={maxReached}
          className="flex-1"
        />
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleAdd}
          disabled={maxReached || !inputValue.trim()}
        >
          <Plus className="size-4" />
          Add
        </Button>
      </div>

      {maxReached && <p className="text-muted-foreground text-xs">Maximum 20 requirements reached</p>}

      {value.length > 0 && (
        <div className="space-y-2">
          {value.map((req, index) => (
            <div key={index} className={cn("rounded-md border p-2", expandedIndex === index && "bg-muted/50")}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleExpand(index);
                  }}
                  className="text-muted-foreground hover:text-foreground flex-1 text-left text-sm"
                >
                  <span className="flex items-center gap-1">
                    {expandedIndex === index ? (
                      <ChevronUp className="size-3 shrink-0" />
                    ) : (
                      <ChevronDown className="size-3 shrink-0" />
                    )}
                    <span className="text-foreground font-medium">{req.name}</span>
                    {req.description && <span className="text-muted-foreground ml-1 text-xs">(has description)</span>}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => {
                    handleRemove(index);
                  }}
                  aria-label={`Remove ${req.name}`}
                >
                  <X className="size-3" />
                </Button>
              </div>
              {expandedIndex === index && (
                <div className="mt-2">
                  <Textarea
                    placeholder="Optional description for this requirement..."
                    value={req.description ?? ""}
                    onChange={(e) => {
                      handleDescriptionChange(index, e.target.value);
                    }}
                    rows={2}
                    className="text-sm"
                  />
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
