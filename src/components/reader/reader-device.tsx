// Author: yxpil

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BatteryFull,
  ChevronLeft,
  ChevronRight,
  List,
  MessageCircle,
  MoreHorizontal,
  Wifi,
  X,
} from "lucide-react";
import type { ReaderChapter, ReaderWork } from "@/lib/types";
import {
  FONT_STACKS,
  MARGIN_PIXELS,
  READER_THEMES,
  type PlatformPreset,
  type ReaderPrefs,
  type ReaderThemeId,
} from "@/lib/platforms";
import { formatClock } from "@/lib/utils";
import { paragraphList } from "@/lib/words";

const DEVICE_WIDTH = 393;
const PAGE_VERTICAL_PADDING = 20;

type ReaderTheme = (typeof READER_THEMES)[ReaderThemeId];

export function ReaderDevice({
  work,
  chapter,
  chapters,
  platform,
  prefs,
  onSelectChapter,
  onExit,
}: {
  work: ReaderWork;
  chapter: ReaderChapter;
  chapters: ReaderChapter[];
  platform: PlatformPreset;
  prefs: ReaderPrefs;
  onSelectChapter: (chapterId: string) => void;
  onExit: () => void;
}) {
  const theme = READER_THEMES[prefs.theme];
  const margin = MARGIN_PIXELS[prefs.margin];
  const paragraphs = paragraphList(chapter.content);

  const [page, setPage] = useState(0);
  const [pageCount, setPageCount] = useState(1);
  const [contentHeight, setContentHeight] = useState(480);
  const [tocOpen, setTocOpen] = useState(false);
  const [clock, setClock] = useState("");
  const [measureTick, setMeasureTick] = useState(0);

  const viewportRef = useRef<HTMLDivElement>(null);
  const pagesRef = useRef<HTMLDivElement>(null);
  const chapterRef = useRef(chapter.id);
  const pendingLastRef = useRef(false);
  const pointerStartRef = useRef<{
    x: number;
    y: number;
    hadSelection: boolean;
  } | null>(null);

  const index = chapters.findIndex((item) => item.id === chapter.id);
  const previousChapter = index > 0 ? chapters[index - 1] : null;
  const nextChapter = index >= 0 && index < chapters.length - 1 ? chapters[index + 1] : null;

  useEffect(() => {
    setClock(formatClock());
    const timer = window.setInterval(() => setClock(formatClock()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    const node = viewportRef.current;
    if (!node) return;
    const update = () => {
      const next = Math.max(
        120,
        node.clientHeight - PAGE_VERTICAL_PADDING * 2,
      );
      setContentHeight((current) => (current === next ? current : next));
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    let cancelled = false;
    document.fonts?.ready.then(() => {
      if (!cancelled) setMeasureTick((value) => value + 1);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (chapterRef.current === chapter.id) return;
    chapterRef.current = chapter.id;
    const goLast = pendingLastRef.current;
    pendingLastRef.current = false;
    setPageCount(1);
    setPage(goLast ? Number.MAX_SAFE_INTEGER : 0);
    setTocOpen(false);
  }, [chapter.id]);

  useEffect(() => {
    const pages = pagesRef.current;
    if (!pages) return;
    let frame = window.requestAnimationFrame(() => {
      const columnWidth = DEVICE_WIDTH - margin * 2;
      const gap = margin * 2;
      const measured = Math.max(
        1,
        Math.round((pages.scrollWidth + gap) / (columnWidth + gap)),
      );
      setPageCount(measured);
      setPage((current) => Math.min(current, measured - 1));
    });
    return () => window.cancelAnimationFrame(frame);
  }, [
    chapter.content,
    contentHeight,
    prefs.fontSize,
    prefs.lineHeight,
    prefs.margin,
    prefs.font,
    platform.id,
    measureTick,
  ]);

  const goNextPage = useCallback(() => {
    if (page < pageCount - 1) {
      setPage((current) => Math.min(current + 1, pageCount - 1));
      return;
    }
    if (nextChapter) {
      onSelectChapter(nextChapter.id);
    }
  }, [nextChapter, onSelectChapter, page, pageCount]);

  const goPrevPage = useCallback(() => {
    if (page > 0) {
      setPage((current) => Math.max(0, current - 1));
      return;
    }
    if (previousChapter) {
      pendingLastRef.current = true;
      onSelectChapter(previousChapter.id);
    }
  }, [onSelectChapter, page, previousChapter]);

  const goNextChapter = () => {
    if (nextChapter) onSelectChapter(nextChapter.id);
  };

  const selectFromToc = (chapterId: string) => {
    setTocOpen(false);
    if (chapterId === chapter.id) {
      setPage(0);
      return;
    }
    onSelectChapter(chapterId);
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (tocOpen) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      const target = event.target as HTMLElement | null;
      if (
        target?.closest(
          "input, textarea, select, button, a, [contenteditable='true']",
        )
      ) {
        return;
      }
      if (event.key === "ArrowLeft" || event.key === "PageUp") {
        event.preventDefault();
        goPrevPage();
      } else if (event.key === "ArrowRight" || event.key === "PageDown") {
        event.preventDefault();
        goNextPage();
      } else if (event.key === " ") {
        event.preventDefault();
        if (event.shiftKey) goPrevPage();
        else goNextPage();
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [goNextPage, goPrevPage, tocOpen]);

  const handlePointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    const selection = window.getSelection()?.toString() ?? "";
    pointerStartRef.current = {
      x: event.clientX,
      y: event.clientY,
      hadSelection: selection.length > 0,
    };
  };

  const handlePointerUp = (event: React.PointerEvent<HTMLDivElement>) => {
    const start = pointerStartRef.current;
    pointerStartRef.current = null;
    if (!start) return;
    const selection = window.getSelection()?.toString() ?? "";
    if (start.hadSelection || selection.trim()) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) {
      if (dx < 0) goNextPage();
      else goPrevPage();
      return;
    }
    if (Math.abs(dx) < 8 && Math.abs(dy) < 8) {
      const rect = event.currentTarget.getBoundingClientRect();
      const ratio = (event.clientX - rect.left) / rect.width;
      if (ratio < 0.35) goPrevPage();
      else goNextPage();
    }
  };

  const chapterPercent = Math.round(((page + 1) / pageCount) * 100);

  return (
    <div
      className="relative flex h-[852px] w-[393px] flex-col overflow-hidden rounded-[44px]"
      style={{ backgroundColor: theme.bg, color: theme.text }}
    >
      <span
        className="absolute left-1/2 top-[7px] z-20 h-2.5 w-2.5 -translate-x-1/2 rounded-full bg-[#050505]"
        aria-hidden="true"
      />

      <div
        className="flex h-8 flex-none items-center justify-between px-5 text-[11px] font-medium"
        style={{ color: theme.text }}
      >
        <span className="tabular-nums">{clock}</span>
        <span className="flex items-center gap-1 opacity-75" aria-hidden="true">
          <Wifi size={12} strokeWidth={2} />
          <BatteryFull size={14} strokeWidth={1.75} />
        </span>
      </div>

      <Chrome
        platform={platform}
        theme={theme}
        workTitle={work.title}
        chapterTitle={chapter.title}
        onExit={onExit}
        onOpenToc={() => setTocOpen(true)}
      />

      <div
        ref={viewportRef}
        className="relative min-h-0 flex-1 select-text overflow-hidden"
        style={{ touchAction: "pan-y", color: theme.text }}
        onPointerDown={handlePointerDown}
        onPointerUp={handlePointerUp}
      >
        <div
          ref={pagesRef}
          className="reader-pages"
          style={{
            position: "absolute",
            top: PAGE_VERTICAL_PADDING,
            left: margin,
            width: DEVICE_WIDTH - margin * 2,
            height: contentHeight,
            columnWidth: DEVICE_WIDTH - margin * 2,
            columnGap: margin * 2,
            columnFill: "auto",
            transform: `translate3d(-${page * DEVICE_WIDTH}px, 0, 0)`,
            transition:
              prefs.pageTurn === "slide"
                ? "transform 300ms cubic-bezier(0.2, 0.7, 0.2, 1)"
                : "none",
            willChange: "transform",
            fontFamily: FONT_STACKS[prefs.font],
            fontSize: `${prefs.fontSize}px`,
            lineHeight: prefs.lineHeight,
            color: theme.text,
          }}
        >
          <h1
            style={{
              textAlign: "center",
              fontSize: "1.35em",
              fontWeight: 600,
              lineHeight: 1.5,
              letterSpacing: "0.02em",
              margin: "0 0 1.2em",
            }}
          >
            {chapter.title}
          </h1>
          {paragraphs.length > 0 ? (
            paragraphs.map((paragraph, paragraphIndex) => (
              <p
                key={paragraphIndex}
                style={{
                  textIndent: "2em",
                  textAlign: "justify",
                  margin: "0 0 0.8em",
                  overflowWrap: "break-word",
                }}
              >
                {paragraph}
              </p>
            ))
          ) : (
            <p style={{ color: theme.muted, textAlign: "center" }}>
              本章还没有正文。
            </p>
          )}
        </div>
      </div>

      <Footer
        platform={platform}
        theme={theme}
        chapter={chapter}
        page={page}
        pageCount={pageCount}
        chapterPercent={chapterPercent}
        hasNextChapter={Boolean(nextChapter)}
        onNextChapter={goNextChapter}
      />

      <div
        className="flex h-5 flex-none items-center justify-center"
        style={{ backgroundColor: theme.bg }}
      >
        <span
          className="h-1 w-28 rounded-full"
          style={{ backgroundColor: theme.text, opacity: 0.22 }}
          aria-hidden="true"
        />
      </div>

      {tocOpen ? (
        <div className="absolute inset-0 z-30">
          <button
            type="button"
            aria-label="关闭目录"
            className="absolute inset-0 bg-black/35"
            onClick={() => setTocOpen(false)}
          />
          <div
            className="animate-slide-up absolute inset-x-0 bottom-0 flex max-h-[74%] flex-col overflow-hidden rounded-t-[24px] border-t shadow-float"
            style={{
              backgroundColor: theme.bg,
              borderColor: theme.line,
              color: theme.text,
            }}
            role="dialog"
            aria-modal="true"
            aria-label="目录"
          >
            <div
              className="flex flex-none items-center justify-between px-4 py-3"
              style={{ borderBottom: `1px solid ${theme.line}` }}
            >
              <span className="text-[13px] font-semibold">目录</span>
              <button
                type="button"
                onClick={() => setTocOpen(false)}
                className="flex h-7 w-7 items-center justify-center rounded-full"
                style={{ backgroundColor: theme.soft, color: theme.text }}
                aria-label="关闭目录"
              >
                <X size={15} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-2 py-2">
              {chapters.map((item, itemIndex) => {
                const active = item.id === chapter.id;
                const showVolume =
                  itemIndex === 0 ||
                  chapters[itemIndex - 1].volumeTitle !== item.volumeTitle;
                return (
                  <div key={item.id}>
                    {showVolume ? (
                      <p
                        className="px-3 pb-1 pt-3 text-[9px] font-medium tracking-[0.1em]"
                        style={{ color: theme.muted }}
                      >
                        {item.volumeTitle}
                      </p>
                    ) : null}
                    <button
                      type="button"
                      onClick={() => selectFromToc(item.id)}
                      className="flex w-full items-center gap-2 rounded-2xl px-3 py-2 text-left"
                      style={{
                        backgroundColor: active ? theme.soft : "transparent",
                        color: active ? platform.accent : theme.text,
                      }}
                    >
                      <span
                        className="w-5 flex-none text-[10px] tabular-nums"
                        style={{ color: active ? platform.accent : theme.muted }}
                      >
                        {String(itemIndex + 1).padStart(2, "0")}
                      </span>
                      <span className="min-w-0 flex-1 truncate text-[12px]">
                        {item.title}
                      </span>
                      {active ? (
                        <span
                          className="h-1.5 w-1.5 flex-none rounded-full"
                          style={{ backgroundColor: platform.accent }}
                        />
                      ) : null}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Chrome({
  platform,
  theme,
  workTitle,
  chapterTitle,
  onExit,
  onOpenToc,
}: {
  platform: PlatformPreset;
  theme: ReaderTheme;
  workTitle: string;
  chapterTitle: string;
  onExit: () => void;
  onOpenToc: () => void;
}) {
  const iconButton = "flex h-8 w-8 flex-none items-center justify-center rounded-full";

  if (platform.chrome === "minimal") {
    return (
      <div
        className="flex h-11 flex-none items-center justify-between gap-2 px-4"
        style={{ borderBottom: `1px solid ${theme.line}`, color: theme.text }}
      >
        <span className="min-w-0 flex-1 truncate text-[12px] font-medium">
          {workTitle}
        </span>
        <span
          className={`${iconButton} opacity-50`}
          title="界面模拟，不提供更多功能"
          aria-hidden="true"
        >
          <MoreHorizontal size={18} />
        </span>
      </div>
    );
  }

  if (platform.chrome === "chapter") {
    return (
      <div
        className="relative flex h-11 flex-none items-center justify-center px-14"
        style={{ borderBottom: `1px solid ${theme.line}`, color: theme.text }}
      >
        <span className="min-w-0 truncate text-[12px] font-medium">
          {chapterTitle}
        </span>
        <button
          type="button"
          onClick={onOpenToc}
          className={`${iconButton} absolute right-2`}
          style={{ color: theme.text }}
          aria-label="打开目录"
          title="目录"
        >
          <List size={18} />
        </button>
      </div>
    );
  }

  return (
    <div
      className="flex h-11 flex-none items-center justify-between gap-2 px-2"
      style={{ borderBottom: `1px solid ${theme.line}`, color: theme.text }}
    >
      <button
        type="button"
        onClick={onExit}
        className={iconButton}
        style={{ color: theme.text }}
        aria-label="退出预览，返回作品"
        title="退出预览，返回作品"
      >
        <ChevronLeft size={20} />
      </button>
      <span className="min-w-0 flex-1 truncate text-center text-[12px] font-medium">
        {workTitle}
      </span>
      <button
        type="button"
        onClick={onOpenToc}
        className={iconButton}
        style={{ color: theme.text }}
        aria-label="打开目录"
        title="目录"
      >
        <List size={18} />
      </button>
    </div>
  );
}

function Footer({
  platform,
  theme,
  chapter,
  page,
  pageCount,
  chapterPercent,
  hasNextChapter,
  onNextChapter,
}: {
  platform: PlatformPreset;
  theme: ReaderTheme;
  chapter: ReaderChapter;
  page: number;
  pageCount: number;
  chapterPercent: number;
  hasNextChapter: boolean;
  onNextChapter: () => void;
}) {
  const pageLabel = `${page + 1} / ${pageCount}`;
  const buttonStyle = {
    backgroundColor: platform.accent,
    color: "#FFFFFF",
    opacity: hasNextChapter ? 1 : 0.35,
  };

  if (platform.footer === "progress") {
    const progress = Math.round(((page + 1) / pageCount) * 100);
    return (
      <div
        className="flex h-12 flex-none flex-col justify-center gap-2 px-5"
        style={{
          borderTop: `1px solid ${theme.line}`,
          backgroundColor: theme.bg,
          color: theme.muted,
        }}
      >
        <div className="flex items-center justify-between gap-3 text-[10px]">
          <span className="min-w-0 truncate">{chapter.title}</span>
          <span className="flex-none tabular-nums">{pageLabel}</span>
        </div>
        <div
          className="h-0.5 w-full rounded-full"
          style={{ backgroundColor: theme.line }}
        >
          <div
            className="h-full rounded-full transition-[width] duration-300"
            style={{ width: `${progress}%`, backgroundColor: platform.accent }}
          />
        </div>
      </div>
    );
  }

  if (platform.footer === "next" || platform.footer === "nextLarge") {
    const large = platform.footer === "nextLarge";
    return (
      <div
        className={`flex flex-none items-center justify-between gap-3 px-4 ${
          large ? "h-14" : "h-12"
        }`}
        style={{
          borderTop: `1px solid ${theme.line}`,
          backgroundColor: theme.bg,
          color: theme.muted,
        }}
      >
        <span className="text-[10px] tabular-nums">{pageLabel}</span>
        <button
          type="button"
          onClick={onNextChapter}
          disabled={!hasNextChapter}
          className={`flex items-center gap-1 rounded-full font-medium ${
            large ? "h-9 px-5 text-[12px] font-semibold" : "h-8 px-3.5 text-[11px]"
          }`}
          style={buttonStyle}
        >
          下一章
          <ChevronRight size={large ? 15 : 13} />
        </button>
      </div>
    );
  }

  if (platform.footer === "comment") {
    return (
      <div
        className="flex h-12 flex-none items-center justify-between gap-3 px-4"
        style={{
          borderTop: `1px solid ${theme.line}`,
          backgroundColor: theme.bg,
          color: theme.muted,
        }}
      >
        <span className="text-[10px] tabular-nums">{pageLabel}</span>
        <span
          className="flex h-8 items-center gap-1 rounded-full px-3 text-[11px]"
          style={{ backgroundColor: theme.soft, color: theme.muted }}
          title="界面模拟，不提供评论功能"
          aria-disabled="true"
        >
          <MessageCircle size={13} />
          本章评论
        </span>
      </div>
    );
  }

  return (
    <div
      className="flex h-12 flex-none items-center justify-between gap-3 px-4"
      style={{
        borderTop: `1px solid ${theme.line}`,
        backgroundColor: theme.bg,
        color: theme.muted,
      }}
    >
      <span
        className="text-[10px] font-medium tabular-nums"
        style={{ color: platform.accent }}
      >
        {chapterPercent}%
      </span>
      <span className="text-[10px] tabular-nums">{pageLabel}</span>
    </div>
  );
}
