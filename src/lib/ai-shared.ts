// Author: yxpil

export type AiAction = "continue" | "polish" | "title" | "outline";

export const AI_ACTIONS: Array<{ id: AiAction; label: string; hint: string }> = [
  { id: "continue", label: "续写", hint: "延续当前段落，给出约 300 字" },
  { id: "polish", label: "润色", hint: "保留原意，修改当前章节末尾" },
  { id: "title", label: "起名", hint: "给本章五个标题候选" },
  { id: "outline", label: "大纲", hint: "提炼本章剧情要点与下一步" },
];
