import type { HTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

export function Sidebar({ className, children, ...props }: HTMLAttributes<HTMLElement> & { children: ReactNode }) {
  return <aside className={cn("ui-sidebar", className)} {...props}>{children}</aside>;
}

export function SidebarHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-sidebar-header", className)} {...props} />;
}

export function SidebarContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("ui-sidebar-content", className)} {...props} />;
}
