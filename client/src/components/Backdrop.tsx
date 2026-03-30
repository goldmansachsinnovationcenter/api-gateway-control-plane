import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface BackdropProps {
  open: boolean;
  message?: string;
  className?: string;
}

export function Backdrop({ open, message = "Processing...", className }: BackdropProps) {
  if (!open) return null;

  return (
    <div className={cn("fixed inset-0 z-40 flex items-center justify-center", className)}>
      <div className="fixed inset-0 bg-black/50 backdrop-blur-sm" />
      <div className="relative z-50 flex flex-col items-center gap-3 rounded-lg bg-card border border-border p-8 shadow-xl">
        <Loader2 className="h-8 w-8 animate-spin text-primary" />
        <p className="text-sm text-muted-foreground">{message}</p>
      </div>
    </div>
  );
}
