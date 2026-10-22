// Author: yxpil

"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ChevronRight,
  Loader2,
  Plus,
  Search,
  Settings2,
  X,
} from "lucide-react";
import type { ChapterMeta, ChapterStatus, VolumeSummary } from "@/lib/types";
import { CHAPTER_STATUS_LABEL } from "@/lib/constants";
import { cn, formatNumber } from "@/lib/utils";

const DOT: Record<ChapterStatus, string> = {
  draft: "bg-ink-mute",
  ready: "bg-gold",
  published: "bg-accent",
};

export function ChapterOutline({
  workId,
  volumes,
  chapters,
  currentChapterId,
  addingIn,
  onSelect,
  onAddChapter,
  onManage,
  onClose,
}: {
  workId: string;
  volumes: VolumeSummary[];
  chapters: ChapterMeta[];
  currentChapterId: string;
  addingIn: string | null;
  onSelect: (chapterId: string) => void;
  onAddChapter: (volumeId: string) => void;
  onManage: () => void;
  onClose?: () => void;
}) {
  const [query, setQuery] = useState("");
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const activeRef = useRef<HTMLButtonElement>(null);

  const grouped = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return volumes.map((volume) => ({
      volume,
      chapters: chapters.filter(
        (chapter) =>
          chapter.volumeId === volume.id &&
          (!needle || chapter.title.toLowerCase().includes(needle)),
      ),
    }));
  }, [chapters, query, volumes]);

  const searching = query.trim().length > 0;
  const visibleCount = grouped.reduce((total, group) => total + group.chapters.length, 0);

  useEffect(() => {
    activeRef.current?.scrollIntoView({ block: "nearest" });
  }, [currentChapterId]);

  const toggle = (volumeId: string) => {
    setCollapsed((current) => {
      const next = new Set(current);
      if (next.has(volumeId)) next.delete(volumeId);
      else next.add(volumeId);
      return next;
    });
  };

  return (
    <div className="flex h-full min-h-0 flex-col" data-work-id={workId}>
      <div className="flex items-center justify-between gap-2 px-4 pb-3 pt-5">
        <div>
          <h2 className="text-sm font-semibold">目录</h2>
          <p className="mt-0.5 text-[10px] text-ink-mute">
            {chapters.length} 章 · {volumes.length} 卷
          </p>
        </div>
        <div className="flex items-center gap-0.5">
          <button
            type="button"
            className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[11px] font-medium text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink"
            onClick={onManage}
          >
            <Settings2 size={13} />
            管理
          </button>
          {onClose ? (
            <button
              type="button"
              onClick={onClose}
              className="icon-capsule h-7 w-7"
              aria-label="关闭目录"
            >
              <X size={15} />
            </button>
          ) : null}
        </div>
      </div>

      <div className="px-3 pb-3">
        <div className="relative">
          <Search
            size={14}
            className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
            aria-hidden="true"
          />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="搜索章节"
            aria-label="搜索章节"
            className="h-9 w-full rounded-full border border-transparent bg-surface-2 pl-8 pr-3 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent focus:bg-surface"
          />
        </div>
      </div>

      <div className="hide-scrollbar min-h-0 flex-1 overflow-y-auto px-2 pb-6">
        {grouped.map(({ volume, chapters: volumeChapters }) => {
          if (searching && volumeChapters.length === 0) return null;
          const open = searching || !collapsed.has(volume.id);
          return (
            <div key={volume.id} className="pb-1">
              <div className="group flex items-center gap-0.5">
                <button
                  type="button"
                  onClick={() => toggle(volume.id)}
                  aria-expanded={open}
                  className="flex min-w-0 flex-1 items-center gap-1.5 rounded-2xl px-2 py-2 text-left transition-colors hover:bg-surface-2"
                >
                  <ChevronRight
                    size={13}
                    className={cn(
                      "flex-none text-ink-mute transition-transform",
                      open && "rotate-90",
                    )}
                    aria-hidden="true"
                  />
                  <span className="min-w-0 flex-1 truncate text-[11px] font-semibold tracking-[0.04em] text-ink-soft">
                    {volume.title}
                  </span>
                  <span className="flex-none text-[10px] tabular-nums text-ink-mute">
                    {volumeChapters.length}
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onAddChapter(volume.id)}
                  disabled={addingIn === volume.id}
                  className="flex h-7 w-7 flex-none items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink"
                  aria-label={`在 ${volume.title} 新增章节`}
                  title="在本卷新增章节"
                >
                  {addingIn === volume.id ? (
                    <Loader2 size={13} className="animate-spin-slow" />
                  ) : (
                    <Plus size={13} />
                  )}
                </button>
              </div>

              {open ? (
                <ul className="mt-0.5 space-y-0.5 pl-1">
                  {volumeChapters.map((chapter, index) => {
                    const active = chapter.id === currentChapterId;
                    return (
                      <li key={chapter.id}>
                        <button
                          ref={active ? activeRef : undefined}
                          type="button"
                          onClick={() => onSelect(chapter.id)}
                          aria-current={active ? "page" : undefined}
                          title={`${CHAPTER_STATUS_LABEL[chapter.status]} · ${formatNumber(chapter.wordCount)} 字`}
                          className={cn(
                            "flex w-full items-start gap-2 rounded-2xl px-2.5 py-2 text-left transition-colors",
                            active
                              ? "bg-accent-soft text-accent"
                              : "text-ink-soft hover:bg-surface-2 hover:text-ink",
                          )}
                        >
                          <span
                            className={cn(
                              "mt-[7px] h-1.5 w-1.5 flex-none rounded-full",
                              DOT[chapter.status],
                            )}
                            aria-hidden="true"
                          />
                          <span className="min-w-0 flex-1">
                            <span
                              className={cn(
                                "block truncate text-[12px] leading-5",
                                active ? "font-semibold" : "font-medium",
                              )}
                            >
                              {chapter.title}
                            </span>
                            <span className="mt-0.5 block text-[10px] tabular-nums text-ink-mute">
                              {String(index + 1).padStart(2, "0")} ·{" "}
                              {formatNumber(chapter.wordCount)} 字
                            </span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                  {volumeChapters.length === 0 ? (
                    <li className="px-2.5 py-2 text-[11px] text-ink-mute">
                      {searching ? "本卷没有匹配章节" : "本卷还没有章节"}
                    </li>
                  ) : null}
                </ul>
              ) : null}
            </div>
          );
        })}

        {searching && visibleCount === 0 ? (
          <p className="px-3 py-8 text-center text-[11px] leading-5 text-ink-mute">
            没有找到标题包含「{query.trim()}」的章节。
          </p>
        ) : null}
      </div>
    </div>
  );
}
