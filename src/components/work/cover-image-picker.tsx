// Author: yxpil

"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, Trash2 } from "lucide-react";
import { BookCover } from "@/components/book-cover";
import { capsule } from "@/components/ui/button";

const MAX_SOURCE_BYTES = 12 * 1024 * 1024;
const MAX_OUTPUT_LENGTH = 1_000_000;
const TARGET_WIDTH = 800;
const TARGET_HEIGHT = 1000;
const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("无法读取这张图片"));
    };
    image.src = url;
  });
}

function cropToCover(image: HTMLImageElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = TARGET_WIDTH;
  canvas.height = TARGET_HEIGHT;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("浏览器无法处理图片");

  const targetRatio = TARGET_WIDTH / TARGET_HEIGHT;
  const sourceRatio = image.naturalWidth / image.naturalHeight;
  let sourceWidth = image.naturalWidth;
  let sourceHeight = image.naturalHeight;
  if (sourceRatio > targetRatio) {
    sourceWidth = Math.round(image.naturalHeight * targetRatio);
  } else {
    sourceHeight = Math.round(image.naturalWidth / targetRatio);
  }
  const sourceX = Math.round((image.naturalWidth - sourceWidth) / 2);
  const sourceY = Math.round((image.naturalHeight - sourceHeight) / 2);
  context.drawImage(
    image,
    sourceX,
    sourceY,
    sourceWidth,
    sourceHeight,
    0,
    0,
    TARGET_WIDTH,
    TARGET_HEIGHT,
  );
  return canvas;
}

async function processFile(file: File): Promise<string> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("只支持 JPG、PNG 或 WebP 图片");
  }
  if (file.size > MAX_SOURCE_BYTES) {
    throw new Error("原始图片需小于 12 MB");
  }
  const image = await loadImage(file);
  if (!image.naturalWidth || !image.naturalHeight) {
    throw new Error("无法读取这张图片");
  }
  const canvas = cropToCover(image);

  for (const quality of [0.84, 0.72, 0.6]) {
    const dataUrl = canvas.toDataURL("image/jpeg", quality);
    if (dataUrl.length <= MAX_OUTPUT_LENGTH) return dataUrl;
  }
  throw new Error("封面压缩后仍然过大，请换一张图片");
}

export function CoverImagePicker({
  value,
  title,
  author,
  genre,
  color,
  onChange,
}: {
  value: string | null;
  title: string;
  author?: string;
  genre?: string;
  color: string;
  onChange: (value: string | null) => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const pick = async (file: File | undefined) => {
    if (!file) return;
    setPending(true);
    setError("");
    try {
      const next = await processFile(file);
      onChange(next);
    } catch (processError) {
      setError(processError instanceof Error ? processError.message : "封面处理失败");
    } finally {
      setPending(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div className="flex flex-wrap items-center gap-4 sm:flex-nowrap">
      <div className="w-[86px] flex-none sm:w-[100px]">
        <BookCover
          title={title.trim() || "未命名作品"}
          author={author}
          genre={genre}
          color={color}
          image={value}
          size="sm"
        />
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={capsule("secondary", "sm")}
            onClick={() => inputRef.current?.click()}
            disabled={pending}
          >
            {pending ? (
              <Loader2 size={13} className="animate-spin-slow" />
            ) : (
              <ImagePlus size={13} />
            )}
            {pending ? "正在处理" : value ? "更换封面" : "上传封面"}
          </button>
          {value ? (
            <button
              type="button"
              className={capsule("ghost", "sm")}
              onClick={() => {
                setError("");
                onChange(null);
              }}
              disabled={pending}
            >
              <Trash2 size={13} />
              移除图片
            </button>
          ) : null}
        </div>
        <p className="mt-2 text-[10px] leading-5 text-ink-mute">
          支持 JPG、PNG、WebP，自动裁剪为 4:5 并压缩。没有图片时使用底色与书名排版。
        </p>
        {error ? (
          <p className="mt-1 text-[10px] text-danger" role="status">
            {error}
          </p>
        ) : null}
      </div>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPTED_TYPES.join(",")}
        className="sr-only"
        onChange={(event) => void pick(event.target.files?.[0])}
        aria-label="选择封面图片"
      />
    </div>
  );
}
