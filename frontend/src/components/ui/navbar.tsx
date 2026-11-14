import type { ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export function Navbar({ className, children }: { className?: string; children: ReactNode }) {
  return <header className={cn("ui-navbar", className)}>{children}</header>;
}
