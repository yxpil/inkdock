// Author: yxpil

export type PlatformId = "qidian" | "fanqie" | "jjwxc" | "weread" | "qimao";
export type ReaderThemeId = "day" | "paper" | "green" | "night";
export type ReaderFontId = "serif" | "sans" | "kai";
export type ReaderMargin = "narrow" | "standard" | "wide";
export type PageTurnMode = "slide" | "none";
export type ReaderChrome = "book" | "chapter" | "minimal";
export type ReaderFooter = "progress" | "next" | "comment" | "percent" | "nextLarge";

export interface ReaderPrefs {
  fontSize: number;
  lineHeight: number;
  margin: ReaderMargin;
  font: ReaderFontId;
  theme: ReaderThemeId;
  pageTurn: PageTurnMode;
}

export interface PlatformPreset {
  id: PlatformId;
  name: string;
  shortName: string;
  accent: string;
  accentSoft: string;
  chrome: ReaderChrome;
  footer: ReaderFooter;
  defaultPrefs: ReaderPrefs;
}

export const READER_THEMES: Record<
  ReaderThemeId,
  {
    name: string;
    bg: string;
    text: string;
    muted: string;
    line: string;
    soft: string;
    bar: "dark" | "light";
  }
> = {
  day: {
    name: "日间",
    bg: "#FFFFFF",
    text: "#1F1F1F",
    muted: "#8A8A8A",
    line: "#EFEFEF",
    soft: "#F5F5F5",
    bar: "dark",
  },
  paper: {
    name: "纸张",
    bg: "#F4EBDC",
    text: "#3B3228",
    muted: "#8E8170",
    line: "#E3D8C5",
    soft: "#EDE2D0",
    bar: "dark",
  },
  green: {
    name: "护眼",
    bg: "#E9F0E4",
    text: "#263326",
    muted: "#71806F",
    line: "#D9E3D3",
    soft: "#DFE9D9",
    bar: "dark",
  },
  night: {
    name: "夜间",
    bg: "#161616",
    text: "#B9B6AE",
    muted: "#6E6C66",
    line: "#2A2A2A",
    soft: "#202020",
    bar: "light",
  },
};

export const FONT_STACKS: Record<ReaderFontId, string> = {
  serif:
    '"Source Han Serif SC", "Noto Serif SC", "Songti SC", SimSun, "Times New Roman", serif',
  sans: '"MiSans", "HarmonyOS Sans SC", "PingFang SC", "Microsoft YaHei", system-ui, sans-serif',
  kai: '"Kaiti SC", KaiTi, STKaiti, "Songti SC", serif',
};

export const FONT_LABELS: Record<ReaderFontId, string> = {
  serif: "宋体",
  sans: "黑体",
  kai: "楷体",
};

export const MARGIN_PIXELS: Record<ReaderMargin, number> = {
  narrow: 18,
  standard: 22,
  wide: 28,
};

export const MARGIN_LABELS: Record<ReaderMargin, string> = {
  narrow: "窄",
  standard: "标准",
  wide: "宽",
};

const BASE_PREFS: ReaderPrefs = {
  fontSize: 18,
  lineHeight: 1.9,
  margin: "standard",
  font: "serif",
  theme: "day",
  pageTurn: "slide",
};

export const PLATFORMS: PlatformPreset[] = [
  {
    id: "qidian",
    name: "起点读书",
    shortName: "起点",
    accent: "#C6472E",
    accentSoft: "#F7E5E0",
    chrome: "book",
    footer: "progress",
    defaultPrefs: { ...BASE_PREFS, font: "serif", fontSize: 18, lineHeight: 1.9, theme: "day" },
  },
  {
    id: "fanqie",
    name: "番茄小说",
    shortName: "番茄",
    accent: "#E85D2A",
    accentSoft: "#FBE8DE",
    chrome: "book",
    footer: "next",
    defaultPrefs: {
      ...BASE_PREFS,
      font: "sans",
      fontSize: 18,
      lineHeight: 1.9,
      theme: "paper",
    },
  },
  {
    id: "jjwxc",
    name: "晋江文学城",
    shortName: "晋江",
    accent: "#3E7A52",
    accentSoft: "#E4EEE6",
    chrome: "chapter",
    footer: "comment",
    defaultPrefs: {
      ...BASE_PREFS,
      font: "serif",
      fontSize: 17,
      lineHeight: 1.95,
      margin: "wide",
      theme: "green",
    },
  },
  {
    id: "weread",
    name: "微信读书",
    shortName: "微信",
    accent: "#2F6BEA",
    accentSoft: "#E4ECFB",
    chrome: "minimal",
    footer: "percent",
    defaultPrefs: {
      ...BASE_PREFS,
      font: "sans",
      fontSize: 17,
      lineHeight: 1.85,
      margin: "wide",
      theme: "day",
    },
  },
  {
    id: "qimao",
    name: "七猫小说",
    shortName: "七猫",
    accent: "#D99A16",
    accentSoft: "#F9EFD8",
    chrome: "book",
    footer: "nextLarge",
    defaultPrefs: {
      ...BASE_PREFS,
      font: "sans",
      fontSize: 19,
      lineHeight: 1.95,
      theme: "paper",
    },
  },
];

export function getPlatform(id: string | null | undefined): PlatformPreset {
  return PLATFORMS.find((platform) => platform.id === id) ?? PLATFORMS[0];
}

export function clampPrefs(prefs: ReaderPrefs): ReaderPrefs {
  return {
    fontSize: Math.min(26, Math.max(15, Math.round(prefs.fontSize))),
    lineHeight: Math.min(2.2, Math.max(1.6, Math.round(prefs.lineHeight * 100) / 100)),
    margin: ["narrow", "standard", "wide"].includes(prefs.margin)
      ? prefs.margin
      : "standard",
    font: ["serif", "sans", "kai"].includes(prefs.font) ? prefs.font : "serif",
    theme: ["day", "paper", "green", "night"].includes(prefs.theme) ? prefs.theme : "day",
    pageTurn: prefs.pageTurn === "none" ? "none" : "slide",
  };
}

export function readerPrefsKey(platformId: PlatformId): string {
  return `ink:reader:${platformId}`;
}
