// Author: yxpil

import type { ChapterStatus, StoryEntityType, WorkStatus } from "./types";

export const SITE_NAME = "墨坞";
export const SITE_NAME_EN = "INKDOCK";
export const SITE_TAGLINE = "小说创作与协作工作台";

export const WORK_STATUS_LABEL: Record<WorkStatus, string> = {
  serializing: "连载中",
  completed: "已完结",
  paused: "暂停更新",
};

export const CHAPTER_STATUS_LABEL: Record<ChapterStatus, string> = {
  draft: "草稿",
  ready: "待发布",
  published: "已发布",
};

export const WORK_STATUSES: WorkStatus[] = ["serializing", "completed", "paused"];
export const CHAPTER_STATUSES: ChapterStatus[] = ["draft", "ready", "published"];

export const GENRES = ["悬疑", "奇幻", "科幻", "言情", "现实", "历史", "武侠", "其他"] as const;

export const COVER_COLORS = [
  { name: "松墨", value: "#2F4B46" },
  { name: "赭石", value: "#A9543C" },
  { name: "玄青", value: "#31445C" },
  { name: "藕荷", value: "#876A6A" },
  { name: "墨黑", value: "#2A2A28" },
  { name: "秋沙", value: "#A58A62" },
] as const;

export const DEFAULT_COVER_COLOR = COVER_COLORS[0].value;
export const DEFAULT_DAILY_GOAL = 2000;

export const STORY_ENTITY_TYPES: StoryEntityType[] = [
  "character",
  "organization",
  "location",
  "item",
  "concept",
];

export const STORY_ENTITY_TYPE_LABEL: Record<StoryEntityType, string> = {
  character: "角色",
  organization: "组织",
  location: "地点",
  item: "物品",
  concept: "设定",
};

export const STORY_ENTITY_TYPE_HINT: Record<StoryEntityType, string> = {
  character: "人物档案与关系",
  organization: "势力、团体与门派",
  location: "场景、城市与地理",
  item: "线索、道具与遗物",
  concept: "世界观、规则与术语",
};

export const STORY_ENTITY_COLORS = [
  { name: "苔青", value: "#3D6B5A" },
  { name: "赭红", value: "#A9543C" },
  { name: "靛蓝", value: "#405A78" },
  { name: "紫檀", value: "#77565F" },
  { name: "岩灰", value: "#5E615C" },
  { name: "麦金", value: "#9A7B45" },
] as const;

export const DEFAULT_STORY_ENTITY_COLOR = STORY_ENTITY_COLORS[0].value;

export const COVER_PATTERNS = ["circle", "line", "square", "none"] as const;
export type CoverPattern = (typeof COVER_PATTERNS)[number];

export const DAILY_GOAL_KEY = "ink:daily-goal";
export const EDITOR_FONT_KEY = "ink:editor-font";
export const EDITOR_SIZE_KEY = "ink:editor-size";
export const THEME_KEY = "ink:theme";
