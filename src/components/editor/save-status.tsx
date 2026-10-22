// Author: yxpil

"use client";

import {
  AlertTriangle,
  Check,
  Circle,
  CloudOff,
  Loader2,
  RefreshCw,
  type LucideIcon,
} from "lucide-react";
import type { SaveState } from "@/hooks/use-autosave";
import { cn, formatClock } from "@/lib/utils";

const STATES: Record<
  SaveState,
  { label: string; tone: string; icon: LucideIcon; spin?: boolean }
> = {
  saved: { label: "已保存", tone: "text-accent", icon: Check },
  dirty: { label: "未保存", tone: "text-ink-mute", icon: Circle },
  saving: { label: "保存中", tone: "text-ink-soft", icon: Loader2, spin: true },
  retrying: { label: "重试中", tone: "text-gold", icon: RefreshCw, spin: true },
  offline: { label: "离线，已存本机", tone: "text-gold", icon: CloudOff },
  conflict: { label: "保存冲突", tone: "text-danger", icon: AlertTriangle },
};

export function SaveStatus({
  state,
  savedAt,
  className,
  showTime = false,
  compactLabel = false,
}: {
  state: SaveState;
  savedAt?: string;
  className?: string;
  showTime?: boolean;
  compactLabel?: boolean;
}) {
  const meta = STATES[state];
  const Icon = meta.icon;
  const title = savedAt ? `最近一次服务端保存：${formatClock(new Date(savedAt))}` : undefined;

  return (
    <span
      className={cn("inline-flex items-center gap-1.5 text-[11px] font-medium", meta.tone, className)}
      aria-live="polite"
      title={title}
    >
      <Icon
        size={13}
        strokeWidth={2}
        className={meta.spin ? "animate-spin-slow" : undefined}
        aria-hidden="true"
      />
      <span className={cn("whitespace-nowrap", compactLabel && "sr-only sm:not-sr-only")}>
        {meta.label}
      </span>
      {showTime && state === "saved" && savedAt ? (
        <span className="hidden tabular-nums text-ink-mute sm:inline">
          {formatClock(new Date(savedAt))}
        </span>
      ) : null}
    </span>
  );
}
