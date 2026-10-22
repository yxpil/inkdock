// Author: yxpil

import { cn } from "@/lib/utils";

export function BrandMark({ size = "md" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={cn(
        "inline-flex flex-none items-center justify-center rounded-[14px] bg-accent font-serif font-semibold text-on-accent",
        size === "sm" ? "h-8 w-8 text-base" : "h-9 w-9 text-lg",
      )}
      aria-hidden="true"
    >
      墨
    </span>
  );
}

export function BrandLockup({ compact = false }: { compact?: boolean }) {
  return (
    <span className="flex items-center gap-2.5">
      <BrandMark size={compact ? "sm" : "md"} />
      <span className="flex flex-col leading-none">
        <span className={cn("font-serif font-semibold tracking-[0.02em]", compact ? "text-base" : "text-lg")}>
          墨坞
        </span>
        {!compact ? (
          <span className="mt-1 text-[9px] font-medium tracking-[0.22em] text-ink-mute">
            INKDOCK
          </span>
        ) : null}
      </span>
    </span>
  );
}
