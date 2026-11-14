import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export function Sheet({ open, onOpenChange, children }: { open: boolean; onOpenChange: (open: boolean) => void; children: ReactNode }) {
  if (!open) return null;
  return <div className="ui-sheet-backdrop" onClick={() => onOpenChange(false)}><div className="ui-sheet ui-sheet-right" onClick={(event) => event.stopPropagation()}>{children}</div></div>;
}

export function SheetContent({ className, children }: { className?: string; children: ReactNode }) {
  return <div className={cn("ui-sheet-content", className)}>{children}</div>;
}
