// Author: yxpil

"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BookOpen,
  Download,
  FileJson,
  FileText,
  Globe,
  Layers,
  Loader2,
  Pencil,
  PenLine,
  Plus,
  Smartphone,
  Trash2,
  UserPlus,
  Users,
} from "lucide-react";
import type {
  ChapterMeta,
  VolumeWithChapters,
  WorkDetail,
  WorkMember,
  WorkRole,
} from "@/lib/types";
import { BookCover } from "@/components/book-cover";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { EditWorkDialog, VolumeDialog } from "@/components/work/work-dialogs";
import { capsule } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import {
  ASSIGNABLE_WORK_ROLES,
  CHAPTER_STATUS_LABEL,
  WORK_ROLE_HINT,
  WORK_ROLE_LABEL,
  WORK_STATUS_LABEL,
} from "@/lib/constants";
import {
  cn,
  formatDateTime,
  formatNumber,
  formatRelative,
  formatWords,
  initialOf,
} from "@/lib/utils";

function chapterDot(status: ChapterMeta["status"]): string {
  if (status === "published") return "bg-accent";
  if (status === "ready") return "bg-gold";
  return "bg-ink-mute";
}

function chapterTone(status: ChapterMeta["status"]): string {
  if (status === "published") return "text-accent";
  if (status === "ready") return "text-gold";
  return "text-ink-mute";
}

type PendingDelete =
  | { kind: "chapter"; chapter: ChapterMeta }
  | { kind: "volume"; volume: VolumeWithChapters }
  | null;

export function WorkView({ work }: { work: WorkDetail }) {
  const router = useRouter();
  const { toast } = useToast();
  const [editOpen, setEditOpen] = useState(false);
  const [volumeDialog, setVolumeDialog] = useState<
    { mode: "create" } | { mode: "edit"; volume: VolumeWithChapters } | null
  >(null);
  const [pendingDelete, setPendingDelete] = useState<PendingDelete>(null);
  const [deleting, setDeleting] = useState(false);
  const [creatingIn, setCreatingIn] = useState<string | null>(null);
  const [memberHandle, setMemberHandle] = useState("");
  const [memberRole, setMemberRole] = useState<WorkRole>("editor");
  const [addingMember, setAddingMember] = useState(false);
  const [updatingMember, setUpdatingMember] = useState<string | null>(null);
  const [pendingMember, setPendingMember] = useState<WorkMember | null>(null);
  const [removingMember, setRemovingMember] = useState(false);

  const canEdit = work.role === "owner" || work.role === "editor";
  const canManage = work.role === "owner";

  const allChapters = useMemo(
    () => work.volumes.flatMap((volume) => volume.chapters),
    [work.volumes],
  );
  const entryChapterId = work.lastChapterId ?? allChapters[0]?.id ?? null;
  const progress =
    work.targetWords > 0
      ? Math.min(100, Math.round((work.totalWords / work.targetWords) * 100))
      : null;

  const addChapter = async (volumeId: string) => {
    setCreatingIn(volumeId);
    try {
      const data = await apiFetch<{ chapterId: string }>(
        `/api/works/${work.id}/chapters`,
        {
          method: "POST",
          body: JSON.stringify({ volumeId }),
        },
      );
      router.push(`/write/${data.chapterId}`);
    } catch (error) {
      toast(error instanceof Error ? error.message : "新建章节失败", "danger");
    } finally {
      setCreatingIn(null);
    }
  };

  const confirmDelete = async () => {
    if (!pendingDelete) return;
    setDeleting(true);
    try {
      if (pendingDelete.kind === "chapter") {
        await apiFetch(`/api/chapters/${pendingDelete.chapter.id}`, { method: "DELETE" });
        toast("章节已删除");
      } else {
        await apiFetch(`/api/volumes/${pendingDelete.volume.id}`, { method: "DELETE" });
        toast("空卷已删除");
      }
      setPendingDelete(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "删除失败", "danger");
    } finally {
      setDeleting(false);
    }
  };

  const addMember = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!memberHandle.trim() || addingMember) return;
    setAddingMember(true);
    try {
      await apiFetch(`/api/works/${work.id}/members`, {
        method: "POST",
        body: JSON.stringify({ handle: memberHandle.trim(), role: memberRole }),
      });
      setMemberHandle("");
      toast("已加入协作成员");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "添加成员失败", "danger");
    } finally {
      setAddingMember(false);
    }
  };

  const changeMemberRole = async (member: WorkMember, role: WorkRole) => {
    setUpdatingMember(member.user.id);
    try {
      await apiFetch(`/api/works/${work.id}/members/${member.user.id}`, {
        method: "PATCH",
        body: JSON.stringify({ role }),
      });
      toast(`已将 ${member.user.name} 设为${WORK_ROLE_LABEL[role]}`);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "调整角色失败", "danger");
    } finally {
      setUpdatingMember(null);
    }
  };

  const confirmRemoveMember = async () => {
    if (!pendingMember) return;
    setRemovingMember(true);
    try {
      await apiFetch(`/api/works/${work.id}/members/${pendingMember.user.id}`, {
        method: "DELETE",
      });
      toast("已移除协作成员");
      setPendingMember(null);
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "移除成员失败", "danger");
    } finally {
      setRemovingMember(false);
    }
  };

  return (
    <div>
      <Link
        href="/library"
        className="inline-flex items-center gap-1.5 rounded-full py-1 pr-3 text-[12px] font-medium text-ink-mute transition-colors hover:text-ink"
      >
        <ArrowLeft size={15} />
        返回书架
      </Link>

      <section className="card mt-3 overflow-hidden">
        <div className="p-4 sm:p-6 lg:p-7">
          <div className="flex gap-4 sm:gap-6">
            <div className="w-[104px] flex-none sm:w-[144px]">
              <BookCover
                title={work.title}
                author={work.authorName}
                genre={work.genre}
                color={work.coverColor}
                image={work.coverImage}
              />
            </div>

            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="chip chip-accent">{WORK_STATUS_LABEL[work.status]}</span>
                <span className="chip">{work.genre}</span>
                {work.role !== "owner" ? (
                  <span className="chip">协作 · {WORK_ROLE_LABEL[work.role]}</span>
                ) : null}
                <span className="text-[11px] text-ink-mute">{work.authorName}</span>
              </div>
              <h1 className="mt-3 font-serif text-[26px] font-semibold leading-tight tracking-[-0.01em] sm:text-[34px]">
                {work.title}
              </h1>
              {work.subtitle ? (
                <p className="mt-1.5 text-[12px] text-ink-soft sm:text-[13px]">{work.subtitle}</p>
              ) : null}
              <p className="mt-3 line-clamp-2 max-w-2xl text-[12px] leading-6 text-ink-soft sm:line-clamp-3 sm:text-[13px]">
                {work.description || "还没有简介。可以在作品资料里补上一段。"}
              </p>

              <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-ink-mute">
                <span>
                  <strong className="font-semibold text-ink">{formatWords(work.totalWords)}</strong> 字
                </span>
                <span>
                  <strong className="font-semibold text-ink">{work.chapterCount}</strong> 章
                </span>
                <span>
                  <strong className="font-semibold text-ink">{work.volumeCount}</strong> 卷
                </span>
                <span>更新于 {formatRelative(work.updatedAt)}</span>
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                {canEdit ? (
                  entryChapterId ? (
                    <Link
                      href={`/write/${entryChapterId}`}
                      className={capsule("primary", "lg")}
                    >
                      <PenLine size={16} />
                      {work.lastChapterId ? "继续写作" : "开始写作"}
                    </Link>
                  ) : (
                    <button type="button" className={capsule("primary", "lg")} disabled>
                      <PenLine size={16} />
                      暂无章节
                    </button>
                  )
                ) : null}
                {entryChapterId ? (
                  <Link
                    href={`/preview/${work.id}?chapter=${entryChapterId}`}
                    className={capsule(canEdit ? "outline" : "primary", "lg")}
                  >
                    <Smartphone size={16} />
                    {canEdit ? "手机预览" : "阅读预览"}
                  </Link>
                ) : !canEdit ? (
                  <button type="button" className={capsule("primary", "lg")} disabled>
                    <Smartphone size={16} />
                    暂无章节
                  </button>
                ) : null}
                {canEdit ? (
                  <button
                    type="button"
                    className={capsule("ghost", "lg")}
                    onClick={() => setEditOpen(true)}
                  >
                    <Pencil size={15} />
                    编辑资料
                  </button>
                ) : null}
              </div>
              {!canEdit ? (
                <p className="mt-3 text-[10px] leading-5 text-ink-mute">
                  你以{WORK_ROLE_LABEL[work.role]}身份查看。写作、卷章与设定编辑仅对所有者与编辑开放。
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </section>

      <div className="mt-6 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <section className="min-w-0">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="font-serif text-xl font-semibold">目录</h2>
              <p className="mt-1 text-[11px] text-ink-mute">
                {work.volumeCount} 卷 · {work.chapterCount} 章 · {formatWords(work.totalWords)} 字
              </p>
            </div>
            {canEdit ? (
              <button
                type="button"
                className={capsule("secondary", "md")}
                onClick={() => setVolumeDialog({ mode: "create" })}
              >
                <Plus size={15} />
                新建卷
              </button>
            ) : null}
          </div>

          <div className="mt-4 space-y-4">
            {work.volumes.map((volume) => (
              <article key={volume.id} className="card overflow-hidden">
                <header className="flex items-start justify-between gap-3 border-b border-line px-4 py-4 sm:px-5">
                  <div className="min-w-0">
                    <h3 className="font-serif text-lg font-semibold leading-7">{volume.title}</h3>
                    <p className="mt-1 text-[11px] text-ink-mute">
                      {volume.chapters.length} 章 · {formatWords(volume.totalWords)} 字
                      {volume.summary ? ` · ${volume.summary}` : ""}
                    </p>
                  </div>
                  {canEdit ? (
                    <div className="flex flex-none items-center gap-1">
                      <button
                        type="button"
                        className={capsule("secondary", "sm")}
                        onClick={() => addChapter(volume.id)}
                        disabled={creatingIn === volume.id}
                        aria-label={`在 ${volume.title} 中新增章节`}
                      >
                        {creatingIn === volume.id ? (
                          <Loader2 size={13} className="animate-spin-slow" />
                        ) : (
                          <Plus size={13} />
                        )}
                        添加
                      </button>
                      <button
                        type="button"
                        className="icon-capsule h-8 w-8"
                        onClick={() => setVolumeDialog({ mode: "edit", volume })}
                        aria-label={`编辑 ${volume.title}`}
                        title="编辑卷"
                      >
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="icon-capsule h-8 w-8 hover:bg-danger-soft hover:text-danger"
                        onClick={() => setPendingDelete({ kind: "volume", volume })}
                        disabled={volume.chapters.length > 0 || work.volumes.length <= 1}
                        aria-label={`删除 ${volume.title}`}
                        title={
                          volume.chapters.length > 0
                            ? "卷内仍有章节，无法删除"
                            : work.volumes.length <= 1
                              ? "作品至少保留一卷"
                              : "删除空卷"
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  ) : null}
                </header>

                {volume.chapters.length === 0 ? (
                  <div className="flex flex-col items-center px-6 py-10 text-center">
                    <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-mute">
                      <FeatherIcon />
                    </span>
                    <p className="mt-3 text-[13px] text-ink-soft">这一卷还没有章节。</p>
                    {canEdit ? (
                      <button
                        type="button"
                        className={capsule("ghost", "sm", "mt-2")}
                        onClick={() => addChapter(volume.id)}
                      >
                        <Plus size={13} />
                        写下第一章
                      </button>
                    ) : null}
                  </div>
                ) : (
                  <div className="p-2 sm:p-3">
                    {volume.chapters.map((chapter, index) => (
                      <div
                        key={chapter.id}
                        className="group flex items-center gap-1 rounded-2xl pr-1 transition-colors hover:bg-surface-2"
                      >
                        <Link
                          href={
                            canEdit
                              ? `/write/${chapter.id}`
                              : `/preview/${work.id}?chapter=${chapter.id}`
                          }
                          className="flex min-w-0 flex-1 items-center gap-2.5 px-2.5 py-2.5 sm:gap-3"
                        >
                          <span className="w-6 flex-none text-center font-mono text-[10px] text-ink-mute">
                            {String(index + 1).padStart(2, "0")}
                          </span>
                          <span className="min-w-0 flex-1 truncate text-[13px] font-medium">
                            {chapter.title}
                          </span>
                          <span
                            className={cn(
                              "hidden items-center gap-1.5 text-[10px] sm:flex",
                              chapterTone(chapter.status),
                            )}
                          >
                            <span
                              className={cn("h-1.5 w-1.5 rounded-full", chapterDot(chapter.status))}
                            />
                            {CHAPTER_STATUS_LABEL[chapter.status]}
                          </span>
                          <span className="w-16 flex-none text-right text-[10px] tabular-nums text-ink-mute">
                            {formatNumber(chapter.wordCount)} 字
                          </span>
                          <span className="hidden w-16 flex-none text-right text-[10px] text-ink-mute md:block">
                            {formatRelative(chapter.updatedAt)}
                          </span>
                        </Link>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => setPendingDelete({ kind: "chapter", chapter })}
                            className="flex h-8 w-8 flex-none items-center justify-center rounded-full text-ink-mute opacity-100 transition-colors hover:bg-danger-soft hover:text-danger sm:opacity-0 sm:group-hover:opacity-100 sm:focus-visible:opacity-100"
                            aria-label={`删除章节 ${chapter.title}`}
                            title="删除章节"
                          >
                            <Trash2 size={13} />
                          </button>
                        ) : null}
                      </div>
                    ))}
                  </div>
                )}
              </article>
            ))}
          </div>
        </section>

        <aside className="space-y-4">
          <section className="card p-5">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-semibold">作品资料</h2>
              {canEdit ? (
                <button
                  type="button"
                  className="icon-capsule h-8 w-8"
                  onClick={() => setEditOpen(true)}
                  aria-label="编辑作品资料"
                >
                  <Pencil size={14} />
                </button>
              ) : null}
            </div>
            <dl className="mt-4 space-y-3 text-[12px]">
              <InfoRow label="题材" value={work.genre} />
              <InfoRow label="状态" value={WORK_STATUS_LABEL[work.status]} />
              <InfoRow label="创建" value={formatDateTime(work.createdAt)} />
              <InfoRow label="最近编辑" value={formatDateTime(work.updatedAt)} />
            </dl>
            <div className="mt-5 rounded-2xl bg-surface-2 p-4">
              <div className="flex items-center justify-between text-[11px]">
                <span className="text-ink-mute">目标进度</span>
                <span className="font-medium">
                  {work.targetWords > 0
                    ? `${formatWords(work.totalWords)} / ${formatWords(work.targetWords)}`
                    : "未设置目标"}
                </span>
              </div>
              <div className="mt-2.5 h-1 overflow-hidden rounded-full bg-line">
                <div
                  className="h-full rounded-full bg-accent"
                  style={{ width: `${progress ?? 0}%` }}
                />
              </div>
              <p className="mt-2 text-[10px] text-ink-mute">
                {progress !== null ? `已完成 ${progress}%` : "在作品资料中设置目标字数"}
              </p>
            </div>
          </section>

          <section className="card p-5">
            <div className="flex items-center justify-between gap-2">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <Users size={15} className="text-ink-mute" />
                协作成员
              </h2>
              <span className="text-[10px] tabular-nums text-ink-mute">
                {work.members.length} 人
              </span>
            </div>
            <ul className="mt-4 space-y-3">
              {work.members.map((member) => {
                const isAuthor = member.user.id === work.author.id;
                const busy = updatingMember === member.user.id;
                return (
                  <li key={member.user.id} className="flex items-center gap-2.5">
                    <span
                      className="flex h-9 w-9 flex-none items-center justify-center rounded-full text-[12px] font-semibold text-on-cover"
                      style={{ backgroundColor: member.user.avatarColor }}
                    >
                      {initialOf(member.user.name)}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-[12px] font-medium">{member.user.name}</p>
                      <p className="truncate text-[10px] text-ink-mute">@{member.user.handle}</p>
                    </div>
                    {isAuthor ? (
                      <span className="chip chip-accent flex-none">所有者</span>
                    ) : canManage ? (
                      <div className="flex flex-none items-center gap-1">
                        <select
                          className="h-8 rounded-full border border-line bg-surface px-2 text-[11px] text-ink-soft"
                          value={member.role}
                          onChange={(event) =>
                            changeMemberRole(member, event.target.value as WorkRole)
                          }
                          disabled={busy}
                          aria-label={`调整 ${member.user.name} 的角色`}
                        >
                          {ASSIGNABLE_WORK_ROLES.map((role) => (
                            <option key={role} value={role}>
                              {WORK_ROLE_LABEL[role]}
                            </option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="flex h-8 w-8 items-center justify-center rounded-full text-ink-mute transition-colors hover:bg-danger-soft hover:text-danger"
                          onClick={() => setPendingMember(member)}
                          disabled={busy}
                          aria-label={`移除成员 ${member.user.name}`}
                          title="移除成员"
                        >
                          {busy ? (
                            <Loader2 size={13} className="animate-spin-slow" />
                          ) : (
                            <Trash2 size={13} />
                          )}
                        </button>
                      </div>
                    ) : (
                      <span className="chip flex-none">{WORK_ROLE_LABEL[member.role]}</span>
                    )}
                  </li>
                );
              })}
            </ul>

            {canManage ? (
              <form onSubmit={addMember} className="mt-4 border-t border-line pt-4">
                <label className="field-label" htmlFor="member-handle">
                  按账号邀请
                </label>
                <div className="flex gap-2">
                  <input
                    id="member-handle"
                    className="field-input h-10 min-w-0 flex-1"
                    value={memberHandle}
                    onChange={(event) => setMemberHandle(event.target.value)}
                    placeholder="@handle"
                    maxLength={25}
                    autoComplete="off"
                  />
                  <select
                    className="h-10 flex-none rounded-full border border-line bg-surface px-2.5 text-[12px] text-ink-soft"
                    value={memberRole}
                    onChange={(event) => setMemberRole(event.target.value as WorkRole)}
                    aria-label="成员角色"
                  >
                    {ASSIGNABLE_WORK_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {WORK_ROLE_LABEL[role]}
                      </option>
                    ))}
                  </select>
                </div>
                <p className="mt-2 text-[10px] leading-5 text-ink-mute">
                  {WORK_ROLE_HINT[memberRole]}
                </p>
                <button
                  type="submit"
                  className={capsule("secondary", "sm", "mt-2.5 w-full")}
                  disabled={addingMember || !memberHandle.trim()}
                >
                  {addingMember ? (
                    <Loader2 size={13} className="animate-spin-slow" />
                  ) : (
                    <UserPlus size={13} />
                  )}
                  添加成员
                </button>
                <p className="mt-2 text-[10px] leading-5 text-ink-mute">
                  对方需先在本机注册账号，密码无法代为设置。
                </p>
              </form>
            ) : (
              <p className="mt-4 border-t border-line pt-4 text-[10px] leading-5 text-ink-mute">
                只有作品所有者可以邀请或调整成员。
              </p>
            )}
          </section>

          <section className="card p-5">
            <h2 className="text-sm font-semibold">导出</h2>
            <p className="mt-1 text-[11px] leading-5 text-ink-mute">
              网页导出可直接打开或分享；JSON 备份保留书封、设定与插画，可重新导入。
            </p>
            <div className="mt-4 space-y-2">
              <a
                href={`/api/works/${work.id}/export?format=txt`}
                download
                className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-[12px] font-medium transition-colors hover:bg-surface-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft">
                  <FileText size={15} />
                </span>
                <span className="flex-1">
                  纯文本 TXT
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-mute">
                    保留卷章标题
                  </span>
                </span>
                <Download size={14} className="text-ink-mute" />
              </a>
              <a
                href={`/api/works/${work.id}/export?format=md`}
                download
                className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-[12px] font-medium transition-colors hover:bg-surface-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft">
                  <BookOpen size={15} />
                </span>
                <span className="flex-1">
                  Markdown
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-mute">
                    便于版本管理与排版
                  </span>
                </span>
                <Download size={14} className="text-ink-mute" />
              </a>
              <a
                href={`/api/works/${work.id}/export?format=html`}
                download
                className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-[12px] font-medium transition-colors hover:bg-surface-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft">
                  <Globe size={15} />
                </span>
                <span className="flex-1">
                  网页 HTML
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-mute">
                    单文件，含封面与插画
                  </span>
                </span>
                <Download size={14} className="text-ink-mute" />
              </a>
              <a
                href={`/api/works/${work.id}/export?format=json`}
                download
                className="flex items-center gap-3 rounded-2xl bg-surface-2 px-3.5 py-3 text-[12px] font-medium transition-colors hover:bg-surface-3"
              >
                <span className="flex h-8 w-8 items-center justify-center rounded-full bg-surface text-ink-soft">
                  <FileJson size={15} />
                </span>
                <span className="flex-1">
                  整书备份 JSON
                  <span className="mt-0.5 block text-[10px] font-normal text-ink-mute">
                    含封面、设定与插画，可再导入
                  </span>
                </span>
                <Download size={14} className="text-ink-mute" />
              </a>
            </div>
          </section>

          <section className="card p-5">
            <h2 className="flex items-center gap-2 text-sm font-semibold">
              <Layers size={15} className="text-ink-mute" />
              写作提示
            </h2>
            <p className="mt-2 text-[11px] leading-5 text-ink-soft">
              编辑器会自动保存正文，并在本地保留一份草稿。切换章节前会先尝试把最后一个字写进数据库。
            </p>
          </section>
        </aside>
      </div>

      <EditWorkDialog work={work} open={editOpen} onClose={() => setEditOpen(false)} />

      <VolumeDialog
        open={volumeDialog !== null}
        onClose={() => setVolumeDialog(null)}
        workId={work.id}
        volume={volumeDialog?.mode === "edit" ? volumeDialog.volume : null}
        suggestedTitle={`第 ${work.volumes.length + 1} 卷`}
      />

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => setPendingDelete(null)}
        onConfirm={confirmDelete}
        pending={deleting}
        title={pendingDelete?.kind === "volume" ? "删除这一卷？" : "删除这一章？"}
        description={
          pendingDelete?.kind === "chapter"
            ? `《${pendingDelete.chapter.title}》将从目录与统计中移除。`
            : pendingDelete?.kind === "volume"
              ? `《${pendingDelete.volume.title}》是空卷，删除后不可恢复。`
              : ""
        }
        confirmLabel="确认删除"
      />

      <ConfirmDialog
        open={pendingMember !== null}
        onClose={() => setPendingMember(null)}
        onConfirm={confirmRemoveMember}
        pending={removingMember}
        title="移除协作成员？"
        description={
          pendingMember
            ? `@${pendingMember.user.handle} 将立即失去《${work.title}》的访问权限。`
            : ""
        }
        confirmLabel="确认移除"
      />
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start justify-between gap-3">
      <dt className="flex-none text-ink-mute">{label}</dt>
      <dd className="text-right text-ink-soft">{value}</dd>
    </div>
  );
}

function FeatherIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20.24 12.24a6 6 0 0 0-8.49-8.49L5 10.5V19h8.5z" />
      <line x1="16" y1="8" x2="2" y2="22" />
      <line x1="17.5" y1="15" x2="9" y2="15" />
    </svg>
  );
}
