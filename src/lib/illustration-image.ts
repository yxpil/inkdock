// Author: yxpil

"use client";

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "image/webp"];
const MAX_INPUT_BYTES = 20 * 1024 * 1024;
const MAX_EDGE = 1400;
const MAX_OUTPUT_LENGTH = 1_400_000;

export interface PreparedIllustration {
  image: string;
  width: number;
  height: number;
}

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
      reject(new Error("无法读取这张图片，请换一张试试。"));
    };
    image.src = url;
  });
}

function encodeWithinLimit(
  canvas: HTMLCanvasElement,
  mime: "image/webp" | "image/jpeg",
): string {
  let quality = 0.86;
  let dataUrl = canvas.toDataURL(mime, quality);
  while (dataUrl.length > MAX_OUTPUT_LENGTH && quality > 0.5) {
    quality = Math.round((quality - 0.08) * 100) / 100;
    dataUrl = canvas.toDataURL(mime, quality);
  }
  return dataUrl;
}

function flattenOnWhite(source: HTMLCanvasElement): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = source.width;
  canvas.height = source.height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法处理图片。");
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(source, 0, 0);
  return canvas;
}

/**
 * Re-encodes the picked file in the browser so a manuscript never carries
 * camera-sized originals. WebP keeps transparency; JPEG is the fallback for
 * browsers without a WebP encoder, flattened onto a white matte.
 */
export async function prepareIllustrationFile(file: File): Promise<PreparedIllustration> {
  if (!ACCEPTED_TYPES.includes(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 图片。");
  }
  if (file.size > MAX_INPUT_BYTES) {
    throw new Error("图片超过 20 MB，请先压缩后再插入。");
  }

  const image = await loadImage(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(image.naturalWidth, image.naturalHeight));
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));

  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("当前浏览器无法处理图片。");
  context.imageSmoothingEnabled = true;
  context.imageSmoothingQuality = "high";
  context.drawImage(image, 0, 0, width, height);

  let dataUrl = encodeWithinLimit(canvas, "image/webp");
  if (!dataUrl.startsWith("data:image/webp")) {
    dataUrl = encodeWithinLimit(flattenOnWhite(canvas), "image/jpeg");
  }
  if (!dataUrl.startsWith("data:image/") || dataUrl.length > MAX_OUTPUT_LENGTH) {
    throw new Error("图片压缩后仍然过大，请选择更小的图片。");
  }

  return { image: dataUrl, width, height };
}
