import { Card, CardContent, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Position, SeniorityLevel } from "@/types";
import { Pencil, Trash2 } from "lucide-react";

const seniorityColors: Record<SeniorityLevel, string> = {
  junior: "bg-green-100 text-green-800",
  mid: "bg-blue-100 text-blue-800",
  senior: "bg-purple-100 text-purple-800",
  lead: "bg-orange-100 text-orange-800",
  principal: "bg-red-100 text-red-800",
};

interface PositionCardProps {
  position: Position;
  onDelete: (id: string) => void;
  onEdit: (id: string) => void;
}

export function PositionCard({ position, onDelete, onEdit }: PositionCardProps) {
  const createdDate = new Date(position.created_at).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  return (
    <Card className="flex flex-col">
      <CardHeader>
        <div className="flex items-start justify-between gap-2">
          <div>
            <CardTitle className="text-base">{position.title}</CardTitle>
            {position.team && <p className="text-muted-foreground mt-1 text-xs">{position.team}</p>}
          </div>
          <Badge className={cn("shrink-0", seniorityColors[position.seniority])} variant="secondary">
            {position.seniority}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="flex-1">
        <p className="text-muted-foreground text-sm">
          {position.requirements.length} requirement{position.requirements.length !== 1 ? "s" : ""}
        </p>
        {position.description && (
          <p className="text-muted-foreground mt-2 line-clamp-2 text-sm">{position.description}</p>
        )}
      </CardContent>
      <CardFooter className="flex items-center justify-between">
        <span className="text-muted-foreground text-xs">{createdDate}</span>
        <div className="flex gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onEdit(position.id);
            }}
            aria-label="Edit position"
          >
            <Pencil className="size-4" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => {
              onDelete(position.id);
            }}
            aria-label="Delete position"
          >
            <Trash2 className="text-destructive size-4" />
          </Button>
        </div>
      </CardFooter>
    </Card>
  );
}
