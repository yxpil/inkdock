// Author: yxpil

"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Settings2,
  X,
} from "lucide-react";
import type { ReaderWork } from "@/lib/types";
import {
  clampPrefs,
  getPlatform,
  PLATFORMS,
  readerPrefsKey,
  type PlatformId,
  type ReaderPrefs,
} from "@/lib/platforms";
import { capsule } from "@/components/ui/button";
import { formatNumber } from "@/lib/utils";
import { ReaderDevice } from "./reader-device";
import { ReaderSettings } from "./reader-settings";

const FRAME_WIDTH = 413;
const FRAME_HEIGHT = 872;

function defaultPrefsMap(): Record<PlatformId, ReaderPrefs> {
  const map = {} as Record<PlatformId, ReaderPrefs>;
  for (const platform of PLATFORMS) {
    map[platform.id] = { ...platform.defaultPrefs };
  }
  return map;
}

function platformDefaults(platformId: PlatformId): ReaderPrefs {
  const platform = PLATFORMS.find((item) => item.id === platformId) ?? PLATFORMS[0];
  return { ...platform.defaultPrefs };
}

export function ReaderStudio({
  work,
  initialChapterId,
  initialPlatformId,
}: {
  work: ReaderWork;
  initialChapterId: string;
  initialPlatformId: PlatformId;
}) {
  const [platformId, setPlatformId] = useState<PlatformId>(initialPlatformId);
  const [chapterId, setChapterId] = useState(initialChapterId);
  const [prefsByPlatform, setPrefsByPlatform] =
    useState<Record<PlatformId, ReaderPrefs>>(defaultPrefsMap);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [scale, setScale] = useState(0.8);
  const stageRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  const platform = getPlatform(platformId);
  const prefs = prefsByPlatform[platformId];
  const currentChapter =
    work.chapters.find((chapter) => chapter.id === chapterId) ?? work.chapters[0];
  const currentIndex = currentChapter
    ? work.chapters.findIndex((chapter) => chapter.id === currentChapter.id)
    : -1;
  const previousChapter = currentIndex > 0 ? work.chapters[currentIndex - 1] : null;
  const nextChapter =
    currentIndex >= 0 && currentIndex < work.chapters.length - 1
      ? work.chapters[currentIndex + 1]
      : null;

  useEffect(() => {
    const restored = defaultPrefsMap();
    for (const item of PLATFORMS) {
      try {
        const raw = window.localStorage.getItem(readerPrefsKey(item.id));
        if (!raw) continue;
        const parsed = JSON.parse(raw) as Partial<ReaderPrefs>;
        restored[item.id] = clampPrefs({ ...item.defaultPrefs, ...parsed });
      } catch {
        // A malformed or unavailable entry keeps the platform defaults.
      }
    }
    setPrefsByPlatform(restored);
  }, []);

  useEffect(() => {
    const node = stageRef.current;
    if (!node) return;
    const update = () => {
      const availableWidth = Math.max(0, node.clientWidth - 32);
      const availableHeight = Math.max(0, node.clientHeight - 144);
      const next = Math.min(
        1,
        Math.max(
          0.55,
          Math.min(availableWidth / FRAME_WIDTH, availableHeight / FRAME_HEIGHT),
        ),
      );
      setScale(Math.round(next * 1000) / 1000);
    };
    update();
    const observer = new ResizeObserver(update);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    if (!currentChapter) return;
    const nextUrl = `/preview/${work.id}?chapter=${currentChapter.id}&platform=${platformId}`;
    window.history.replaceState(null, "", nextUrl);
  }, [currentChapter, platformId, work.id]);

  const changePrefs = (patch: Partial<ReaderPrefs>) => {
    const next = clampPrefs({ ...prefs, ...patch });
    setPrefsByPlatform((current) => ({ ...current, [platformId]: next }));
    try {
      window.localStorage.setItem(readerPrefsKey(platformId), JSON.stringify(next));
    } catch {
      // The preview still reflects the change for this session.
    }
  };

  const resetPrefs = () => {
    const defaults = platformDefaults(platformId);
    setPrefsByPlatform((current) => ({ ...current, [platformId]: defaults }));
    try {
      window.localStorage.removeItem(readerPrefsKey(platformId));
    } catch {
      // Ignore storage failures.
    }
  };

  if (!currentChapter) {
    return (
      <div
        data-theme="dark"
        className="flex min-h-dvh flex-col items-center justify-center gap-4 bg-paper px-6 text-center text-ink"
      >
        <p className="font-serif text-xl font-semibold">《{work.title}》还没有章节</p>
        <p className="max-w-sm text-[12px] leading-6 text-ink-mute">
          回到写作页新建一章，或在作品页添加章节后再来预览。
        </p>
        <Link href={`/works/${work.id}`} className={capsule("primary", "md")}>
          返回作品页
        </Link>
      </div>
    );
  }

  const selectorWidth = Math.min(Math.max(280, FRAME_WIDTH * scale), 420);

  return (
    <div
      data-theme="dark"
      className="reader-stage flex h-dvh flex-col overflow-hidden bg-paper text-ink"
    >
      <header className="flex h-14 flex-none items-center justify-between gap-3 border-b border-line px-3 sm:px-5">
        <div className="flex min-w-0 items-center gap-2">
          <Link
            href={`/write/${currentChapter.id}`}
            className={capsule("ghost", "sm", "h-9 px-2.5 sm:px-3")}
            aria-label="返回写作"
          >
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">返回写作</span>
          </Link>
          <div className="min-w-0 border-l border-line pl-3">
            <p className="text-[9px] font-medium tracking-[0.16em] text-ink-mute">
              手机预览
            </p>
            <p className="truncate text-[12px] font-medium">
              {work.title}
              <span className="text-ink-mute"> · {platform.name}</span>
            </p>
          </div>
        </div>

        <div className="flex flex-none items-center gap-2">
          <span className="hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[10px] text-ink-mute md:flex">
            <span className="h-1.5 w-1.5 rounded-full bg-gold" aria-hidden="true" />
            界面模拟
          </span>
          <Link
            href={`/works/${work.id}`}
            className={capsule("outline", "sm", "hidden h-9 lg:inline-flex")}
          >
            作品页
          </Link>
          <button
            type="button"
            onClick={() => setSettingsOpen(true)}
            className={capsule("secondary", "sm", "h-9 xl:hidden")}
            aria-label="打开预览设置"
          >
            <Settings2 size={14} />
            设置
          </button>
        </div>
      </header>

      <div className="flex min-h-0 flex-1">
        <aside className="hidden w-[300px] flex-none overflow-y-auto border-r border-line bg-paper p-5 xl:block">
          <ReaderSettings
            platformId={platformId}
            prefs={prefs}
            onPlatformChange={setPlatformId}
            onPrefsChange={changePrefs}
            onReset={resetPrefs}
          />
        </aside>

        <main
          ref={stageRef}
          className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto p-4 sm:p-6"
        >
          <div className="flex flex-col items-center">
            <div
              className="relative flex-none"
              style={{ width: FRAME_WIDTH * scale, height: FRAME_HEIGHT * scale }}
            >
              <div
                className="absolute left-0 top-0 h-[872px] w-[413px] rounded-[54px] border-[10px] border-[#0B0B0B] bg-[#0B0B0B] shadow-float"
                style={{ transform: `scale(${scale})`, transformOrigin: "top left" }}
              >
                <ReaderDevice
                  work={work}
                  chapter={currentChapter}
                  chapters={work.chapters}
                  platform={platform}
                  prefs={prefs}
                  onSelectChapter={setChapterId}
                  onExit={() => router.push(`/works/${work.id}`)}
                />
              </div>
            </div>

            <div
              className="mt-4 flex items-center gap-2"
              style={{ width: selectorWidth }}
            >
              <button
                type="button"
                onClick={() => previousChapter && setChapterId(previousChapter.id)}
                disabled={!previousChapter}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-35"
                aria-label="上一章"
                title="上一章"
              >
                <ChevronLeft size={16} />
              </button>
              <div className="relative min-w-0 flex-1">
                <select
                  value={currentChapter.id}
                  onChange={(event) => setChapterId(event.target.value)}
                  aria-label="选择章节"
                  className="h-9 w-full appearance-none rounded-full border border-line bg-surface pl-4 pr-9 text-[12px] text-ink outline-none transition-colors focus:border-accent"
                >
                  {work.chapters.map((chapter, index) => (
                    <option key={chapter.id} value={chapter.id}>
                      {String(index + 1).padStart(2, "0")} · {chapter.title}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-ink-mute"
                  aria-hidden="true"
                />
              </div>
              <button
                type="button"
                onClick={() => nextChapter && setChapterId(nextChapter.id)}
                disabled={!nextChapter}
                className="flex h-9 w-9 flex-none items-center justify-center rounded-full border border-line bg-surface text-ink-soft transition-colors hover:bg-surface-2 disabled:opacity-35"
                aria-label="下一章"
                title="下一章"
              >
                <ChevronRight size={16} />
              </button>
            </div>

            <p className="mt-3 max-w-[420px] text-center text-[10px] leading-5 text-ink-mute">
              {currentChapter.volumeTitle} · {formatNumber(currentChapter.wordCount)} 字 · 点击左右区域或按方向键翻页
            </p>
            <p className="mt-1 text-center text-[10px] leading-5 text-ink-mute">
              界面模拟，非官方客户端
            </p>
          </div>
        </main>
      </div>

      {settingsOpen ? (
        <div className="fixed inset-0 z-50 xl:hidden">
          <button
            type="button"
            aria-label="关闭预览设置"
            className="animate-fade-in absolute inset-0 bg-ink/35"
            onClick={() => setSettingsOpen(false)}
          />
          <div className="animate-slide-up absolute inset-x-0 bottom-0 max-h-[86dvh] overflow-y-auto rounded-t-[28px] border-t border-line bg-paper px-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] pt-4 shadow-float">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-sm font-semibold">预览设置</h2>
                <p className="mt-0.5 text-[10px] text-ink-mute">{platform.name}</p>
              </div>
              <button
                type="button"
                onClick={() => setSettingsOpen(false)}
                className="icon-capsule"
                aria-label="关闭设置"
              >
                <X size={18} />
              </button>
            </div>
            <ReaderSettings
              platformId={platformId}
              prefs={prefs}
              onPlatformChange={setPlatformId}
              onPrefsChange={changePrefs}
              onReset={resetPrefs}
            />
          </div>
        </div>
      ) : null}
    </div>
  );
}
