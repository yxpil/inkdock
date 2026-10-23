// Author: yxpil

"use client";

import { useMemo, useRef, useState, type Dispatch, type SetStateAction } from "react";
import {
  ChevronDown,
  ImagePlus,
  Images,
  Loader2,
  MapPin,
  Pencil,
  Trash2,
} from "lucide-react";
import type { ChapterIllustration } from "@/lib/types";
import { prepareIllustrationFile } from "@/lib/illustration-image";
import { apiFetch } from "@/lib/api-client";
import { capsule } from "@/components/ui/button";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { paragraphList } from "@/lib/words";
import { cn, truncate } from "@/lib/utils";

type Draft =
  | {
      mode: "create";
      paragraph: number;
      cursorParagraph: number;
      caption: string;
      image: string;
      width: number;
      height: number;
    }
  | {
      mode: "edit";
      paragraph: number;
      cursorParagraph: number;
      caption: string;
      illustration: ChapterIllustration;
    };

function sortIllustrations(items: ChapterIllustration[]): ChapterIllustration[] {
  return [...items].sort(
    (a, b) => a.paragraph - b.paragraph || a.createdAt.localeCompare(b.createdAt),
  );
}

export function ChapterIllustrations({
  chapterId,
  content,
  illustrations,
  onIllustrationsChange,
  getCaretParagraph,
}: {
  chapterId: string;
  content: string;
  illustrations: ChapterIllustration[];
  onIllustrationsChange: Dispatch<SetStateAction<ChapterIllustration[]>>;
  getCaretParagraph: () => number;
}) {
  const { toast } = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [pending, setPending] = useState(false);
  const [deleteArmed, setDeleteArmed] = useState(false);
  const [error, setError] = useState("");

  const paragraphs = useMemo(() => paragraphList(content), [content]);
  const sorted = useMemo(() => sortIllustrations(illustrations), [illustrations]);

  const positionOptions = useMemo(() => {
    const options = [{ value: 0, label: "正文之前" }];
    paragraphs.forEach((text, index) => {
      options.push({
        value: index + 1,
        label: `第 ${index + 1} 段之后 · ${truncate(text, 18)}`,
      });
    });
    if (draft && draft.paragraph > paragraphs.length) {
      options.push({
        value: draft.paragraph,
        label: `第 ${draft.paragraph} 段之后（正文较短，显示在末尾）`,
      });
    }
    return options;
  }, [draft, paragraphs]);

  const anchorLabel = (illustration: ChapterIllustration): string => {
    if (illustration.paragraph <= 0) return "正文之前";
    const text = paragraphs[illustration.paragraph - 1];
    if (!text) return `第 ${illustration.paragraph} 段之后 · 显示在正文末尾`;
    return `第 ${illustration.paragraph} 段之后 · ${truncate(text, 16)}`;
  };

  const openPicker = () => {
    if (preparing || pending) return;
    setError("");
    fileRef.current?.click();
  };

  const handleFile = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setPreparing(true);
    setError("");
    try {
      const prepared = await prepareIllustrationFile(file);
      setDraft({
        mode: "create",
        ...prepared,
        paragraph: getCaretParagraph(),
        cursorParagraph: getCaretParagraph(),
        caption: "",
      });
      setDeleteArmed(false);
    } catch (fileError) {
      toast(fileError instanceof Error ? fileError.message : "无法读取这张图片", "danger");
    } finally {
      setPreparing(false);
    }
  };

  const openEditor = (illustration: ChapterIllustration) => {
    setDraft({
      mode: "edit",
      illustration,
      paragraph: illustration.paragraph,
      cursorParagraph: getCaretParagraph(),
      caption: illustration.caption,
    });
    setDeleteArmed(false);
    setError("");
  };

  const closeDraft = () => {
    if (pending) return;
    setDraft(null);
    setDeleteArmed(false);
    setError("");
  };

  const patchDraft = (patch: { paragraph?: number; caption?: string }) => {
    setDraft((current) => (current ? { ...current, ...patch } : current));
    setDeleteArmed(false);
    setError("");
  };

  const save = async () => {
    if (!draft) return;
    setPending(true);
    setError("");
    try {
      if (draft.mode === "create") {
        const data = await apiFetch<{ illustration: ChapterIllustration }>(
          `/api/chapters/${chapterId}/illustrations`,
          {
            method: "POST",
            body: JSON.stringify({
              paragraph: draft.paragraph,
              caption: draft.caption.trim(),
              image: draft.image,
              width: draft.width,
              height: draft.height,
            }),
          },
        );
        if (!data.illustration) throw new Error("保存后未能读回插画");
        onIllustrationsChange((current) =>
          sortIllustrations([...current, data.illustration]),
        );
        toast("插画已插入，手机预览会在所选段落之后显示");
      } else {
        const data = await apiFetch<{ illustration: ChapterIllustration }>(
          `/api/illustrations/${draft.illustration.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              paragraph: draft.paragraph,
              caption: draft.caption.trim(),
            }),
          },
        );
        if (!data.illustration) throw new Error("保存后未能读回插画");
        onIllustrationsChange((current) =>
          sortIllustrations(
            current.map((item) =>
              item.id === data.illustration.id ? data.illustration : item,
            ),
          ),
        );
        toast("插画已更新");
      }
      setDraft(null);
      setDeleteArmed(false);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setPending(false);
    }
  };

  const remove = async () => {
    if (!draft || draft.mode !== "edit") return;
    setPending(true);
    setError("");
    try {
      await apiFetch(`/api/illustrations/${draft.illustration.id}`, {
        method: "DELETE",
      });
      onIllustrationsChange((current) =>
        current.filter((item) => item.id !== draft.illustration.id),
      );
      toast("插画已删除");
      setDraft(null);
      setDeleteArmed(false);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "删除失败");
    } finally {
      setPending(false);
    }
  };

  const preview = draft
    ? draft.mode === "create"
      ? { src: draft.image, alt: "待插入插画预览" }
      : { src: draft.illustration.imageUrl, alt: draft.caption || "章节插画" }
    : null;

  return (
    <section
      id="chapter-illustrations"
      className="mt-4 scroll-mt-4 rounded-[28px] border border-line bg-surface px-4 py-4 shadow-soft sm:px-5"
      aria-label="本章插画"
    >
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(event) => void handleFile(event)}
      />

      <header className="flex flex-wrap items-start justify-between gap-3">
        <div className="flex min-w-0 items-start gap-2.5">
          <span className="flex h-8 w-8 flex-none items-center justify-center rounded-full bg-surface-2 text-ink-soft">
            <Images size={15} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <h2 className="text-[13px] font-semibold">本章插画</h2>
            <p className="mt-0.5 text-[10px] leading-5 text-ink-mute">
              {sorted.length > 0
                ? `${sorted.length} 张 · 按段落位置出现在手机预览中`
                : "插画独立保存，不写入正文，也不影响字数与自动保存。"}
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={openPicker}
          disabled={preparing || pending}
          className={capsule("secondary", "sm")}
        >
          {preparing ? (
            <Loader2 size={13} className="animate-spin-slow" />
          ) : (
            <ImagePlus size={13} />
          )}
          插入插画
        </button>
      </header>

      {sorted.length === 0 ? (
        <button
          type="button"
          onClick={openPicker}
          disabled={preparing || pending}
          className="mt-4 flex w-full items-center justify-center gap-2 rounded-[22px] border border-line bg-surface-2 px-4 py-6 text-[11px] text-ink-mute transition-colors hover:text-ink"
        >
          <ImagePlus size={15} aria-hidden="true" />
          把光标放在段落里，插入第一张插画
        </button>
      ) : (
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {sorted.map((illustration) => (
            <article
              key={illustration.id}
              className="overflow-hidden rounded-[22px] border border-line bg-surface-2"
            >
              <button
                type="button"
                onClick={() => openEditor(illustration)}
                className="block w-full"
                aria-label={`编辑插画：${illustration.caption || "没有图注"}`}
              >
                <img
                  src={illustration.imageUrl}
                  alt={illustration.caption || "章节插画"}
                  width={illustration.width}
                  height={illustration.height}
                  loading="lazy"
                  className="h-28 w-full object-cover"
                />
              </button>
              <div className="p-3">
                <p
                  className={cn(
                    "line-clamp-2 text-[11px] font-medium leading-5",
                    illustration.caption ? "text-ink" : "text-ink-mute",
                  )}
                >
                  {illustration.caption || "没有图注"}
                </p>
                <p className="mt-1 flex items-start gap-1 text-[10px] leading-4 text-ink-mute">
                  <MapPin size={11} className="mt-0.5 flex-none" aria-hidden="true" />
                  <span className="min-w-0">{anchorLabel(illustration)}</span>
                </p>
                <button
                  type="button"
                  onClick={() => openEditor(illustration)}
                  className="mt-2 inline-flex h-7 items-center gap-1 rounded-full bg-surface px-2.5 text-[10px] font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  <Pencil size={11} aria-hidden="true" />
                  编辑
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      <Modal
        open={Boolean(draft)}
        onClose={closeDraft}
        title={draft?.mode === "edit" ? "编辑插画" : "插入插画"}
        description={
          draft?.mode === "edit"
            ? "可以调整图注与出现位置；图片本身不可替换，需要时请删除后重新插入。"
            : "图片只保存在这一章，正文仍然是纯文本。"
        }
        width="md"
        footer={
          draft ? (
            <div className="flex w-full items-center justify-between gap-2">
              <div>
                {draft.mode === "edit" ? (
                  <button
                    type="button"
                    onClick={() => setDeleteArmed(true)}
                    disabled={pending || deleteArmed}
                    className="inline-flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-medium text-danger transition-colors hover:bg-danger-soft disabled:opacity-40"
                  >
                    <Trash2 size={14} />
                    删除
                  </button>
                ) : null}
              </div>
              <div className="flex gap-2">
                <button
                  type="button"
                  className={capsule("ghost", "md")}
                  onClick={closeDraft}
                  disabled={pending}
                >
                  取消
                </button>
                <button
                  type="button"
                  className={capsule("primary", "lg", "min-w-[112px]")}
                  onClick={() => void save()}
                  disabled={pending}
                >
                  {pending ? <Loader2 size={15} className="animate-spin-slow" /> : null}
                  {draft.mode === "edit" ? "保存修改" : "插入"}
                </button>
              </div>
            </div>
          ) : null
        }
      >
        {draft && preview ? (
          <div className="space-y-5">
            <div className="overflow-hidden rounded-[22px] border border-line bg-surface-2">
              <img
                src={preview.src}
                alt={preview.alt}
                className="max-h-[260px] w-full object-contain"
              />
            </div>

            <div>
              <label className="field-label" htmlFor="illustration-caption">
                图注
              </label>
              <input
                id="illustration-caption"
                className="field-input"
                value={draft.caption}
                onChange={(event) => patchDraft({ caption: event.target.value })}
                maxLength={120}
                placeholder="可选，例如：雾港的末班渡轮"
                autoComplete="off"
              />
              <p className="mt-1.5 text-right text-[10px] tabular-nums text-ink-mute">
                {draft.caption.length} / 120
              </p>
            </div>

            <div>
              <label className="field-label" htmlFor="illustration-position">
                出现位置
              </label>
              <div className="relative">
                <select
                  id="illustration-position"
                  value={draft.paragraph}
                  onChange={(event) =>
                    patchDraft({ paragraph: Number(event.target.value) })
                  }
                  className="field-input appearance-none pr-10"
                >
                  {positionOptions.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
                <ChevronDown
                  size={14}
                  className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-ink-mute"
                  aria-hidden="true"
                />
              </div>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => patchDraft({ paragraph: draft.cursorParagraph })}
                  className="inline-flex h-7 items-center rounded-full bg-surface-2 px-3 text-[10px] font-medium text-ink-soft transition-colors hover:text-ink"
                >
                  使用光标位置
                  {draft.cursorParagraph <= 0
                    ? "（正文之前）"
                    : `（第 ${draft.cursorParagraph} 段后）`}
                </button>
                <span className="text-[10px] text-ink-mute">
                  当前按「{paragraphs.length}」段计算位置
                </span>
              </div>
            </div>

            {deleteArmed && draft.mode === "edit" ? (
              <div className="rounded-[22px] border border-danger/30 bg-danger-soft p-4">
                <p className="text-[12px] leading-5 text-danger">
                  删除后无法恢复，正文不会受影响。
                </p>
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    className={capsule("danger", "sm")}
                    onClick={() => void remove()}
                    disabled={pending}
                  >
                    {pending ? <Loader2 size={13} className="animate-spin-slow" /> : null}
                    确认删除
                  </button>
                  <button
                    type="button"
                    className={capsule("ghost", "sm")}
                    onClick={() => setDeleteArmed(false)}
                    disabled={pending}
                  >
                    保留
                  </button>
                </div>
              </div>
            ) : null}

            {error ? <p className="text-xs text-danger">{error}</p> : null}
          </div>
        ) : null}
      </Modal>
    </section>
  );
}
