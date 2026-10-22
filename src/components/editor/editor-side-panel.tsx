// Author: yxpil

"use client";

import { AlignLeft, Clock3, FileText, Target, Type } from "lucide-react";
import type { ChapterStatus } from "@/lib/types";
import {
  CHAPTER_STATUSES,
  CHAPTER_STATUS_LABEL,
  DEFAULT_DAILY_GOAL,
} from "@/lib/constants";
import { cn, formatDateTime, formatNumber } from "@/lib/utils";
import { AiPanel } from "./ai-panel";

export type EditorFont = "serif" | "sans";

const FONT_SIZES = [15, 17, 19, 21];

export function EditorSidePanel({
  ai,
  workTitle,
  genre,
  chapterTitle,
  content,
  onInsert,
  dailyWords,
  dailyGoal = DEFAULT_DAILY_GOAL,
  wordCount,
  paragraphs,
  readingMinutes,
  updatedAt,
  status,
  onStatusChange,
  fontFamily,
  onFontFamilyChange,
  fontSize,
  onFontSizeChange,
}: {
  ai: { configured: boolean; model: string | null };
  workTitle: string;
  genre: string;
  chapterTitle: string;
  content: string;
  onInsert: (text: string) => void;
  dailyWords: number;
  dailyGoal?: number;
  wordCount: number;
  paragraphs: number;
  readingMinutes: number;
  updatedAt: string;
  status: ChapterStatus;
  onStatusChange: (status: ChapterStatus) => void;
  fontFamily: EditorFont;
  onFontFamilyChange: (font: EditorFont) => void;
  fontSize: number;
  onFontSizeChange: (size: number) => void;
}) {
  const progress =
    dailyGoal > 0 ? Math.min(100, Math.round((dailyWords / dailyGoal) * 100)) : 0;
  const remaining = Math.max(0, dailyGoal - dailyWords);

  return (
    <div className="space-y-5 p-4">
      <AiPanel
        configured={ai.configured}
        model={ai.model}
        workTitle={workTitle}
        genre={genre}
        chapterTitle={chapterTitle}
        content={content}
        onInsert={onInsert}
      />

      <div className="hairline" />

      <section aria-labelledby="writing-stats-title">
        <div className="flex items-center justify-between gap-2">
          <h2
            id="writing-stats-title"
            className="flex items-center gap-2 text-sm font-semibold"
          >
            <Target size={15} className="text-ink-mute" aria-hidden="true" />
            写作状态
          </h2>
          <span className="text-[10px] tabular-nums text-ink-mute">今日</span>
        </div>

        <div className="mt-3 rounded-3xl bg-surface-2 p-4">
          <div className="flex items-end justify-between gap-2">
            <span className="font-serif text-[28px] font-semibold leading-none tabular-nums">
              {formatNumber(dailyWords)}
            </span>
            <span className="pb-0.5 text-[10px] text-ink-mute">
              / {formatNumber(dailyGoal)} 字
            </span>
          </div>
          <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-line">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${progress}%` }}
            />
          </div>
          <p className="mt-2 text-[10px] leading-5 text-ink-mute">
            {remaining > 0
              ? `还差 ${formatNumber(remaining)} 字完成今日目标`
              : "今日目标已完成，写得稳。"}
          </p>
        </div>

        <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
          <Stat label="本章" value={formatNumber(wordCount)} unit="字" />
          <Stat label="段落" value={String(paragraphs)} unit="段" />
          <Stat label="阅读" value={String(readingMinutes)} unit="分钟" />
        </dl>

        <p className="mt-2.5 flex items-center gap-1.5 text-[10px] text-ink-mute">
          <Clock3 size={11} />
          最近更新 {formatDateTime(updatedAt)}
        </p>
      </section>

      <div className="hairline" />

      <section aria-labelledby="chapter-settings-title">
        <h2
          id="chapter-settings-title"
          className="flex items-center gap-2 text-sm font-semibold"
        >
          <FileText size={15} className="text-ink-mute" aria-hidden="true" />
          本章设置
        </h2>

        <div className="mt-3">
          <span className="text-[10px] font-medium tracking-[0.06em] text-ink-mute">
            章节状态
          </span>
          <div className="segmented mt-1.5 flex w-full">
            {CHAPTER_STATUSES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => onStatusChange(item)}
                data-active={status === item}
                className="segmented-item flex-1 px-0 text-[11px]"
                aria-pressed={status === item}
              >
                {CHAPTER_STATUS_LABEL[item]}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.06em] text-ink-mute">
            <Type size={11} />
            正文字体
          </span>
          <div className="segmented mt-1.5 flex w-full">
            {(
              [
                { id: "serif", label: "宋体" },
                { id: "sans", label: "黑体" },
              ] as const
            ).map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => onFontFamilyChange(item.id)}
                data-active={fontFamily === item.id}
                className="segmented-item flex-1 px-0 text-[11px]"
                aria-pressed={fontFamily === item.id}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>

        <div className="mt-4">
          <span className="flex items-center gap-1.5 text-[10px] font-medium tracking-[0.06em] text-ink-mute">
            <AlignLeft size={11} />
            字号
          </span>
          <div className="mt-1.5 grid grid-cols-4 gap-1">
            {FONT_SIZES.map((size) => (
              <button
                key={size}
                type="button"
                onClick={() => onFontSizeChange(size)}
                aria-pressed={fontSize === size}
                className={cn(
                  "h-8 rounded-full text-[11px] font-medium tabular-nums transition-colors",
                  fontSize === size
                    ? "bg-surface-3 text-ink"
                    : "bg-surface-2 text-ink-mute hover:bg-surface-3 hover:text-ink",
                )}
              >
                {size}
              </button>
            ))}
          </div>
        </div>

        <p className="mt-4 text-[10px] leading-5 text-ink-mute">
          编辑样式只保存在本机，不影响导出与手机预览排版。
        </p>
      </section>
    </div>
  );
}

function Stat({ label, value, unit }: { label: string; value: string; unit: string }) {
  return (
    <div className="rounded-2xl bg-surface-2 px-2 py-3">
      <dt className="text-[10px] text-ink-mute">{label}</dt>
      <dd className="mt-1 text-[15px] font-semibold tabular-nums">
        {value}
        <span className="ml-0.5 text-[9px] font-normal text-ink-mute">{unit}</span>
      </dd>
    </div>
  );
}
