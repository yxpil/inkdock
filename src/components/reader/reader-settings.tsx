// Author: yxpil

"use client";

import { Check, Minus, Plus, RotateCcw } from "lucide-react";
import {
  FONT_LABELS,
  MARGIN_LABELS,
  PLATFORMS,
  READER_THEMES,
  type PlatformId,
  type ReaderFontId,
  type ReaderMargin,
  type ReaderPrefs,
  type ReaderThemeId,
} from "@/lib/platforms";
import { cn } from "@/lib/utils";
import { capsule } from "@/components/ui/button";

const FONT_OPTIONS: Array<{ value: ReaderFontId; label: string }> = [
  { value: "serif", label: FONT_LABELS.serif },
  { value: "sans", label: FONT_LABELS.sans },
  { value: "kai", label: FONT_LABELS.kai },
];

const MARGIN_OPTIONS: Array<{ value: ReaderMargin; label: string }> = [
  { value: "narrow", label: MARGIN_LABELS.narrow },
  { value: "standard", label: MARGIN_LABELS.standard },
  { value: "wide", label: MARGIN_LABELS.wide },
];

const THEME_OPTIONS = Object.entries(READER_THEMES) as Array<
  [ReaderThemeId, (typeof READER_THEMES)[ReaderThemeId]]
>;

export function ReaderSettings({
  platformId,
  prefs,
  onPlatformChange,
  onPrefsChange,
  onReset,
}: {
  platformId: PlatformId;
  prefs: ReaderPrefs;
  onPlatformChange: (id: PlatformId) => void;
  onPrefsChange: (patch: Partial<ReaderPrefs>) => void;
  onReset: () => void;
}) {
  return (
    <div className="space-y-6">
      <section aria-labelledby="platform-title">
        <h2 id="platform-title" className="text-[11px] font-semibold tracking-[0.08em] text-ink-soft">
          模拟平台
        </h2>
        <p className="mt-1 text-[10px] leading-5 text-ink-mute">
          只模拟排版与导航，不包含平台功能。
        </p>
        <div className="mt-3 space-y-1">
          {PLATFORMS.map((platform) => {
            const active = platform.id === platformId;
            return (
              <button
                key={platform.id}
                type="button"
                onClick={() => onPlatformChange(platform.id)}
                aria-pressed={active}
                className={cn(
                  "flex w-full items-center gap-2.5 rounded-2xl border p-2.5 text-left transition-colors",
                  active
                    ? "border-accent bg-surface"
                    : "border-transparent hover:bg-surface-2",
                )}
              >
                <span
                  className="flex h-8 w-8 flex-none items-center justify-center rounded-[10px] text-[12px] font-semibold text-white"
                  style={{ backgroundColor: platform.accent }}
                  aria-hidden="true"
                >
                  {platform.shortName.slice(0, 1)}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12px] font-medium text-ink">
                    {platform.name}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-ink-mute">
                    {FONT_LABELS[platform.defaultPrefs.font]} ·{" "}
                    {platform.defaultPrefs.fontSize}px · 默认
                  </span>
                </span>
                {active ? <Check size={14} className="flex-none text-accent" /> : null}
              </button>
            );
          })}
        </div>
      </section>

      <div className="hairline" />

      <section aria-labelledby="reading-prefs-title">
        <h2
          id="reading-prefs-title"
          className="text-[11px] font-semibold tracking-[0.08em] text-ink-soft"
        >
          阅读设置
        </h2>

        <div className="mt-3 space-y-2.5">
          <Stepper
            label="字号"
            value={`${prefs.fontSize}`}
            unit="px"
            canDecrease={prefs.fontSize > 15}
            canIncrease={prefs.fontSize < 26}
            onDecrease={() => onPrefsChange({ fontSize: prefs.fontSize - 1 })}
            onIncrease={() => onPrefsChange({ fontSize: prefs.fontSize + 1 })}
          />
          <Stepper
            label="行高"
            value={prefs.lineHeight.toFixed(2)}
            unit=""
            canDecrease={prefs.lineHeight > 1.6}
            canIncrease={prefs.lineHeight < 2.2}
            onDecrease={() =>
              onPrefsChange({ lineHeight: Math.round((prefs.lineHeight - 0.05) * 100) / 100 })
            }
            onIncrease={() =>
              onPrefsChange({ lineHeight: Math.round((prefs.lineHeight + 0.05) * 100) / 100 })
            }
          />
        </div>

        <div className="mt-4">
          <span className="text-[10px] font-medium text-ink-mute">页边距</span>
          <OptionGroup
            options={MARGIN_OPTIONS}
            value={prefs.margin}
            onChange={(value) => onPrefsChange({ margin: value as ReaderMargin })}
          />
        </div>

        <div className="mt-4">
          <span className="text-[10px] font-medium text-ink-mute">正文字体</span>
          <OptionGroup
            options={FONT_OPTIONS}
            value={prefs.font}
            onChange={(value) => onPrefsChange({ font: value as ReaderFontId })}
          />
        </div>

        <div className="mt-4">
          <span className="text-[10px] font-medium text-ink-mute">阅读主题</span>
          <div className="mt-1.5 grid grid-cols-4 gap-1.5">
            {THEME_OPTIONS.map(([id, theme]) => (
              <button
                key={id}
                type="button"
                onClick={() => onPrefsChange({ theme: id })}
                aria-pressed={prefs.theme === id}
                className={cn(
                  "flex flex-col items-center gap-1.5 rounded-2xl border p-2 transition-colors",
                  prefs.theme === id
                    ? "border-accent bg-surface"
                    : "border-line hover:bg-surface-2",
                )}
              >
                <span
                  className="flex h-7 w-7 items-center justify-center rounded-full border"
                  style={{ backgroundColor: theme.bg, borderColor: theme.line }}
                  aria-hidden="true"
                >
                  <span className="font-serif text-[10px]" style={{ color: theme.text }}>
                    文
                  </span>
                </span>
                <span className="text-[10px] text-ink-soft">{theme.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="text-[10px] font-medium text-ink-mute">翻页动画</span>
          <OptionGroup
            options={[
              { value: "slide", label: "平移" },
              { value: "none", label: "无动画" },
            ]}
            value={prefs.pageTurn}
            onChange={(value) =>
              onPrefsChange({ pageTurn: value === "none" ? "none" : "slide" })
            }
          />
        </div>

        <button
          type="button"
          onClick={onReset}
          className={capsule("ghost", "sm", "mt-5 w-full border border-line")}
        >
          <RotateCcw size={13} />
          恢复该平台默认
        </button>
        <p className="mt-3 text-[10px] leading-5 text-ink-mute">
          设置按平台分别保存在本机，只影响预览，不改变作品与导出格式。
        </p>
      </section>
    </div>
  );
}

function Stepper({
  label,
  value,
  unit,
  canDecrease,
  canIncrease,
  onDecrease,
  onIncrease,
}: {
  label: string;
  value: string;
  unit: string;
  canDecrease: boolean;
  canIncrease: boolean;
  onDecrease: () => void;
  onIncrease: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-[11px] text-ink-soft">{label}</span>
      <div className="flex items-center gap-1">
        <button
          type="button"
          onClick={onDecrease}
          disabled={!canDecrease}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-ink-soft transition-colors hover:bg-surface-3 disabled:opacity-35"
          aria-label={`减小${label}`}
        >
          <Minus size={13} />
        </button>
        <span className="w-14 text-center text-[11px] tabular-nums text-ink">
          {value}
          {unit ? <span className="ml-0.5 text-[9px] text-ink-mute">{unit}</span> : null}
        </span>
        <button
          type="button"
          onClick={onIncrease}
          disabled={!canIncrease}
          className="flex h-7 w-7 items-center justify-center rounded-full bg-surface-2 text-ink-soft transition-colors hover:bg-surface-3 disabled:opacity-35"
          aria-label={`增大${label}`}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function OptionGroup({
  options,
  value,
  onChange,
}: {
  options: Array<{ value: string; label: string }>;
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="mt-1.5 flex w-full gap-1 rounded-full bg-surface-2 p-1">
      {options.map((option) => {
        const active = value === option.value;
        return (
          <button
            key={option.value}
            type="button"
            onClick={() => onChange(option.value)}
            aria-pressed={active}
            className={cn(
              "h-7 flex-1 rounded-full text-[10px] font-medium transition-colors",
              active
                ? "bg-surface text-ink"
                : "text-ink-mute hover:text-ink",
            )}
          >
            {option.label}
          </button>
        );
      })}
    </div>
  );
}
