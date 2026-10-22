// Author: yxpil

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { capsule } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CoverImagePicker } from "@/components/work/cover-image-picker";
import { apiFetch } from "@/lib/api-client";
import {
  COVER_COLORS,
  GENRES,
  WORK_STATUSES,
  WORK_STATUS_LABEL,
} from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { VolumeWithChapters, WorkDetail, WorkStatus } from "@/lib/types";

export function EditWorkDialog({
  work,
  open,
  onClose,
}: {
  work: WorkDetail;
  open: boolean;
  onClose: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState(work.title);
  const [subtitle, setSubtitle] = useState(work.subtitle);
  const [description, setDescription] = useState(work.description);
  const [genre, setGenre] = useState(work.genre);
  const [status, setStatus] = useState<WorkStatus>(work.status);
  const [targetWords, setTargetWords] = useState(String(work.targetWords));
  const [coverColor, setCoverColor] = useState(work.coverColor);
  const [coverImage, setCoverImage] = useState<string | null>(work.coverImage);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(work.title);
    setSubtitle(work.subtitle);
    setDescription(work.description);
    setGenre(work.genre);
    setStatus(work.status);
    setTargetWords(String(work.targetWords));
    setCoverColor(work.coverColor);
    setCoverImage(work.coverImage);
    setError("");
  }, [open, work]);

  const save = async () => {
    if (!title.trim()) {
      setError("书名不能为空。");
      return;
    }
    setPending(true);
    setError("");
    try {
      await apiFetch(`/api/works/${work.id}`, {
        method: "PATCH",
        body: JSON.stringify({
          title: title.trim(),
          subtitle: subtitle.trim(),
          description: description.trim(),
          genre,
          status,
          targetWords: Number(targetWords) || 0,
          coverColor,
          coverImage,
        }),
      });
      onClose();
      router.refresh();
      toast("作品资料已更新");
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "保存失败";
      setError(message);
      toast(message, "danger");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="作品资料"
      description="这些信息会出现在书架、导出文件与预览中。"
      width="lg"
      footer={
        <>
          <button type="button" className={capsule("ghost", "md")} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={capsule("primary", "lg", "min-w-[112px]")}
            onClick={save}
            disabled={pending}
          >
            {pending ? <Loader2 size={15} className="animate-spin-slow" /> : null}
            保存修改
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div className="grid gap-4 sm:grid-cols-[1fr_180px]">
          <div>
            <label className="field-label" htmlFor="edit-work-title">
              书名
            </label>
            <input
              id="edit-work-title"
              className="field-input"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              maxLength={60}
            />
            {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          </div>
          <div>
            <label className="field-label" htmlFor="edit-work-status">
              连载状态
            </label>
            <select
              id="edit-work-status"
              className="field-input appearance-none bg-[length:0] pr-9"
              value={status}
              onChange={(event) => setStatus(event.target.value as WorkStatus)}
            >
              {WORK_STATUSES.map((item) => (
                <option key={item} value={item}>
                  {WORK_STATUS_LABEL[item]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="edit-work-subtitle">
            副标题
          </label>
          <input
            id="edit-work-subtitle"
            className="field-input"
            value={subtitle}
            onChange={(event) => setSubtitle(event.target.value)}
            maxLength={120}
            placeholder="一句话说明故事的气质"
          />
        </div>

        <div>
          <span className="field-label">题材</span>
          <div className="flex flex-wrap gap-2">
            {GENRES.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => setGenre(item)}
                className={cn(
                  "capsule h-8 px-3.5 text-xs",
                  genre === item
                    ? "bg-accent text-on-accent"
                    : "bg-surface-2 text-ink-soft hover:text-ink",
                )}
                aria-pressed={genre === item}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <label className="field-label" htmlFor="edit-work-target">
              目标字数
            </label>
            <input
              id="edit-work-target"
              className="field-input"
              type="number"
              min={0}
              step={10000}
              value={targetWords}
              onChange={(event) => setTargetWords(event.target.value)}
            />
          </div>
          <div>
            <span className="field-label">封面底色</span>
            <div className="flex flex-wrap gap-2">
              {COVER_COLORS.map((color) => (
                <button
                  key={color.value}
                  type="button"
                  onClick={() => setCoverColor(color.value)}
                  className={cn(
                    "h-9 w-9 rounded-full border-2 transition-transform",
                    coverColor === color.value
                      ? "scale-105 border-accent"
                      : "border-transparent hover:scale-105",
                  )}
                  style={{ backgroundColor: color.value }}
                  aria-label={color.name}
                  aria-pressed={coverColor === color.value}
                  title={color.name}
                />
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="field-label">书封图片</span>
          <CoverImagePicker
            value={coverImage}
            title={title}
            author={work.authorName}
            genre={genre}
            color={coverColor}
            onChange={setCoverImage}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="edit-work-description">
            简介
          </label>
          <textarea
            id="edit-work-description"
            className="field-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={5}
            maxLength={2000}
          />
        </div>
      </div>
    </Modal>
  );
}

export function VolumeDialog({
  open,
  onClose,
  workId,
  volume,
  suggestedTitle,
}: {
  open: boolean;
  onClose: () => void;
  workId: string;
  volume?: VolumeWithChapters | null;
  suggestedTitle: string;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [title, setTitle] = useState(volume?.title ?? suggestedTitle);
  const [summary, setSummary] = useState(volume?.summary ?? "");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setTitle(volume?.title ?? suggestedTitle);
    setSummary(volume?.summary ?? "");
    setError("");
  }, [open, volume, suggestedTitle]);

  const save = async () => {
    if (!title.trim()) {
      setError("卷名不能为空。");
      return;
    }
    setPending(true);
    setError("");
    try {
      if (volume) {
        await apiFetch(`/api/volumes/${volume.id}`, {
          method: "PATCH",
          body: JSON.stringify({ title: title.trim(), summary: summary.trim() }),
        });
        toast("卷信息已更新");
      } else {
        await apiFetch(`/api/works/${workId}/volumes`, {
          method: "POST",
          body: JSON.stringify({ title: title.trim(), summary: summary.trim() }),
        });
        toast("新卷已建立");
      }
      onClose();
      router.refresh();
    } catch (saveError) {
      const message = saveError instanceof Error ? saveError.message : "保存失败";
      setError(message);
      toast(message, "danger");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={volume ? "编辑卷" : "新建卷"}
      description="卷是长篇的呼吸单位，可以按时间、地点或阶段划分。"
      footer={
        <>
          <button type="button" className={capsule("ghost", "md")} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={capsule("primary", "md", "min-w-[100px]")}
            onClick={save}
            disabled={pending}
          >
            {pending ? <Loader2 size={14} className="animate-spin-slow" /> : null}
            {volume ? "保存" : "建立新卷"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="volume-title">
            卷名
          </label>
          <input
            id="volume-title"
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            maxLength={60}
            placeholder="例如：第一卷 潮声"
          />
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
        </div>
        <div>
          <label className="field-label" htmlFor="volume-summary">
            卷简介
          </label>
          <textarea
            id="volume-summary"
            className="field-textarea"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            maxLength={500}
            rows={3}
            placeholder="这一卷要发生什么？"
          />
        </div>
      </div>
    </Modal>
  );
}
