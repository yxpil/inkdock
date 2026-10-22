// Author: yxpil

"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  BookOpen,
  Feather,
  PenLine,
  Plus,
  Search,
  X,
} from "lucide-react";
import type { LibraryData, WorkStatus } from "@/lib/types";
import { BookCover } from "@/components/book-cover";
import { CreateWorkDialog } from "@/components/library/create-work-dialog";
import { capsule } from "@/components/ui/button";
import {
  DAILY_GOAL_KEY,
  DEFAULT_DAILY_GOAL,
  WORK_STATUS_LABEL,
} from "@/lib/constants";
import { useStoredNumber } from "@/hooks/use-stored-number";
import { cn, formatNumber, formatRelative, formatWords, truncate } from "@/lib/utils";

type StatusFilter = "all" | WorkStatus;

const FILTERS: Array<{ value: StatusFilter; label: string }> = [
  { value: "all", label: "全部" },
  { value: "serializing", label: "连载" },
  { value: "completed", label: "完结" },
  { value: "paused", label: "暂停" },
];

function statusTone(status: WorkStatus): string {
  if (status === "serializing") return "bg-accent";
  if (status === "completed") return "bg-gold";
  return "bg-ink-mute";
}

export function LibraryView({
  data,
  openNewInitially,
}: {
  data: LibraryData;
  openNewInitially: boolean;
}) {
  const router = useRouter();
  const [createOpen, setCreateOpen] = useState(openNewInitially);
  const [filter, setFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");
  const goal = useStoredNumber(DAILY_GOAL_KEY, DEFAULT_DAILY_GOAL);

  useEffect(() => {
    if (openNewInitially) setCreateOpen(true);
  }, [openNewInitially]);

  const closeCreate = () => {
    setCreateOpen(false);
    if (openNewInitially) {
      router.replace("/library", { scroll: false });
    }
  };

  const filtered = useMemo(() => {
    const term = query.trim().toLowerCase();
    return data.works.filter((work) => {
      const matchesStatus = filter === "all" || work.status === filter;
      const matchesQuery =
        !term ||
        work.title.toLowerCase().includes(term) ||
        work.genre.toLowerCase().includes(term);
      return matchesStatus && matchesQuery;
    });
  }, [data.works, filter, query]);

  const goalProgress = Math.min(100, Math.round((data.stats.todayWords / goal) * 100));
  const hasFilter = filter !== "all" || query.trim() !== "";

  return (
    <div className="space-y-7">
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-[11px] font-medium tracking-[0.16em] text-ink-mute">
            写作工作台
          </p>
          <h1 className="mt-2 font-serif text-[32px] font-semibold leading-[1.15] tracking-[-0.01em] sm:text-[40px]">
            书架
          </h1>
          <p className="mt-2 text-[13px] text-ink-soft">
            把故事放回纸上。今天继续哪一章？
          </p>
        </div>
        <button
          type="button"
          className={capsule("primary", "lg", "self-start sm:self-auto")}
          onClick={() => setCreateOpen(true)}
        >
          <Plus size={17} strokeWidth={2} />
          新建作品
        </button>
      </header>

      <section
        className="grid grid-cols-2 gap-px overflow-hidden rounded-[28px] border border-line bg-line sm:grid-cols-4"
        aria-label="写作统计"
      >
        <div className="bg-surface p-5 sm:p-6">
          <p className="text-[11px] text-ink-mute">今日新增</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
            {formatNumber(data.stats.todayWords)}
            <span className="ml-1 text-xs font-normal text-ink-mute">字</span>
          </p>
          <div className="mt-3 h-1 overflow-hidden rounded-full bg-surface-2">
            <div
              className="h-full rounded-full bg-accent transition-[width] duration-300"
              style={{ width: `${goalProgress}%` }}
            />
          </div>
          <p className="mt-1.5 text-[10px] text-ink-mute">
            目标 {formatNumber(goal)} 字 · {goalProgress}%
          </p>
        </div>
        <div className="bg-surface p-5 sm:p-6">
          <p className="text-[11px] text-ink-mute">累计字数</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
            {formatWords(data.stats.totalWords)}
          </p>
          <p className="mt-3 text-[10px] text-ink-mute">不含空白与标点</p>
        </div>
        <div className="bg-surface p-5 sm:p-6">
          <p className="text-[11px] text-ink-mute">正在写</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
            {data.stats.activeWorks}
            <span className="ml-1 text-xs font-normal text-ink-mute">本</span>
          </p>
          <p className="mt-3 text-[10px] text-ink-mute">共 {data.works.length} 本作品</p>
        </div>
        <div className="bg-surface p-5 sm:p-6">
          <p className="text-[11px] text-ink-mute">章节</p>
          <p className="mt-1.5 text-2xl font-semibold tracking-[-0.02em]">
            {formatNumber(data.stats.chapterCount)}
            <span className="ml-1 text-xs font-normal text-ink-mute">章</span>
          </p>
          <p className="mt-3 text-[10px] text-ink-mute">写下的每一段都算数</p>
        </div>
      </section>

      {data.recent ? (
        <section className="relative overflow-hidden rounded-[30px] bg-accent p-6 text-on-accent sm:p-8">
          <div className="pointer-events-none absolute -right-16 -top-24 h-64 w-64 rounded-full border border-on-accent/20" />
          <div className="pointer-events-none absolute -right-4 top-10 h-36 w-36 rounded-full border border-on-accent/10" />
          <div className="relative flex flex-col gap-7 sm:flex-row sm:items-end sm:justify-between">
            <div className="min-w-0 max-w-2xl">
              <p className="flex items-center gap-2 text-[11px] font-medium tracking-[0.12em] text-on-accent/70">
                <PenLine size={14} strokeWidth={1.75} />
                继续写作 · {data.recent.workTitle}
              </p>
              <h2 className="mt-3 font-serif text-2xl font-semibold leading-snug sm:text-[28px]">
                {data.recent.chapterTitle}
              </h2>
              <p className="mt-2 line-clamp-2 text-[13px] leading-6 text-on-accent/70">
                {data.recent.snippet
                  ? truncate(data.recent.snippet, 110)
                  : "这一章还没有正文，下一句由你开始。"}
              </p>
              <p className="mt-4 text-[11px] text-on-accent/60">
                {data.recent.volumeTitle} · {formatRelative(data.recent.updatedAt)}
              </p>
            </div>
            <Link
              href={`/write/${data.recent.chapterId}`}
              className="capsule h-12 shrink-0 bg-on-accent px-6 text-sm text-accent hover:opacity-90"
            >
              继续写作
              <ArrowRight size={16} />
            </Link>
          </div>
        </section>
      ) : null}

      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="segmented hide-scrollbar max-w-full overflow-x-auto" role="tablist" aria-label="作品状态筛选">
            {FILTERS.map((item) => (
              <button
                key={item.value}
                type="button"
                role="tab"
                aria-selected={filter === item.value}
                data-active={filter === item.value}
                className="segmented-item shrink-0"
                onClick={() => setFilter(item.value)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-full sm:w-60">
              <Search
                size={15}
                className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-ink-mute"
              />
              <input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                className="field-input h-10 pl-9 pr-9 text-[13px]"
                placeholder="搜索书名或题材"
                aria-label="搜索作品"
              />
              {query ? (
                <button
                  type="button"
                  className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-mute hover:bg-surface-3 hover:text-ink"
                  onClick={() => setQuery("")}
                  aria-label="清除搜索"
                >
                  <X size={13} />
                </button>
              ) : null}
            </div>
            <span className="hidden shrink-0 text-[11px] text-ink-mute sm:inline">
              {filtered.length} 本
            </span>
          </div>
        </div>

        {data.works.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-20 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-accent-soft text-accent">
              <Feather size={24} strokeWidth={1.5} />
            </span>
            <h2 className="mt-5 font-serif text-xl font-semibold">书架还是空的</h2>
            <p className="mt-2 max-w-sm text-[13px] leading-6 text-ink-soft">
              先为它起一个名字。第一卷和第一章会自动准备好。
            </p>
            <button
              type="button"
              className={capsule("primary", "lg", "mt-6")}
              onClick={() => setCreateOpen(true)}
            >
              <Plus size={16} />
              新建第一本作品
            </button>
          </div>
        ) : filtered.length === 0 ? (
          <div className="card flex flex-col items-center px-6 py-16 text-center">
            <span className="flex h-12 w-12 items-center justify-center rounded-full bg-surface-2 text-ink-mute">
              <Search size={20} strokeWidth={1.5} />
            </span>
            <h2 className="mt-4 text-base font-semibold">没有找到符合条件的作品</h2>
            <p className="mt-1.5 text-[13px] text-ink-soft">换个筛选条件，或开始一个新的故事。</p>
            <button
              type="button"
              className={capsule("secondary", "md", "mt-5")}
              onClick={() => {
                setFilter("all");
                setQuery("");
              }}
            >
              清除筛选
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 sm:gap-5 xl:grid-cols-4">
            {filtered.map((work) => {
              const progress =
                work.targetWords > 0
                  ? Math.min(100, Math.round((work.totalWords / work.targetWords) * 100))
                  : null;
              return (
                <Link
                  key={work.id}
                  href={`/works/${work.id}`}
                  className="group rounded-[26px] border border-line bg-surface p-2.5 transition duration-200 hover:-translate-y-0.5 hover:border-line-strong hover:shadow-soft sm:p-3"
                >
                  <BookCover
                    title={work.title}
                    author={work.authorName}
                    genre={work.genre}
                    color={work.coverColor}
                    image={work.coverImage}
                  />
                  <div className="px-1.5 pb-1.5 pt-3.5">
                    <h3 className="truncate font-serif text-[15px] font-semibold leading-6 tracking-[0.01em]">
                      {work.title}
                    </h3>
                    <p className="mt-1 flex items-center gap-1.5 text-[11px] text-ink-mute">
                      <span
                        className={cn("h-1.5 w-1.5 rounded-full", statusTone(work.status))}
                        aria-hidden="true"
                      />
                      {WORK_STATUS_LABEL[work.status]} · {work.genre}
                    </p>
                    <div className="mt-3 flex items-center justify-between gap-2 text-[11px] text-ink-mute">
                      <span>{formatWords(work.totalWords)} 字</span>
                      <span>{formatRelative(work.updatedAt)}</span>
                    </div>
                    {progress !== null ? (
                      <div className="mt-2 flex items-center gap-2">
                        <div className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2">
                          <div
                            className="h-full rounded-full bg-accent/70 transition-[width] duration-300"
                            style={{ width: `${Math.max(2, progress)}%` }}
                          />
                        </div>
                        <span className="text-[10px] tabular-nums text-ink-mute">{progress}%</span>
                      </div>
                    ) : (
                      <div className="mt-2 flex items-center gap-1.5 text-[10px] text-ink-mute">
                        <BookOpen size={11} />
                        {work.chapterCount} 章 · {work.volumeCount} 卷
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}

            <button
              type="button"
              onClick={() => setCreateOpen(true)}
              className="group flex min-h-[240px] flex-col items-center justify-center gap-3 rounded-[26px] border border-dashed border-line-strong bg-transparent p-6 text-ink-mute transition-colors hover:border-accent hover:bg-accent-soft hover:text-accent"
            >
              <span className="flex h-11 w-11 items-center justify-center rounded-full border border-current">
                <Plus size={18} />
              </span>
              <span className="text-[13px] font-medium">新建作品</span>
              <span className="text-[11px]">给下一个故事留个位置</span>
            </button>
          </div>
        )}

        {hasFilter && filtered.length > 0 ? (
          <p className="text-center text-[11px] text-ink-mute">
            当前显示 {filtered.length} 本，共 {data.works.length} 本作品
          </p>
        ) : null}
      </section>

      <CreateWorkDialog open={createOpen} onClose={closeCreate} />
    </div>
  );
}
