// Author: yxpil

"use client";

import { useEffect, useRef, useState } from "react";
import {
  Check,
  Copy,
  CornerDownLeft,
  Loader2,
  Sparkles,
} from "lucide-react";
import { AI_ACTIONS, type AiAction } from "@/lib/ai-shared";
import { apiFetch } from "@/lib/api-client";
import { capsule } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function AiPanel({
  configured,
  model,
  workTitle,
  genre,
  chapterTitle,
  content,
  onInsert,
}: {
  configured: boolean;
  model: string | null;
  workTitle: string;
  genre: string;
  chapterTitle: string;
  content: string;
  onInsert: (text: string) => void;
}) {
  const [action, setAction] = useState<AiAction>("continue");
  const [instruction, setInstruction] = useState("");
  const [output, setOutput] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [copied, setCopied] = useState(false);
  const copiedTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
    };
  }, []);

  const selected = AI_ACTIONS.find((item) => item.id === action) ?? AI_ACTIONS[0];

  const generate = async () => {
    if (pending) return;
    setPending(true);
    setError(null);
    setCopied(false);
    try {
      const data = await apiFetch<{ text: string }>("/api/ai/assist", {
        method: "POST",
        body: JSON.stringify({
          action,
          instruction,
          workTitle,
          genre,
          chapterTitle,
          content,
        }),
      });
      setOutput(data.text);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "生成失败，请稍后重试");
    } finally {
      setPending(false);
    }
  };

  const copy = async () => {
    if (!output) return;
    try {
      await navigator.clipboard.writeText(output);
      setCopied(true);
      if (copiedTimer.current) clearTimeout(copiedTimer.current);
      copiedTimer.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("无法访问剪贴板，请手动选择文本复制。");
    }
  };

  return (
    <section aria-labelledby="ai-panel-title">
      <div className="flex items-center justify-between gap-2">
        <h2 id="ai-panel-title" className="flex items-center gap-2 text-sm font-semibold">
          <Sparkles size={15} className="text-accent" aria-hidden="true" />
          AI 助手
        </h2>
        {configured ? (
          <span className="chip chip-accent max-w-32 truncate" title={model ?? undefined}>
            {model || "已连接"}
          </span>
        ) : (
          <span className="chip">未连接</span>
        )}
      </div>
      <p className="mt-1 text-[11px] leading-5 text-ink-mute">
        服务端代理调用，密钥不会进入浏览器。
      </p>

      {!configured ? (
        <div className="mt-3 rounded-3xl bg-surface-2 p-4">
          <p className="text-[12px] leading-6 text-ink-soft">
            尚未配置 AI 服务。编辑器不会伪造生成结果，写作、保存与预览不受影响。
          </p>
          <ul className="mt-3 space-y-1.5 border-t border-line pt-3 font-mono text-[10px] text-ink-mute">
            <li>AI_BASE_URL</li>
            <li>AI_API_KEY</li>
            <li>AI_MODEL</li>
          </ul>
          <p className="mt-3 text-[10px] leading-5 text-ink-mute">
            在项目根目录的 .env.local 中填写后重启开发服务器，设置页会显示连接状态。
          </p>
        </div>
      ) : (
        <>
          <div className="mt-3 grid grid-cols-4 gap-1">
            {AI_ACTIONS.map((item) => (
              <button
                key={item.id}
                type="button"
                onClick={() => setAction(item.id)}
                aria-pressed={action === item.id}
                className={cn(
                  "h-8 rounded-full text-[11px] font-medium transition-colors",
                  action === item.id
                    ? "bg-accent text-on-accent"
                    : "bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-ink",
                )}
              >
                {item.label}
              </button>
            ))}
          </div>
          <p className="mt-2 text-[10px] leading-5 text-ink-mute">{selected.hint}</p>

          <textarea
            value={instruction}
            onChange={(event) => setInstruction(event.target.value)}
            placeholder="补充要求，例如：保持第一人称，不要引入新角色"
            aria-label="补充要求"
            rows={2}
            maxLength={500}
            className="mt-3 w-full resize-none rounded-2xl border border-transparent bg-surface-2 px-3.5 py-2.5 text-[12px] leading-5 text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent focus:bg-surface"
          />

          <button
            type="button"
            onClick={generate}
            disabled={pending}
            className={capsule("primary", "md", "mt-2 w-full")}
          >
            {pending ? (
              <Loader2 size={14} className="animate-spin-slow" />
            ) : (
              <Sparkles size={14} />
            )}
            {pending ? "正在生成" : `生成${selected.label}建议`}
          </button>

          {error ? (
            <p className="mt-2 rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[11px] leading-5 text-danger">
              {error}
            </p>
          ) : null}

          {output ? (
            <div className="animate-fade-in mt-3">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-medium tracking-[0.08em] text-ink-mute">
                  建议草稿
                </span>
                <button
                  type="button"
                  onClick={copy}
                  className="inline-flex h-7 items-center gap-1 rounded-full px-2 text-[10px] font-medium text-ink-mute transition-colors hover:bg-surface-2 hover:text-ink"
                >
                  {copied ? <Check size={12} /> : <Copy size={12} />}
                  {copied ? "已复制" : "复制"}
                </button>
              </div>
              <div className="mt-2 max-h-72 overflow-y-auto whitespace-pre-wrap break-words rounded-2xl border border-line bg-surface-2 px-3.5 py-3 text-[12px] leading-6 text-ink-soft">
                {output}
              </div>
              <button
                type="button"
                onClick={() => onInsert(output)}
                className={capsule("secondary", "sm", "mt-2 w-full")}
              >
                <CornerDownLeft size={13} />
                插入到光标处
              </button>
              <p className="mt-2 text-[10px] leading-5 text-ink-mute">
                建议不会自动写入。插入后由你判断，保存仍走正常自动保存流程。
              </p>
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
