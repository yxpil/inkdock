// Author: yxpil

"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { ChapterStatus } from "@/lib/types";

export type SaveState =
  | "saved"
  | "dirty"
  | "saving"
  | "retrying"
  | "offline"
  | "conflict";

export interface AutosaveConflict {
  remoteUpdatedAt: string;
  remoteWordCount: number;
}

export interface RecoverableDraft {
  title: string;
  content: string;
  status: ChapterStatus;
  savedLocallyAt: string;
}

interface SavePayload {
  title: string;
  content: string;
  status: ChapterStatus;
}

interface SaveResponse {
  ok?: boolean;
  error?: string;
  chapter?: { id: string; updatedAt: string; wordCount: number };
  current?: { updatedAt?: string; wordCount?: number };
}

interface UseAutosaveOptions {
  chapterId: string;
  initial: SavePayload & { updatedAt: string };
  title: string;
  content: string;
  status: ChapterStatus;
}

const DRAFT_PREFIX = "ink:draft:";
const DEBOUNCE_MS = 900;
const MAX_WAIT_MS = 20_000;

function samePayload(a: SavePayload, b: SavePayload): boolean {
  return a.title === b.title && a.content === b.content && a.status === b.status;
}

export function useAutosave({
  chapterId,
  initial,
  title,
  content,
  status,
}: UseAutosaveOptions) {
  const draftKey = `${DRAFT_PREFIX}${chapterId}`;
  const latestRef = useRef<SavePayload>({ title, content, status });
  const lastSavedRef = useRef<SavePayload>({
    title: initial.title,
    content: initial.content,
    status: initial.status,
  });
  const baseRef = useRef(initial.updatedAt);
  const conflictRef = useRef<AutosaveConflict | null>(null);
  const queueRef = useRef<Promise<boolean>>(Promise.resolve(true));
  const enqueueRef = useRef<(mode: "auto" | "force") => Promise<boolean>>(
    async () => false,
  );
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const maxTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const retryAttemptRef = useRef(0);
  const mountedRef = useRef(true);

  const [saveState, setSaveState] = useState<SaveState>("saved");
  const [savedAt, setSavedAt] = useState(initial.updatedAt);
  const [conflict, setConflict] = useState<AutosaveConflict | null>(null);
  const [recoverable, setRecoverable] = useState<RecoverableDraft | null>(null);

  latestRef.current = { title, content, status };

  const isDirty = (): boolean => !samePayload(latestRef.current, lastSavedRef.current);

  const writeDraft = () => {
    try {
      window.localStorage.setItem(
        draftKey,
        JSON.stringify({
          ...latestRef.current,
          baseUpdatedAt: baseRef.current,
          savedLocallyAt: new Date().toISOString(),
        }),
      );
    } catch {
      // The server save remains the primary path if localStorage is unavailable.
    }
  };

  const clearDraft = () => {
    try {
      window.localStorage.removeItem(draftKey);
    } catch {
      // Ignore quota or privacy mode failures.
    }
  };

  const performSave = useCallback(
    async (mode: "auto" | "force"): Promise<boolean> => {
      if (conflictRef.current && mode !== "force") {
        setSaveState("conflict");
        return false;
      }
      if (!isDirty()) {
        if (!conflictRef.current) setSaveState("saved");
        return true;
      }
      if (typeof navigator !== "undefined" && !navigator.onLine) {
        setSaveState("offline");
        return false;
      }

      const payload = latestRef.current;
      const baseUpdatedAt =
        mode === "force"
          ? (conflictRef.current?.remoteUpdatedAt ?? baseRef.current)
          : baseRef.current;
      setSaveState("saving");

      try {
        const response = await fetch(`/api/chapters/${chapterId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...payload, baseUpdatedAt }),
        });
        const data = (await response.json().catch(() => null)) as SaveResponse | null;

        if (response.status === 409) {
          const info: AutosaveConflict = {
            remoteUpdatedAt: data?.current?.updatedAt ?? new Date().toISOString(),
            remoteWordCount: data?.current?.wordCount ?? 0,
          };
          conflictRef.current = info;
          if (mountedRef.current) {
            setConflict(info);
            setSaveState("conflict");
          }
          return false;
        }

        if (!response.ok || !data?.ok || !data.chapter) {
          throw new Error(data?.error || "保存失败");
        }

        baseRef.current = data.chapter.updatedAt;
        lastSavedRef.current = payload;
        conflictRef.current = null;
        retryAttemptRef.current = 0;
        if (retryTimerRef.current) {
          clearTimeout(retryTimerRef.current);
          retryTimerRef.current = null;
        }
        if (!mountedRef.current) return true;

        setSavedAt(data.chapter.updatedAt);
        setConflict(null);

        const stillDirty = isDirty();
        if (stillDirty) {
          setSaveState("dirty");
        } else {
          clearDraft();
          setSaveState("saved");
        }
        return true;
      } catch {
        if (!mountedRef.current) return false;
        const online = typeof navigator === "undefined" || navigator.onLine;
        setSaveState(online ? "retrying" : "offline");
        if (online) {
          retryAttemptRef.current += 1;
          if (!retryTimerRef.current) {
            const delay = Math.min(
              30_000,
              6_000 * 2 ** Math.min(retryAttemptRef.current - 1, 2),
            );
            retryTimerRef.current = setTimeout(() => {
              retryTimerRef.current = null;
              if (!conflictRef.current) void enqueueRef.current("auto");
            }, delay);
          }
        }
        return false;
      }
    },
    [chapterId],
  );

  const enqueueSave = useCallback(
    (mode: "auto" | "force"): Promise<boolean> => {
      const next = queueRef.current
        .catch(() => false)
        .then(() => performSave(mode));
      queueRef.current = next;
      return next;
    },
    [performSave],
  );

  enqueueRef.current = enqueueSave;

  useEffect(() => {
    const draftRaw = window.localStorage.getItem(draftKey);
    if (!draftRaw) return;
    try {
      const draft = JSON.parse(draftRaw) as Partial<RecoverableDraft>;
      const hasContent = typeof draft.content === "string";
      if (
        hasContent &&
        (draft.content !== initial.content ||
          draft.title !== initial.title ||
          draft.status !== initial.status)
      ) {
        setRecoverable({
          title: typeof draft.title === "string" ? draft.title : initial.title,
          content: draft.content ?? "",
          status:
            draft.status === "ready" || draft.status === "published"
              ? draft.status
              : "draft",
          savedLocallyAt:
            typeof draft.savedLocallyAt === "string"
              ? draft.savedLocallyAt
              : new Date().toISOString(),
        });
      } else {
        clearDraft();
      }
    } catch {
      clearDraft();
    }
    // Recovery only needs to run once per editor mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const dirty = isDirty();
    if (!dirty) return;

    writeDraft();
    if (conflictRef.current) return;

    setSaveState((previous) => {
      if (previous === "conflict") return previous;
      if (previous === "saving") return previous;
      return typeof navigator !== "undefined" && !navigator.onLine ? "offline" : "dirty";
    });

    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      debounceRef.current = null;
      void enqueueRef.current("auto");
    }, DEBOUNCE_MS);

    if (!maxTimerRef.current) {
      maxTimerRef.current = setTimeout(() => {
        maxTimerRef.current = null;
        void enqueueRef.current("auto");
      }, MAX_WAIT_MS);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [title, content, status]);

  useEffect(() => {
    mountedRef.current = true;

    const handlePageHide = () => {
      if (!isDirty()) return;
      writeDraft();
      try {
        const blob = new Blob([JSON.stringify(latestRef.current)], {
          type: "application/json",
        });
        if (blob.size <= 60_000) {
          navigator.sendBeacon(`/api/chapters/${chapterId}/autosave`, blob);
        }
      } catch {
        // The local draft is enough when beacon payloads are rejected.
      }
    };

    const handleVisibility = () => {
      if (document.visibilityState === "hidden" && isDirty() && navigator.onLine) {
        void enqueueRef.current("auto");
      }
    };

    const handleOffline = () => {
      if (isDirty()) setSaveState("offline");
    };

    const handleOnline = () => {
      if (isDirty() && !conflictRef.current) {
        setSaveState("dirty");
        void enqueueRef.current("auto");
      }
    };

    window.addEventListener("pagehide", handlePageHide);
    document.addEventListener("visibilitychange", handleVisibility);
    window.addEventListener("offline", handleOffline);
    window.addEventListener("online", handleOnline);

    return () => {
      mountedRef.current = false;
      window.removeEventListener("pagehide", handlePageHide);
      document.removeEventListener("visibilitychange", handleVisibility);
      window.removeEventListener("offline", handleOffline);
      window.removeEventListener("online", handleOnline);
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (maxTimerRef.current) clearTimeout(maxTimerRef.current);
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, [chapterId]);

  const flush = useCallback(async (): Promise<boolean> => {
    await queueRef.current.catch(() => false);
    if (conflictRef.current) return false;
    if (!isDirty()) return true;
    return enqueueSave("auto");
  }, [enqueueSave]);

  const forceSave = useCallback(async (): Promise<boolean> => {
    await queueRef.current.catch(() => false);
    return enqueueSave("force");
  }, [enqueueSave]);

  const dismissRecovery = useCallback(() => {
    clearDraft();
    setRecoverable(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return {
    saveState,
    savedAt,
    conflict,
    recoverable,
    flush,
    forceSave,
    dismissRecovery,
  };
}
