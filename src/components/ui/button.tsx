// Author: yxpil

import { cn } from "@/lib/utils";

export type CapsuleVariant = "primary" | "secondary" | "outline" | "ghost" | "danger";
export type CapsuleSize = "sm" | "md" | "lg";

const VARIANTS: Record<CapsuleVariant, string> = {
  primary: "capsule-primary",
  secondary: "capsule-secondary",
  outline: "capsule-outline",
  ghost: "capsule-ghost",
  danger: "capsule-danger",
};

const SIZES: Record<CapsuleSize, string> = {
  sm: "h-8 px-3 text-xs",
  md: "h-10 px-4 text-[13px]",
  lg: "h-11 px-5 text-sm",
};

export function capsule(
  variant: CapsuleVariant = "secondary",
  size: CapsuleSize = "md",
  className?: string,
): string {
  return cn("capsule", VARIANTS[variant], SIZES[size], className);
}
