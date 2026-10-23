// Author: yxpil

"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  ArrowLeft,
  BookMarked,
  Focus,
  History,
  ImagePlus,
  PanelLeft,
  PanelRight,
  Smartphone,
  X,
} from "lucide-react";
import type { ChapterStatus, EditorBundle } from "@/lib/types";
import { useAutosave } from "@/hooks/use-autosave";
import { useStoredNumber } from "@/hooks/use-stored-number";
import {
  CHAPTER_STATUS_LABEL,
  DAILY_GOAL_KEY,
  DEFAULT_DAILY_GOAL,
  EDITOR_FONT_KEY,
  EDITOR_SIZE_KEY,
} from "@/lib/constants";
import { countParagraphs, countWords, paragraphList, readingMinutes } from "@/lib/words";
import { apiFetch } from "@/lib/api-client";
import { cn, formatDateTime, formatNumber, initialOf } from "@/lib/utils";
import { capsule } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { ChapterOutline } from "./chapter-outline";
import { ChapterIllustrations } from "./chapter-illustrations";
import { EditorSidePanel, type EditorFont } from "./editor-side-panel";
import { StoryBiblePanel } from "./story-bible";
import { SaveStatus } from "./save-status";

export function EditorWorkspace({
  initial,
  ai,
}: {
  initial: EditorBundle;
  ai: { configured: boolean; model: string | null };
}) {
  const chapter = initial.chapter;
  const work = initial.work;
  const router = useRouter();
  const { toast } = useToast();

  const [title, setTitle] = useState(chapter.title);
  const [content, setContent] = useState(chapter.content);
  const [status, setStatus] = useState<ChapterStatus>(chapter.status);
  const [fontFamily, setFontFamily] = useState<EditorFont>("serif");
  const [fontSize, setFontSize] = useState(17);
  const [focusMode, setFocusMode] = useState(false);
  const [outlineOpen, setOutlineOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [panelMode, setPanelMode] = useState<"assist" | "bible">("assist");
  const [bibleOpen, setBibleOpen] = useState(false);
  const [storyEntities, setStoryEntities] = useState(initial.storyEntities);
  const [illustrations, setIllustrations] = useState(initial.illustrations);
  const [addingIn, setAddingIn] = useState<string | null>(null);
  const [remoteConfirm, setRemoteConfirm] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const dailyGoal = useStoredNumber(DAILY_GOAL_KEY, DEFAULT_DAILY_GOAL);

  const {
    saveState,
    savedAt,
    conflict,
    recoverable,
    flush,
    forceSave,
    dismissRecovery,
  } = useAutosave({
    chapterId: chapter.id,
    initial: {
      title: chapter.title,
      content: chapter.content,
      status: chapter.status,
      updatedAt: chapter.updatedAt,
    },
    title,
    content,
    status,
  });

  useEffect(() => {
    try {
      const storedFont = window.localStorage.getItem(EDITOR_FONT_KEY);
      if (storedFont === "serif" || storedFont === "sans") setFontFamily(storedFont);
      const storedSize = Number(window.localStorage.getItem(EDITOR_SIZE_KEY));
      if (Number.isInteger(storedSize) && storedSize >= 14 && storedSize <= 24) {
        setFontSize(storedSize);
      }
    } catch {
      // Styling preferences are optional; defaults keep the editor usable.
    }
  }, []);

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;
    node.style.height = "auto";
    node.style.height = `${Math.max(node.scrollHeight, 320)}px`;
  }, [content, fontFamily, fontSize, focusMode]);

  const wordCount = useMemo(() => countWords(content), [content]);
  const paragraphs = useMemo(() => countParagraphs(content), [content]);
  const minutes = useMemo(() => readingMinutes(content), [content]);
  const sessionGrowth = Math.max(0, wordCount - chapter.wordCount);
  const dailyWords = initial.dailyWords + sessionGrowth;

  const volume = initial.volumes.find((item) => item.id === chapter.volumeId);
  const chapterIndex = initial.chapters.findIndex((item) => item.id === chapter.id);
  const chapterNumber = chapterIndex >= 0 ? chapterIndex + 1 : 1;
  const totalChapters = initial.chapters.length;

  const statusChipClass =
    status === "published" ? "chip chip-accent" : status === "ready" ? "chip chip-gold" : "chip";

  const leave = useCallback(
    async (href: string) => {
      if (conflict) {
        toast("这一章在别处有更新，请先处理保存冲突", "danger");
        return;
      }
      const ok = await flush();
      if (!ok) {
        toast("本章尚未保存成功，本地草稿已保留", "danger");
        return;
      }
      setOutlineOpen(false);
      setPanelOpen(false);
      setBibleOpen(false);
      router.push(href);
    },
    [conflict, flush, router, toast],
  );

  const selectChapter = (chapterId: string) => {
    if (chapterId === chapter.id) {
      setOutlineOpen(false);
      return;
    }
    void leave(`/write/${chapterId}`);
  };

  const addChapter = async (volumeId: string) => {
    if (addingIn || conflict) {
      if (conflict) toast("请先处理保存冲突，再新建章节", "danger");
      return;
    }
    setAddingIn(volumeId);
    try {
      const saved = await flush();
      if (!saved) {
        toast("当前章节尚未保存成功，暂不新建", "danger");
        return;
      }
      const data = await apiFetch<{ chapterId: string }>(
        `/api/works/${work.id}/chapters`,
        { method: "POST", body: JSON.stringify({ volumeId }) },
      );
      setOutlineOpen(false);
      router.push(`/write/${data.chapterId}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "新建章节失败", "danger");
    } finally {
      setAddingIn(null);
    }
  };

  const manualSave = useCallback(async () => {
    const ok = await flush();
    if (ok) {
      toast("已保存");
    } else {
      toast("保存未完成，请检查网络或保存状态", "danger");
    }
  }, [flush, toast]);

  const loadRecovery = () => {
    if (!recoverable) return;
    setTitle(recoverable.title);
    setContent(recoverable.content);
    setStatus(recoverable.status);
    dismissRecovery();
    toast("已载入本机草稿，正在同步");
  };

  const overwriteRemote = async () => {
    const ok = await forceSave();
    if (ok) toast("已用本地版本覆盖远端");
    else toast("覆盖失败，请稍后重试", "danger");
  };

  const loadRemote = () => {
    dismissRecovery();
    window.location.reload();
  };

  const insertSuggestion = (text: string) => {
    const node = textareaRef.current;
    const start = node?.selectionStart ?? content.length;
    const end = node?.selectionEnd ?? start;
    const lead = start > 0 && content[start - 1] !== "\n" ? "\n\n" : "";
    const tail = end < content.length && content[end] !== "\n" ? "\n\n" : "";
    const next = `${content.slice(0, start)}${lead}${text}${tail}${content.slice(end)}`;
    setContent(next);
    setPanelOpen(false);
    window.requestAnimationFrame(() => {
      const target = textareaRef.current;
      if (!target) return;
      target.focus();
      const caret = start + lead.length + text.length;
      target.setSelectionRange(caret, caret);
    });
    toast("建议已插入，确认内容后会自动保存");
  };

  const changeFont = (font: EditorFont) => {
    setFontFamily(font);
    try {
      window.localStorage.setItem(EDITOR_FONT_KEY, font);
    } catch {
      // Ignore storage failures; the selection still applies this session.
    }
  };

  const changeSize = (size: number) => {
    setFontSize(size);
    try {
      window.localStorage.setItem(EDITOR_SIZE_KEY, String(size));
    } catch {
      // Ignore storage failures; the selection still applies this session.
    }
  };

  const getCaretParagraph = useCallback(() => {
    const total = paragraphList(content).length;
    const node = textareaRef.current;
    const caret = node ? node.selectionStart : content.length;
    return Math.min(total, paragraphList(content.slice(0, caret)).length);
  }, [content]);

  const openIllustrations = () => {
    document
      .getElementById("chapter-illustrations")
      ?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const openStoryBible = () => {
    if (window.matchMedia("(min-width: 1280px)").matches) {
      setPanelMode("bible");
    } else {
      setBibleOpen(true);
    }
  };

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const mod = event.metaKey || event.ctrlKey;
      if (mod && !event.altKey && event.key.toLowerCase() === "s") {
        event.preventDefault();
        void manualSave();
        return;
      }
      if (mod && event.shiftKey && event.key.toLowerCase() === "f") {
        event.preventDefault();
        setFocusMode((value) => !value);
        return;
      }
      if (event.key !== "Escape" || remoteConfirm) return;
      if (document.querySelector('[role="dialog"][aria-modal="true"]')) return;
      if (outlineOpen) {
        setOutlineOpen(false);
        return;
      }
      if (panelOpen) {
        setPanelOpen(false);
        return;
      }
      if (bibleOpen) {
        setBibleOpen(false);
        return;
      }
      if (focusMode) setFocusMode(false);
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [bibleOpen, focusMode, manualSave, outlineOpen, panelOpen, remoteConfirm]);

  const outlineProps = {
    workId: work.id,
    volumes: initial.volumes,
    chapters: initial.chapters,
    currentChapterId: chapter.id,
    addingIn,
    onSelect: selectChapter,
    onAddChapter: addChapter,
    onManage: () => void leave(`/works/${work.id}`),
  };

  const sidePanelProps = {
    ai,
    workTitle: work.title,
    genre: work.genre,
    chapterTitle: title,
    content,
    onInsert: insertSuggestion,
    dailyWords,
    dailyGoal,
    wordCount,
    paragraphs,
    readingMinutes: minutes,
    updatedAt: chapter.updatedAt,
    status,
    onStatusChange: setStatus,
    fontFamily,
    onFontFamilyChange: changeFont,
    fontSize,
    onFontSizeChange: changeSize,
  };

  return (
    <div className="flex h-dvh flex-col overflow-hidden bg-paper">
      {focusMode ? (
        <header className="flex h-12 flex-none items-center justify-between gap-3 border-b border-line bg-paper px-3 sm:px-5">
          <span className="flex min-w-0 items-center gap-2 text-[12px] font-medium">
            <Focus size={15} className="flex-none text-accent" />
            专注写作
            <span className="hidden truncate text-ink-mute sm:inline">· {work.title}</span>
          </span>
          <div className="flex flex-none items-center gap-2">
            <SaveStatus state={saveState} savedAt={savedAt} compactLabel />
            <button
              type="button"
              className={capsule("outline", "sm")}
              onClick={() => setFocusMode(false)}
            >
              退出专注
              <span className="hidden text-ink-mute sm:inline">Esc</span>
            </button>
          </div>
        </header>
      ) : (
        <header className="flex h-14 flex-none items-center justify-between gap-2 border-b border-line bg-paper px-2 sm:px-4">
          <div className="flex min-w-0 flex-1 items-center gap-1">
            <button
              type="button"
              onClick={() => void leave(`/works/${work.id}`)}
              className="icon-capsule h-9 w-9"
              aria-label="返回作品目录"
              title="返回作品目录"
            >
              <ArrowLeft size={18} />
            </button>
            <button
              type="button"
              onClick={() => setOutlineOpen(true)}
              className="icon-capsule h-9 w-9 lg:hidden"
              aria-label="打开章节目录"
            >
              <PanelLeft size={17} />
            </button>
            <div className="min-w-0 px-1">
              <p className="hidden truncate text-[10px] text-ink-mute sm:block">{work.title}</p>
              <p className="truncate text-[11px] font-medium text-ink-soft sm:text-[12px]">
                {volume?.title ?? "未分卷"} · 第 {chapterNumber} / {totalChapters} 章
              </p>
            </div>
          </div>

          <div className="flex flex-none items-center gap-1 sm:gap-1.5">
            <span className="mr-1 hidden items-center rounded-full border border-line px-2.5 py-1 md:inline-flex">
              <SaveStatus state={saveState} savedAt={savedAt} showTime />
            </span>
            <span className="px-0.5 md:hidden">
              <SaveStatus state={saveState} savedAt={savedAt} compactLabel />
            </span>
            <button
              type="button"
              onClick={() =>
                void leave(`/preview/${work.id}?chapter=${chapter.id}&platform=qidian`)
              }
              className={capsule("outline", "sm", "h-9 px-2.5 sm:px-4")}
              aria-label="打开手机预览"
              title="手机预览"
            >
              <Smartphone size={15} />
              <span className="hidden sm:inline">预览</span>
            </button>
            <button
              type="button"
              onClick={() => setFocusMode(true)}
              className="icon-capsule hidden h-9 w-9 md:inline-flex"
              aria-label="进入专注模式"
              title="专注模式（Ctrl / Cmd + Shift + F）"
            >
              <Focus size={17} />
            </button>
            <button
              type="button"
              onClick={openStoryBible}
              className={cn(
                "icon-capsule h-9 w-9",
                panelMode === "bible" && "xl:bg-accent-soft xl:text-accent",
              )}
              aria-label="打开故事设定与角色"
              title="故事设定与角色"
            >
              <BookMarked size={17} />
            </button>
            <span className="hidden md:inline-flex">
              <ThemeToggle />
            </span>
            <button
              type="button"
              onClick={() => setPanelOpen(true)}
              className="icon-capsule h-9 w-9 xl:hidden"
              aria-label="打开 AI 助手与本章设置"
              title="AI 助手与设置"
            >
              <PanelRight size={17} />
            </button>
            <Link
              href="/settings"
              className="ml-0.5 hidden h-9 items-center gap-2 rounded-full pl-0.5 pr-3 transition-colors hover:bg-surface-2 lg:flex"
              aria-label="打开设置"
            >
              <span
                className="flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-semibold text-on-cover"
                style={{ backgroundColor: initial.user.avatarColor }}
              >
                {initialOf(initial.user.name)}
              </span>
              <span className="max-w-20 truncate text-[12px] font-medium">
                {initial.user.name}
              </span>
            </Link>
          </div>
        </header>
      )}

      <div className="flex min-h-0 flex-1">
        {!focusMode ? (
          <aside className="hidden w-[248px] flex-none border-r border-line bg-paper lg:block">
            <ChapterOutline {...outlineProps} />
          </aside>
        ) : null}

        <main className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
          <div
            className={cn(
              "mx-auto w-full px-2.5 pb-16 pt-4 sm:px-6 sm:pt-6",
              focusMode ? "max-w-[900px]" : "max-w-[840px]",
            )}
          >
            {conflict ? (
              <div className="mb-4 rounded-[26px] border border-danger/30 bg-danger-soft p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-danger">
                    <AlertTriangle size={16} />
                  </span>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-danger">这一章在别处被更新</p>
                    <p className="mt-1 text-[11px] leading-5 text-ink-soft">
                      远端保存于 {formatDateTime(conflict.remoteUpdatedAt)}，共{" "}
                      {formatNumber(conflict.remoteWordCount)} 字。本地版本尚未覆盖，请选择处理方式。
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap gap-2 pl-11">
                  <button
                    type="button"
                    className={capsule("primary", "sm")}
                    onClick={() => void overwriteRemote()}
                  >
                    保留本地并覆盖
                  </button>
                  <button
                    type="button"
                    className={capsule("outline", "sm")}
                    onClick={() => setRemoteConfirm(true)}
                  >
                    载入远端版本
                  </button>
                </div>
              </div>
            ) : null}

            {recoverable ? (
              <div className="mb-4 flex flex-col gap-3 rounded-[26px] border border-line bg-surface-2 p-4 sm:flex-row sm:items-center sm:p-5">
                <div className="flex items-start gap-3">
                  <span className="mt-0.5 flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface text-accent">
                    <History size={16} />
                  </span>
                  <div>
                    <p className="text-[13px] font-semibold">发现本机未同步的草稿</p>
                    <p className="mt-1 text-[11px] leading-5 text-ink-mute">
                      保存于 {formatDateTime(recoverable.savedLocallyAt)} ·{" "}
                      {formatNumber(countWords(recoverable.content))} 字
                    </p>
                  </div>
                </div>
                <div className="flex flex-none gap-2 sm:ml-auto">
                  <button
                    type="button"
                    className={capsule("primary", "sm")}
                    onClick={loadRecovery}
                  >
                    载入草稿
                  </button>
                  <button
                    type="button"
                    className={capsule("ghost", "sm")}
                    onClick={dismissRecovery}
                  >
                    丢弃
                  </button>
                </div>
              </div>
            ) : null}

            <article className="rounded-[28px] border border-line bg-surface px-5 py-7 shadow-soft sm:px-10 sm:py-10 lg:px-14">
              <div className="flex flex-wrap items-center gap-2">
                <span className={statusChipClass}>{CHAPTER_STATUS_LABEL[status]}</span>
                <span className="text-[10px] text-ink-mute">{volume?.title ?? "未分卷"}</span>
                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={openIllustrations}
                    className={capsule("ghost", "sm", "h-7 px-2 text-[10px]")}
                    aria-label="查看本章插画"
                    title="查看本章插画"
                  >
                    <ImagePlus size={12} />
                    插画{illustrations.length > 0 ? ` ${illustrations.length}` : ""}
                  </button>
                  <span className="text-[10px] tabular-nums text-ink-mute">
                    第 {chapterNumber} / {totalChapters} 章
                  </span>
                </div>
              </div>

              <input
                value={title}
                onChange={(event) => setTitle(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    textareaRef.current?.focus();
                  }
                }}
                placeholder="未命名章节"
                aria-label="章节标题"
                maxLength={120}
                className="mt-3 w-full border-0 bg-transparent font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] text-ink outline-none placeholder:text-ink-mute sm:text-[32px]"
              />

              <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-mute">
                <span>{volume?.title ?? "未分卷"}</span>
                <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden="true" />
                <span>{formatNumber(wordCount)} 字</span>
                <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden="true" />
                <span>{paragraphs} 段</span>
                <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden="true" />
                <span>约 {minutes} 分钟</span>
              </div>

              <div className="my-5 h-px bg-line sm:my-7" />

              <textarea
                ref={textareaRef}
                value={content}
                onChange={(event) => setContent(event.target.value)}
                placeholder="从这里开始写。输入会自动保存，断网时也会先留在本机。"
                aria-label="章节正文"
                spellCheck={false}
                className="editor-textarea min-h-[46dvh] overflow-hidden"
                style={{
                  fontFamily:
                    fontFamily === "serif" ? "var(--font-book)" : "var(--font-ui)",
                  fontSize: `${fontSize}px`,
                }}
              />

              <div className="mt-7 flex flex-wrap items-center justify-between gap-2 border-t border-line pt-4 text-[10px] text-ink-mute">
                <span>
                  {formatNumber(wordCount)} 字 · {paragraphs} 段 · 约 {minutes} 分钟
                </span>
                <span className="hidden sm:inline">Ctrl / Cmd + S 手动保存</span>
              </div>
            </article>

            <ChapterIllustrations
              chapterId={chapter.id}
              content={content}
              illustrations={illustrations}
              onIllustrationsChange={setIllustrations}
              getCaretParagraph={getCaretParagraph}
            />

            <p className="mt-3 px-2 text-center text-[10px] leading-5 text-ink-mute">
              自动保存已开启 · 服务端与浏览器各保留一份
            </p>
          </div>
        </main>

        {!focusMode ? (
          <aside className="hidden w-[328px] flex-none flex-col overflow-hidden border-l border-line bg-paper xl:flex">
            <div className="flex-none border-b border-line p-3">
              <div className="segmented flex w-full" role="tablist" aria-label="侧边面板">
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelMode === "assist"}
                  onClick={() => setPanelMode("assist")}
                  className="segmented-item flex-1 px-0 text-[11px]"
                  data-active={panelMode === "assist"}
                >
                  AI 助手
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={panelMode === "bible"}
                  onClick={() => setPanelMode("bible")}
                  className="segmented-item flex-1 px-0 text-[11px]"
                  data-active={panelMode === "bible"}
                >
                  故事设定
                </button>
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              <div className={panelMode === "assist" ? undefined : "hidden"}>
                <EditorSidePanel {...sidePanelProps} />
              </div>
              <div className={panelMode === "bible" ? undefined : "hidden"}>
                <StoryBiblePanel
                  workId={work.id}
                  entities={storyEntities}
                  onEntitiesChange={setStoryEntities}
                />
              </div>
            </div>
          </aside>
        ) : null}
      </div>

      {!focusMode ? (
        <footer className="flex h-9 flex-none items-center justify-between gap-3 border-t border-line bg-paper px-3 text-[10px] text-ink-mute sm:px-5">
          <div className="flex items-center gap-2">
            <SaveStatus state={saveState} savedAt={savedAt} showTime />
            <span className="hidden text-ink-mute sm:inline">本机 SQLite · 自动保存</span>
          </div>
          <div className="flex items-center gap-3">
            <span className="tabular-nums">{formatNumber(wordCount)} 字</span>
            <span>{paragraphs} 段</span>
            <span className="hidden md:inline">约 {minutes} 分钟</span>
            <span className="hidden lg:inline">Ctrl / Cmd + S 保存</span>
          </div>
        </footer>
      ) : null}

      {outlineOpen ? (
        <div className="fixed inset-0 z-[60] lg:hidden">
          <button
            type="button"
            aria-label="关闭章节目录"
            className="animate-fade-in absolute inset-0 bg-ink/35"
            onClick={() => setOutlineOpen(false)}
          />
          <div className="animate-slide-up absolute inset-y-0 left-0 flex w-[min(86vw,320px)] flex-col border-r border-line bg-paper shadow-float">
            <div className="flex h-12 flex-none items-center justify-between border-b border-line px-4">
              <span className="text-[12px] font-semibold">章节目录</span>
              <button
                type="button"
                onClick={() => setOutlineOpen(false)}
                className="icon-capsule h-8 w-8"
                aria-label="关闭目录"
              >
                <X size={16} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-hidden">
              <ChapterOutline {...outlineProps} />
            </div>
          </div>
        </div>
      ) : null}

      {panelOpen ? (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <button
            type="button"
            aria-label="关闭 AI 助手"
            className="animate-fade-in absolute inset-0 bg-ink/35"
            onClick={() => setPanelOpen(false)}
          />
          <div className="animate-slide-up absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-paper pb-[env(safe-area-inset-bottom)] shadow-float">
            <div className="sticky top-0 z-10 flex h-12 items-center justify-between border-b border-line bg-paper px-4">
              <span className="text-[12px] font-semibold">AI 助手与本章设置</span>
              <button
                type="button"
                onClick={() => setPanelOpen(false)}
                className="icon-capsule h-8 w-8"
                aria-label="关闭面板"
              >
                <X size={16} />
              </button>
            </div>
            <EditorSidePanel {...sidePanelProps} />
          </div>
        </div>
      ) : null}

      {bibleOpen ? (
        <div className="fixed inset-0 z-[60] xl:hidden">
          <button
            type="button"
            aria-label="关闭故事设定"
            className="animate-fade-in absolute inset-0 bg-ink/35"
            onClick={() => setBibleOpen(false)}
          />
          <div className="animate-slide-up absolute inset-y-0 right-0 flex w-[min(92vw,420px)] flex-col border-l border-line bg-paper pb-[env(safe-area-inset-bottom)] shadow-float">
            <div className="min-h-0 flex-1 overflow-y-auto">
              <StoryBiblePanel
                workId={work.id}
                entities={storyEntities}
                onEntitiesChange={setStoryEntities}
                onClose={() => setBibleOpen(false)}
              />
            </div>
          </div>
        </div>
      ) : null}

      <ConfirmDialog
        open={remoteConfirm}
        onClose={() => setRemoteConfirm(false)}
        onConfirm={loadRemote}
        title="载入远端版本？"
        description="本地尚未同步的改动会被丢弃。如果还想保留当前内容，请取消并选择保留本地版本。"
        confirmLabel="载入远端"
      />
    </div>
  );
}
