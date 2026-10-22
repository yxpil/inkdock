// Author: yxpil

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { capsule } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { CoverImagePicker } from "@/components/work/cover-image-picker";
import { COVER_COLORS, DEFAULT_COVER_COLOR, GENRES } from "@/lib/constants";
import { cn } from "@/lib/utils";

export function CreateWorkDialog({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [title, setTitle] = useState("");
  const [genre, setGenre] = useState<string>("悬疑");
  const [description, setDescription] = useState("");
  const [targetWords, setTargetWords] = useState("100000");
  const [coverColor, setCoverColor] = useState<string>(DEFAULT_COVER_COLOR);
  const [coverImage, setCoverImage] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [pending, setPending] = useState(false);

  const submit = async () => {
    setError("");
    if (!title.trim()) {
      setError("请先给作品起一个名字。");
      return;
    }
    setPending(true);
    try {
      const response = await fetch("/api/works", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim(),
          genre,
          description: description.trim(),
          targetWords: Number(targetWords) || 0,
          coverColor,
          coverImage,
        }),
      });
      const data = (await response.json()) as {
        ok?: boolean;
        error?: string;
        chapterId?: string;
      };
      if (!response.ok || !data.ok || !data.chapterId) {
        throw new Error(data.error || "创建作品失败");
      }
      onClose();
      router.push(`/write/${data.chapterId}`);
    } catch (submitError) {
      const message = submitError instanceof Error ? submitError.message : "创建作品失败";
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
      title="新建作品"
      description="先给故事一个名字，其余可以慢慢补。"
      width="lg"
      footer={
        <>
          <button type="button" className={capsule("ghost", "md")} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={capsule("primary", "lg", "min-w-[120px]")}
            onClick={submit}
            disabled={pending}
          >
            {pending ? <Loader2 size={16} className="animate-spin-slow" /> : null}
            {pending ? "正在建立" : "开始写作"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <label className="field-label" htmlFor="work-title">
            书名
          </label>
          <input
            id="work-title"
            className="field-input"
            value={title}
            onChange={(event) => setTitle(event.target.value)}
            placeholder="例如：雾港来信"
            maxLength={60}
            autoComplete="off"
          />
          {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
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

        <div className="grid gap-5 sm:grid-cols-2">
          <div>
            <label className="field-label" htmlFor="work-target">
              目标字数
            </label>
            <input
              id="work-target"
              className="field-input"
              type="number"
              min={0}
              step={10000}
              value={targetWords}
              onChange={(event) => setTargetWords(event.target.value)}
              placeholder="100000"
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
                    "flex h-9 items-center gap-2 rounded-full border px-2.5 text-[11px] transition-colors",
                    coverColor === color.value
                      ? "border-accent bg-accent-soft text-ink"
                      : "border-line bg-surface-2 text-ink-soft hover:text-ink",
                  )}
                  aria-pressed={coverColor === color.value}
                  title={color.name}
                >
                  <span
                    className="flex h-4 w-4 items-center justify-center rounded-full"
                    style={{ backgroundColor: color.value }}
                  >
                    {coverColor === color.value ? (
                      <Check size={10} className="text-white" strokeWidth={3} />
                    ) : null}
                  </span>
                  {color.name}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div>
          <span className="field-label">书封图片</span>
          <CoverImagePicker
            value={coverImage}
            title={title}
            genre={genre}
            color={coverColor}
            onChange={setCoverImage}
          />
        </div>

        <div>
          <label className="field-label" htmlFor="work-description">
            简介
          </label>
          <textarea
            id="work-description"
            className="field-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="一句话也好。之后可以随时修改。"
            maxLength={2000}
            rows={4}
          />
        </div>
      </div>
    </Modal>
  );
}
