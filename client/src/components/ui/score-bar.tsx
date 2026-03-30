import { cn } from "@/lib/utils";

interface ScoreBarProps {
  score: number;
  label: string;
  className?: string;
}

export function ScoreBar({ score, label, className }: ScoreBarProps) {
  const getColor = (s: number) => {
    if (s >= 80) return "bg-success";
    if (s >= 60) return "bg-warning";
    return "bg-destructive";
  };

  return (
    <div className={cn("space-y-1", className)}>
      <div className="flex justify-between text-xs">
        <span className="text-muted-foreground">{label}</span>
        <span className="font-medium">{score}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={cn("h-full rounded-full transition-all duration-500", getColor(score))}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  );
}
