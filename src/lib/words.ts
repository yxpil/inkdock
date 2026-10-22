// Author: yxpil

const CJK_PATTERN = /[\u3400-\u4dbf\u4e00-\u9fff\uf900-\ufaff]/g;
const LATIN_WORD_PATTERN = /[A-Za-z0-9]+(?:['’-][A-Za-z0-9]+)*/g;

/**
 * Chinese publishing convention: each CJK character counts as one word,
 * while a run of latin letters or digits counts as one.
 * Whitespace and punctuation are not counted.
 */
export function countWords(text: string): number {
  if (!text) return 0;
  const cjk = text.match(CJK_PATTERN)?.length ?? 0;
  const latin = text.match(LATIN_WORD_PATTERN)?.length ?? 0;
  return cjk + latin;
}

export function countParagraphs(text: string): number {
  if (!text.trim()) return 0;
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean).length;
}

export function readingMinutes(text: string): number {
  const words = countWords(text);
  if (words === 0) return 0;
  return Math.max(1, Math.ceil(words / 400));
}

export function paragraphList(text: string): string[] {
  return text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);
}
