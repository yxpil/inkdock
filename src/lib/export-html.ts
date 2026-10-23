// Author: yxpil

import type { WorkArchive, WorkArchiveIllustration } from "./types";
import { countWords, paragraphList } from "./words";

const STATUS_LABEL: Record<WorkArchive["work"]["status"], string> = {
  serializing: "连载中",
  completed: "已完结",
  paused: "暂停更新",
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeColor(value: string): string {
  return /^#[0-9a-fA-F]{6}$/.test(value) ? value : "#26594a";
}

function isImageDataUrl(value: string | null): value is string {
  if (!value) return false;
  return (
    value.startsWith("data:image/jpeg;base64,") ||
    value.startsWith("data:image/png;base64,") ||
    value.startsWith("data:image/webp;base64,")
  );
}

function formatNumber(value: number): string {
  return value.toLocaleString("zh-CN");
}

function paragraphHtml(text: string): string {
  return `<p>${escapeHtml(text)}</p>`;
}

function illustrationHtml(illustration: WorkArchiveIllustration): string {
  const src = `data:image/${illustration.mime};base64,${illustration.data}`;
  const alt = escapeHtml(illustration.caption || "章节插画");
  const caption = illustration.caption
    ? `<figcaption>${escapeHtml(illustration.caption)}</figcaption>`
    : "";
  return `<figure class="illustration">
  <img src="${src}" alt="${alt}" width="${illustration.width}" height="${illustration.height}" loading="lazy" decoding="async">
  ${caption}
</figure>`;
}

interface RenderedChapter {
  id: string;
  title: string;
  wordCount: number;
  html: string;
}

interface RenderedVolume {
  id: string;
  title: string;
  summary: string;
  chapters: RenderedChapter[];
}

function renderChapters(archive: WorkArchive): RenderedVolume[] {
  let chapterNumber = 0;

  return archive.volumes.map((volume, volumeIndex) => ({
    id: `volume-${volumeIndex + 1}`,
    title: volume.title,
    summary: volume.summary,
    chapters: volume.chapters.map((chapter) => {
      chapterNumber += 1;
      const id = `chapter-${chapterNumber}`;
      const paragraphs = paragraphList(chapter.content);
      const byParagraph = new Map<number, WorkArchiveIllustration[]>();
      for (const illustration of chapter.illustrations) {
        const anchor = Math.min(
          Math.max(illustration.paragraph, 0),
          paragraphs.length,
        );
        const list = byParagraph.get(anchor) ?? [];
        list.push(illustration);
        byParagraph.set(anchor, list);
      }

      const pieces: string[] = [];
      for (const illustration of byParagraph.get(0) ?? []) {
        pieces.push(illustrationHtml(illustration));
      }
      paragraphs.forEach((paragraph, index) => {
        pieces.push(paragraphHtml(paragraph));
        for (const illustration of byParagraph.get(index + 1) ?? []) {
          pieces.push(illustrationHtml(illustration));
        }
      });
      if (pieces.length === 0) {
        pieces.push('<p class="empty">本章还没有正文。</p>');
      }

      const wordCount = countWords(chapter.content);
      return {
        id,
        title: chapter.title,
        wordCount,
        html: `<article class="chapter" id="${id}">
  <header class="chapter-head">
    <h3>${escapeHtml(chapter.title)}</h3>
    <p class="chapter-meta">${formatNumber(wordCount)} 字</p>
  </header>
  <div class="prose">
${pieces.join("\n")}
  </div>
  <p class="back-link"><a href="#toc">返回目录</a></p>
</article>`,
      };
    }),
  }));
}

function coverHtml(archive: WorkArchive): string {
  const { title, authorName, coverColor, coverImage } = archive.work;
  if (isImageDataUrl(coverImage)) {
    return `<div class="cover cover-image">
  <img src="${coverImage}" alt="《${escapeHtml(title)}》封面" width="800" height="1000">
  <div class="cover-band">
    <p class="cover-title">${escapeHtml(title)}</p>
    <p class="cover-author">${escapeHtml(authorName)}</p>
  </div>
</div>`;
  }
  return `<div class="cover cover-flat" style="background-color: ${safeColor(coverColor)}">
  <p class="cover-kicker">INKDOCK</p>
  <div>
    <p class="cover-title">${escapeHtml(title)}</p>
    <p class="cover-author">${escapeHtml(authorName)}</p>
  </div>
</div>`;
}

function tocHtml(volumes: RenderedVolume[]): string {
  const items = volumes
    .map(
      (volume) => `<li>
    <a class="toc-volume" href="#${volume.id}">${escapeHtml(volume.title)}</a>
    <ol class="toc-chapters">
${volume.chapters
  .map(
    (chapter) =>
      `      <li><a href="#${chapter.id}"><span>${escapeHtml(chapter.title)}</span><span class="toc-count">${formatNumber(chapter.wordCount)} 字</span></a></li>`,
  )
  .join("\n")}
    </ol>
  </li>`,
    )
    .join("\n");

  return `<nav class="toc" id="toc" aria-label="目录">
  <div class="toc-head">
    <div>
      <p class="eyebrow">目录</p>
      <h2>从第一篇开始</h2>
    </div>
    <p class="toc-meta">${volumes.length} 卷</p>
  </div>
  <ol class="toc-volumes">
${items}
  </ol>
</nav>`;
}

function volumeHtml(volume: RenderedVolume, index: number): string {
  const summary = volume.summary
    ? `<p class="volume-summary">${escapeHtml(volume.summary)}</p>`
    : "";
  return `<section class="volume" id="${volume.id}">
  <header class="volume-head">
    <p class="eyebrow">卷 ${String(index + 1).padStart(2, "0")}</p>
    <h2>${escapeHtml(volume.title)}</h2>
    ${summary}
  </header>
${volume.chapters.map((chapter) => chapter.html).join("\n")}
</section>`;
}

const STYLE = `
:root {
  color-scheme: light dark;
  --paper: #f4f1ea;
  --surface: #fcfbf8;
  --surface-2: #edeae2;
  --ink: #1d1d1b;
  --ink-soft: #56544e;
  --ink-mute: #8c887f;
  --line: #e1ddd3;
  --line-strong: #d2cdc1;
  --accent: #26594a;
  --on-cover: #f7f5ef;
  --cover-scrim: rgba(18, 21, 19, 0.72);
  --font-ui: "MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei UI", "Microsoft YaHei", system-ui, sans-serif;
  --font-book: "Source Han Serif SC", "Noto Serif SC", "Songti SC", SimSun, "Times New Roman", serif;
}
@media (prefers-color-scheme: dark) {
  :root {
    --paper: #121311;
    --surface: #1a1b18;
    --surface-2: #23251f;
    --ink: #eceae3;
    --ink-soft: #b5b1a7;
    --ink-mute: #827f77;
    --line: #2c2e28;
    --line-strong: #3a3c35;
    --accent: #9bc5ae;
    --on-cover: #f7f5ef;
    --cover-scrim: rgba(18, 21, 19, 0.72);
  }
}
* { box-sizing: border-box; }
html { scroll-behavior: smooth; background: var(--paper); }
body {
  margin: 0;
  background: var(--paper);
  color: var(--ink);
  font-family: var(--font-ui);
  line-height: 1.7;
  -webkit-font-smoothing: antialiased;
  text-rendering: optimizeLegibility;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
.skip {
  position: absolute;
  left: 16px;
  top: -64px;
  padding: 10px 16px;
  border-radius: 999px;
  background: var(--surface);
  border: 1px solid var(--line-strong);
  z-index: 2;
}
.skip:focus { top: 16px; }
.shell { max-width: 960px; margin: 0 auto; padding: 40px 24px 72px; }
.hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) 244px;
  gap: 48px;
  align-items: center;
  padding: 44px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 36px;
}
.eyebrow {
  margin: 0;
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.22em;
  color: var(--ink-mute);
}
.hero h1 {
  margin: 12px 0 0;
  font-family: var(--font-book);
  font-size: clamp(2.1rem, 5vw, 3rem);
  font-weight: 600;
  line-height: 1.24;
  letter-spacing: -0.01em;
}
.subtitle { margin: 12px 0 0; font-size: 16px; color: var(--ink-soft); }
.meta { margin: 18px 0 0; font-size: 12px; color: var(--ink-mute); }
.meta span + span::before { content: " · "; }
.blurb {
  margin: 22px 0 0;
  padding-top: 18px;
  border-top: 1px solid var(--line);
  max-width: 48ch;
  font-size: 13px;
  line-height: 1.9;
  color: var(--ink-soft);
  white-space: pre-line;
}
.notice { margin: 14px 0 0; font-size: 10px; line-height: 1.8; color: var(--ink-mute); }
.cover {
  position: relative;
  aspect-ratio: 4 / 5;
  width: 100%;
  overflow: hidden;
  border-radius: 20px;
  background: var(--accent);
  color: var(--on-cover);
  border: 1px solid var(--line-strong);
  box-shadow: 0 22px 48px -36px rgba(18, 21, 19, 0.6);
}
.cover img { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
.cover-band {
  position: absolute;
  inset: auto 0 0;
  padding: 16px 18px;
  background: var(--cover-scrim);
}
.cover-flat { display: flex; flex-direction: column; justify-content: space-between; padding: 18px; }
.cover-kicker { margin: 0; font-size: 9px; font-weight: 600; letter-spacing: 0.24em; opacity: 0.7; }
.cover-title { margin: 0; font-family: var(--font-book); font-size: 21px; font-weight: 600; line-height: 1.4; }
.cover-author { margin: 6px 0 0; font-size: 10px; opacity: 0.78; }
.cover-image .cover-title { font-size: 16px; }
.cover-image .cover-author { font-size: 9px; }
.toc {
  margin-top: 24px;
  padding: 30px 32px;
  background: var(--surface);
  border: 1px solid var(--line);
  border-radius: 28px;
}
.toc-head { display: flex; flex-wrap: wrap; align-items: flex-end; justify-content: space-between; gap: 12px; }
.toc h2 { margin: 6px 0 0; font-family: var(--font-book); font-size: 24px; font-weight: 600; }
.toc-meta { margin: 0; font-size: 11px; color: var(--ink-mute); }
.toc-volumes { margin: 20px 0 0; padding: 0; list-style: none; }
.toc-volumes > li { padding: 16px 0; border-top: 1px solid var(--line); }
.toc-volumes > li:first-child { border-top: 0; padding-top: 6px; }
.toc-volume { font-family: var(--font-book); font-size: 16px; font-weight: 600; }
.toc-chapters { margin: 8px 0 0; padding: 0; list-style: none; }
.toc-chapters li a {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 16px;
  padding: 7px 0;
  font-size: 12px;
  color: var(--ink-soft);
}
.toc-chapters li a:hover { color: var(--accent); text-decoration: none; }
.toc-count { flex: none; font-size: 10px; color: var(--ink-mute); font-variant-numeric: tabular-nums; }
main { margin-top: 56px; }
.volume + .volume { margin-top: 72px; padding-top: 64px; border-top: 1px solid var(--line); }
.volume-head { padding-bottom: 22px; border-bottom: 1px solid var(--line); }
.volume-head h2 { margin: 8px 0 0; font-family: var(--font-book); font-size: 30px; font-weight: 600; line-height: 1.35; }
.volume-summary { margin: 12px 0 0; max-width: 60ch; font-size: 13px; line-height: 1.9; color: var(--ink-soft); }
.chapter { margin-top: 44px; }
.chapter-head { display: flex; flex-wrap: wrap; align-items: baseline; justify-content: space-between; gap: 8px 20px; margin-bottom: 22px; }
.chapter-head h3 { margin: 0; font-family: var(--font-book); font-size: 23px; font-weight: 600; line-height: 1.4; }
.chapter-meta { margin: 0; font-size: 10px; color: var(--ink-mute); font-variant-numeric: tabular-nums; }
.prose p {
  margin: 0 0 0.8em;
  font-family: var(--font-book);
  font-size: 17.5px;
  line-height: 1.95;
  text-align: justify;
  text-indent: 2em;
  overflow-wrap: break-word;
}
.prose p.empty { text-align: center; text-indent: 0; color: var(--ink-mute); }
.illustration { margin: 30px 0; text-align: center; break-inside: avoid; }
.illustration img {
  display: block;
  width: auto;
  max-width: 100%;
  max-height: 60vh;
  height: auto;
  margin: 0 auto;
  border: 1px solid var(--line);
  border-radius: 14px;
  background: var(--surface-2);
}
.illustration figcaption { margin-top: 10px; font-size: 12px; line-height: 1.7; color: var(--ink-mute); }
.back-link { margin: 26px 0 0; font-size: 11px; }
.footer {
  margin-top: 72px;
  padding-top: 24px;
  border-top: 1px solid var(--line);
  font-size: 10px;
  line-height: 1.9;
  color: var(--ink-mute);
}
.footer p { margin: 0; }
@media (max-width: 720px) {
  .shell { padding: 20px 16px 56px; }
  .hero { grid-template-columns: 1fr; gap: 26px; padding: 24px; border-radius: 28px; }
  .cover { order: -1; width: 180px; margin: 0 auto; }
  .toc { padding: 22px 20px; border-radius: 24px; }
  .volume-head h2 { font-size: 26px; }
  .chapter-head h3 { font-size: 20px; }
  .prose p { font-size: 17px; }
}
@media print {
  @page { margin: 18mm 16mm; }
  html, body { background: #ffffff; color: #000000; }
  .shell { max-width: none; padding: 0; }
  .skip, .toc, .back-link { display: none; }
  .hero { grid-template-columns: 1fr 200px; gap: 28px; padding: 0; border: 0; break-after: page; }
  .hero h1 { font-size: 30pt; }
  .cover { box-shadow: none; }
  main { margin-top: 0; }
  .volume { break-before: page; }
  .volume + .volume { margin-top: 0; padding-top: 0; border-top: 0; }
  .chapter { break-inside: auto; }
  .illustration, .illustration img { break-inside: avoid; }
  .prose p { font-size: 11.5pt; line-height: 1.9; }
  .footer { border-top: 0; }
}
`;

export function buildWebPage(archive: WorkArchive): string {
  const volumes = renderChapters(archive);
  const chapterCount = volumes.reduce((sum, volume) => sum + volume.chapters.length, 0);
  const totalWords = volumes.reduce(
    (sum, volume) =>
      sum + volume.chapters.reduce((chapterSum, chapter) => chapterSum + chapter.wordCount, 0),
    0,
  );
  const { title, subtitle, description, genre, status, authorName } = archive.work;
  const exportedDay = archive.exportedAt.slice(0, 10);
  const subtitleHtml = subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : "";
  const blurbHtml = description
    ? `<p class="blurb">${escapeHtml(description)}</p>`
    : "";
  const descriptionMeta = escapeHtml(description.replace(/\s+/g, " ").slice(0, 160));

  return `<!doctype html>
<html lang="zh-CN">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="generator" content="墨坞 Inkdock">
<meta name="description" content="${descriptionMeta}">
<title>《${escapeHtml(title)}》 · ${escapeHtml(authorName)}</title>
<style>${STYLE}</style>
</head>
<body>
<a class="skip" href="#content">跳到正文</a>
<div class="shell">
  <header class="hero">
    <div>
      <p class="eyebrow">INKDOCK · 网页版</p>
      <h1>${escapeHtml(title)}</h1>
      ${subtitleHtml}
      <p class="meta"><span>${escapeHtml(authorName)}</span><span>${escapeHtml(genre)}</span><span>${STATUS_LABEL[status]}</span></p>
      <p class="meta"><span>${formatNumber(totalWords)} 字</span><span>${chapterCount} 章</span><span>${volumes.length} 卷</span></p>
      ${blurbHtml}
      <p class="notice">离线单文件网页，封面与插画已内嵌。正文为纯文本排版，不含故事设定与写作数据。</p>
    </div>
    ${coverHtml(archive)}
  </header>
  ${tocHtml(volumes)}
  <main id="content">
${volumes.map((volume, index) => volumeHtml(volume, index)).join("\n")}
  </main>
  <footer class="footer">
    <p>《${escapeHtml(title)}》 · ${escapeHtml(authorName)}</p>
    <p>由墨坞 Inkdock 导出于 ${exportedDay}。本页面不依赖网络，可直接分享或打印。</p>
  </footer>
</div>
</body>
</html>
`;
}
