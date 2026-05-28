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

interface RequirementWithId extends Requirement {
  _id: string;
}

function generateId() {
  return crypto.randomUUID();
}

function attachIds(reqs: Requirement[]): RequirementWithId[] {
  return reqs.map((r) => ({ ...r, _id: generateId() }));
}

export function RequirementsEditor({ value, onChange }: RequirementsEditorProps) {
  const [inputValue, setInputValue] = useState("");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [items, setItems] = useState<RequirementWithId[]>(() => attachIds(value));

  const maxReached = items.length >= 20;

  function emitChange(next: RequirementWithId[]) {
    setItems(next);
    onChange(next.map(({ _id: _, ...rest }) => rest));
  }

  function handleAdd() {
    const trimmed = inputValue.trim();
    if (!trimmed || maxReached) return;
    emitChange([...items, { name: trimmed, _id: generateId() }]);
    setInputValue("");
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAdd();
    }
  }

  function handleRemove(id: string) {
    emitChange(items.filter((item) => item._id !== id));
    if (expandedId === id) setExpandedId(null);
  }

  function handleDescriptionChange(id: string, description: string) {
    emitChange(items.map((item) => (item._id === id ? { ...item, description: description || undefined } : item)));
  }

  function toggleExpand(id: string) {
    setExpandedId(expandedId === id ? null : id);
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

      {items.length > 0 && (
        <div className="space-y-2">
          {items.map((item) => (
            <div key={item._id} className={cn("rounded-md border p-2", expandedId === item._id && "bg-muted/50")}>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => {
                    toggleExpand(item._id);
                  }}
                  className="text-muted-foreground hover:text-foreground flex-1 text-left text-sm"
                >
                  <span className="flex items-center gap-1">
                    {expandedId === item._id ? (
                      <ChevronUp className="size-3 shrink-0" />
                    ) : (
                      <ChevronDown className="size-3 shrink-0" />
                    )}
                    <span className="text-foreground font-medium">{item.name}</span>
                    {item.description && <span className="text-muted-foreground ml-1 text-xs">(has description)</span>}
                  </span>
                </button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-6"
                  onClick={() => {
                    handleRemove(item._id);
                  }}
                  aria-label={`Remove ${item.name}`}
                >
                  <X className="size-3" />
                </Button>
              </div>
              {expandedId === item._id && (
                <div className="mt-2">
                  <Textarea
                    placeholder="Optional description for this requirement..."
                    value={item.description ?? ""}
                    onChange={(e) => {
                      handleDescriptionChange(item._id, e.target.value);
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
