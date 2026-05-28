import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RequirementsEditor } from "@/components/positions/RequirementsEditor";
import { StaleEvaluationBanner } from "@/components/positions/StaleEvaluationBanner";
import { toast } from "sonner";
import type { Position, Requirement, SeniorityLevel } from "@/types";

const SENIORITY_OPTIONS: { value: SeniorityLevel; label: string }[] = [
  { value: "junior", label: "Junior" },
  { value: "mid", label: "Mid" },
  { value: "senior", label: "Senior" },
];

interface PositionFormProps {
  mode: "create" | "edit";
  initialData?: Position;
  hasEvaluation?: boolean;
}

interface FieldErrors {
  title?: string[];
  description?: string[];
  seniority?: string[];
  team?: string[];
  requirements?: string[];
  [key: string]: string[] | undefined;
}

export function PositionForm({ mode, initialData, hasEvaluation }: PositionFormProps) {
  const [title, setTitle] = useState(initialData?.title ?? "");
  const [description, setDescription] = useState(initialData?.description ?? "");
  const [seniority, setSeniority] = useState<SeniorityLevel | "">(initialData?.seniority ?? "");
  const [team, setTeam] = useState(initialData?.team ?? "");
  const [requirements, setRequirements] = useState<Requirement[]>(initialData?.requirements ?? []);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<FieldErrors>({});

  function validateClient(): boolean {
    const newErrors: FieldErrors = {};

    if (!title.trim()) {
      newErrors.title = ["Title is required"];
    }
    if (!seniority) {
      newErrors.seniority = ["Seniority level is required"];
    }
    if (requirements.length === 0) {
      newErrors.requirements = ["At least one requirement is needed"];
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  }

  async function handleSubmit(e: React.SyntheticEvent) {
    e.preventDefault();

    if (!validateClient()) return;

    setIsSubmitting(true);
    setErrors({});

    const body = {
      title: title.trim(),
      description: description.trim() || undefined,
      seniority,
      team: team.trim() || undefined,
      requirements,
    };

    try {
      const url = mode === "create" ? "/api/positions/" : `/api/positions/${initialData?.id ?? ""}`;
      const method = mode === "create" ? "POST" : "PUT";

      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!res.ok) {
        const data = (await res.json()) as { error: string; details?: Record<string, string[]> };
        if (data.details) {
          setErrors(data.details);
        } else {
          toast.error(data.error || "Something went wrong");
        }
        return;
      }

      toast.success(mode === "create" ? "Position created" : "Position updated");
      window.location.href = "/positions";
    } catch {
      toast.error("An unexpected error occurred");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {hasEvaluation && <StaleEvaluationBanner />}

      <div className="space-y-2">
        <Label htmlFor="title">Title *</Label>
        <Input
          id="title"
          placeholder="e.g. QA Engineer"
          value={title}
          onChange={(e) => {
            setTitle(e.target.value);
          }}
          maxLength={200}
        />
        {errors.title && <p className="text-destructive text-sm">{errors.title[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="team">Team</Label>
        <Input
          id="team"
          placeholder="e.g. Platform Engineering"
          value={team}
          onChange={(e) => {
            setTeam(e.target.value);
          }}
          maxLength={200}
        />
        {errors.team && <p className="text-destructive text-sm">{errors.team[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Optional description of the position..."
          value={description}
          onChange={(e) => {
            setDescription(e.target.value);
          }}
          rows={3}
          maxLength={2000}
        />
        {errors.description && <p className="text-destructive text-sm">{errors.description[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="seniority">Seniority Level *</Label>
        <Select
          value={seniority}
          onValueChange={(val) => {
            setSeniority(val as SeniorityLevel);
          }}
        >
          <SelectTrigger id="seniority">
            <SelectValue placeholder="Select seniority level" />
          </SelectTrigger>
          <SelectContent>
            {SENIORITY_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {errors.seniority && <p className="text-destructive text-sm">{errors.seniority[0]}</p>}
      </div>

      <div className="space-y-2">
        <Label>Requirements *</Label>
        <RequirementsEditor value={requirements} onChange={setRequirements} />
        {errors.requirements && <p className="text-destructive text-sm">{errors.requirements[0]}</p>}
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting
            ? mode === "create"
              ? "Creating..."
              : "Saving..."
            : mode === "create"
              ? "Create Position"
              : "Save Changes"}
        </Button>
        <Button type="button" variant="outline" onClick={() => (window.location.href = "/positions")}>
          Cancel
        </Button>
      </div>
    </form>
  );
}
