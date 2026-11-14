import type { ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/src/lib/utils";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  asChild?: boolean;
  children?: ReactNode;
};

export function Button({ asChild, className, children, ...props }: ButtonProps) {
  if (asChild) return <span className={cn("ui-button", className)}>{children}</span>;
  return <button className={cn("ui-button", className)} {...props}>{children}</button>;
}
