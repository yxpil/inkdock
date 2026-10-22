// Author: yxpil

export type WorkStatus = "serializing" | "completed" | "paused";
export type ChapterStatus = "draft" | "ready" | "published";
export type StoryEntityType =
  | "character"
  | "organization"
  | "location"
  | "item"
  | "concept";

export interface User {
  id: string;
  name: string;
  handle: string;
  avatarColor: string;
  createdAt: string;
}

export interface ChapterMeta {
  id: string;
  workId: string;
  volumeId: string;
  title: string;
  status: ChapterStatus;
  sort: number;
  wordCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface ChapterFull extends ChapterMeta {
  content: string;
}

export interface VolumeSummary {
  id: string;
  workId: string;
  title: string;
  summary: string;
  sort: number;
}

export interface VolumeWithChapters extends VolumeSummary {
  chapters: ChapterMeta[];
  totalWords: number;
}

export interface WorkSummary {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  genre: string;
  status: WorkStatus;
  coverColor: string;
  coverImage: string | null;
  targetWords: number;
  createdAt: string;
  updatedAt: string;
  authorName: string;
  totalWords: number;
  chapterCount: number;
  volumeCount: number;
  lastChapterId: string | null;
  lastChapterTitle: string | null;
  lastChapterVolumeId: string | null;
}

export interface WorkDetail extends WorkSummary {
  author: User;
  volumes: VolumeWithChapters[];
}

export interface EditorWork {
  id: string;
  title: string;
  genre: string;
  status: WorkStatus;
  coverColor: string;
  coverImage: string | null;
  targetWords: number;
  totalWords: number;
  chapterCount: number;
  volumeCount: number;
  updatedAt: string;
}

export interface StoryEntity {
  id: string;
  workId: string;
  type: StoryEntityType;
  name: string;
  subtitle: string;
  summary: string;
  description: string;
  color: string;
  sort: number;
  createdAt: string;
  updatedAt: string;
}

export interface EditorBundle {
  user: User;
  work: EditorWork;
  volumes: VolumeSummary[];
  chapters: ChapterMeta[];
  chapter: ChapterFull;
  dailyWords: number;
  storyEntities: StoryEntity[];
}

export interface LibraryStats {
  todayWords: number;
  totalWords: number;
  activeWorks: number;
  chapterCount: number;
}

export interface ContinueReading {
  chapterId: string;
  chapterTitle: string;
  workId: string;
  workTitle: string;
  volumeTitle: string;
  snippet: string;
  updatedAt: string;
}

export interface LibraryData {
  user: User;
  works: WorkSummary[];
  stats: LibraryStats;
  recent: ContinueReading | null;
}

export interface ReaderChapter {
  id: string;
  workId: string;
  volumeId: string;
  title: string;
  content: string;
  wordCount: number;
  sort: number;
  volumeTitle: string;
}

export interface ReaderWork {
  id: string;
  title: string;
  subtitle: string;
  genre: string;
  status: WorkStatus;
  authorName: string;
  totalWords: number;
  chapters: ReaderChapter[];
}

export interface RevisionMeta {
  id: string;
  chapterId: string;
  wordCount: number;
  reason: string;
  createdAt: string;
  preview: string;
}

export interface SaveChapterResult {
  chapter: {
    id: string;
    updatedAt: string;
    wordCount: number;
  };
  revisionCreated: boolean;
}
