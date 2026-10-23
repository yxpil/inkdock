// Author: yxpil

"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  Database,
  Info,
  Loader2,
  LockKeyhole,
  Monitor,
  Moon,
  Palette,
  PenLine,
  Sparkles,
  Sun,
  Type,
  UserRound,
  type LucideIcon,
} from "lucide-react";
import type { User } from "@/lib/types";
import {
  DAILY_GOAL_KEY,
  DEFAULT_DAILY_GOAL,
  EDITOR_FONT_KEY,
} from "@/lib/constants";
import {
  applyTheme,
  getStoredTheme,
  type ThemePreference,
} from "@/lib/theme";
import { apiFetch } from "@/lib/api-client";
import { capsule } from "@/components/ui/button";
import { useToast } from "@/components/ui/toast";
import { cn, formatNumber, initialOf } from "@/lib/utils";

type EditorFont = "serif" | "sans";

const THEME_OPTIONS: Array<{
  value: ThemePreference;
  label: string;
  hint: string;
  icon: LucideIcon;
}> = [
  { value: "light", label: "浅色", hint: "暖纸底色", icon: Sun },
  { value: "dark", label: "深色", hint: "夜间低亮度", icon: Moon },
  { value: "system", label: "跟随系统", hint: "随系统切换", icon: Monitor },
];

const GOAL_PRESETS = [1000, 2000, 3000, 5000];

export function SettingsView({
  user,
  ai,
}: {
  user: User;
  ai: { configured: boolean; model: string | null };
}) {
  const router = useRouter();
  const { toast } = useToast();

  const [theme, setTheme] = useState<ThemePreference>("system");
  const [name, setName] = useState(user.name);
  const [savingName, setSavingName] = useState(false);
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [savingPassword, setSavingPassword] = useState(false);
  const [goal, setGoal] = useState(String(DEFAULT_DAILY_GOAL));
  const [savedGoal, setSavedGoal] = useState(DEFAULT_DAILY_GOAL);
  const [editorFont, setEditorFont] = useState<EditorFont>("serif");

  useEffect(() => {
    setTheme(getStoredTheme());
    try {
      setEditorFont(
        window.localStorage.getItem(EDITOR_FONT_KEY) === "sans" ? "sans" : "serif",
      );
      const storedGoal = Number(window.localStorage.getItem(DAILY_GOAL_KEY));
      if (Number.isInteger(storedGoal) && storedGoal > 0) {
        setGoal(String(storedGoal));
        setSavedGoal(storedGoal);
      }
    } catch {
      // Defaults keep the page usable when storage is unavailable.
    }
  }, []);

  useEffect(() => {
    if (theme !== "system") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => applyTheme("system");
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, [theme]);

  const chooseTheme = (value: ThemePreference) => {
    applyTheme(value);
    setTheme(value);
  };

  const trimmedName = name.trim();
  const nameDirty = trimmedName.length > 0 && trimmedName !== user.name;
  const goalNumber = Number(goal);
  const goalValid =
    Number.isInteger(goalNumber) && goalNumber >= 100 && goalNumber <= 100_000;
  const goalDirty = goalValid && goalNumber !== savedGoal;

  const saveName = async () => {
    if (!nameDirty || savingName) return;
    setSavingName(true);
    try {
      await apiFetch("/api/me", {
        method: "PATCH",
        body: JSON.stringify({ name: trimmedName }),
      });
      toast("笔名已更新");
      router.refresh();
    } catch (error) {
      toast(error instanceof Error ? error.message : "保存笔名失败", "danger");
    } finally {
      setSavingName(false);
    }
  };

  const updatePassword = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (savingPassword) return;
    if (!currentPassword) {
      toast("请输入当前密码", "danger");
      return;
    }
    if (newPassword.length < 8) {
      toast("新密码至少需要 8 位", "danger");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast("两次输入的新密码不一致", "danger");
      return;
    }
    if (newPassword === currentPassword) {
      toast("新密码不能与当前密码相同", "danger");
      return;
    }

    setSavingPassword(true);
    try {
      await apiFetch("/api/auth/password", {
        method: "POST",
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      toast("密码已更新，其他会话已退出");
    } catch (error) {
      toast(error instanceof Error ? error.message : "修改密码失败", "danger");
    } finally {
      setSavingPassword(false);
    }
  };

  const saveGoal = (value = goalNumber) => {
    if (!Number.isInteger(value) || value < 100 || value > 100_000) {
      toast("每日目标需在 100 到 100000 字之间", "danger");
      return;
    }
    try {
      window.localStorage.setItem(DAILY_GOAL_KEY, String(value));
      setGoal(String(value));
      setSavedGoal(value);
      toast("每日目标已保存");
    } catch {
      toast("无法写入本机存储", "danger");
    }
  };

  const chooseFont = (font: EditorFont) => {
    setEditorFont(font);
    try {
      window.localStorage.setItem(EDITOR_FONT_KEY, font);
      toast("编辑器正文字体已更新");
    } catch {
      toast("无法写入本机存储", "danger");
    }
  };

  return (
    <div className="mx-auto w-full max-w-[1040px]">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-[10px] font-medium tracking-[0.18em] text-ink-mute">
            SETTINGS
          </p>
          <h1 className="mt-1 font-serif text-[28px] font-semibold tracking-[-0.01em] sm:text-[34px]">
            工作台设置
          </h1>
          <p className="mt-2 max-w-xl text-[12px] leading-6 text-ink-soft sm:text-[13px]">
            账号、外观与写作偏好。账号与作品保存在本机 SQLite，浏览器偏好不会上传。
          </p>
        </div>
        <span className="chip">多账号与协作</span>
      </div>

      <div className="mt-6 grid gap-5 lg:grid-cols-[minmax(0,1fr)_330px]">
        <div className="space-y-5">
          <section className="card p-5 sm:p-6" aria-labelledby="appearance-title">
            <SectionHeader
              icon={Palette}
              title="外观"
              description="工作台主题。手机预览使用独立深色舞台，不跟随此项。"
              id="appearance-title"
            />
            <div className="mt-5 grid gap-2 sm:grid-cols-3">
              {THEME_OPTIONS.map((option) => {
                const Icon = option.icon;
                const active = theme === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => chooseTheme(option.value)}
                    aria-pressed={active}
                    className={cn(
                      "flex items-center gap-2.5 rounded-2xl border p-3 text-left transition-colors",
                      active
                        ? "border-accent bg-accent-soft"
                        : "border-line bg-surface hover:bg-surface-2",
                    )}
                  >
                    <Icon
                      size={16}
                      className={active ? "flex-none text-accent" : "flex-none text-ink-mute"}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="block text-[12px] font-medium">
                        {option.label}
                      </span>
                      <span className="mt-0.5 block text-[10px] text-ink-mute">
                        {option.hint}
                      </span>
                    </span>
                    {active ? <Check size={14} className="flex-none text-accent" /> : null}
                  </button>
                );
              })}
            </div>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="profile-title">
            <SectionHeader
              icon={UserRound}
              title="作者资料"
              description="笔名会出现在作品详情、导出文件与手机预览中。"
              id="profile-title"
            />
            <div className="mt-5">
              <label htmlFor="pen-name" className="field-label">
                笔名
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className="flex h-11 w-11 flex-none items-center justify-center rounded-full text-sm font-semibold text-on-cover"
                  style={{ backgroundColor: user.avatarColor }}
                  aria-hidden="true"
                >
                  {initialOf(trimmedName || user.name)}
                </span>
                <input
                  id="pen-name"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={24}
                  placeholder="输入笔名"
                  className="field-input min-w-0 flex-1"
                />
                <button
                  type="button"
                  onClick={() => void saveName()}
                  disabled={!nameDirty || savingName}
                  className={capsule("primary", "md", "flex-none")}
                >
                  {savingName ? <Loader2 size={14} className="animate-spin-slow" /> : null}
                  保存笔名
                </button>
              </div>
              <p className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-ink-mute">
                <span>账号 {user.handle}</span>
                <span className="h-1 w-1 rounded-full bg-line-strong" aria-hidden="true" />
                <span>本机账号，密码经加盐哈希保存</span>
              </p>
            </div>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="security-title">
            <SectionHeader
              icon={LockKeyhole}
              title="账号安全"
              description="修改密码后，其他浏览器需要重新登录。"
              id="security-title"
            />
            <form className="mt-5 grid gap-4 sm:grid-cols-3" onSubmit={updatePassword}>
              <div>
                <label htmlFor="current-password" className="field-label">
                  当前密码
                </label>
                <input
                  id="current-password"
                  type="password"
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  maxLength={128}
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="new-password" className="field-label">
                  新密码
                </label>
                <input
                  id="new-password"
                  type="password"
                  value={newPassword}
                  onChange={(event) => setNewPassword(event.target.value)}
                  autoComplete="new-password"
                  minLength={8}
                  maxLength={128}
                  placeholder="至少 8 位"
                  className="field-input"
                />
              </div>
              <div>
                <label htmlFor="confirm-password" className="field-label">
                  确认新密码
                </label>
                <input
                  id="confirm-password"
                  type="password"
                  value={confirmPassword}
                  onChange={(event) => setConfirmPassword(event.target.value)}
                  autoComplete="new-password"
                  maxLength={128}
                  placeholder="再输入一次"
                  className="field-input"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 sm:col-span-3">
                <p className="text-[10px] leading-5 text-ink-mute">
                  账号 {user.handle} · 密码只以加盐哈希保存在本机。
                </p>
                <button
                  type="submit"
                  disabled={savingPassword}
                  className={capsule("primary", "md", "flex-none")}
                >
                  {savingPassword ? <Loader2 size={14} className="animate-spin-slow" /> : null}
                  更新密码
                </button>
              </div>
            </form>
          </section>

          <section className="card p-5 sm:p-6" aria-labelledby="writing-title">
            <SectionHeader
              icon={PenLine}
              title="写作偏好"
              description="每日目标与编辑器正文字体，均保存在浏览器本机。"
              id="writing-title"
            />

            <div className="mt-5">
              <label htmlFor="daily-goal" className="field-label">
                每日目标
              </label>
              <div className="flex flex-wrap items-center gap-2">
                <div className="relative w-40">
                  <input
                    id="daily-goal"
                    type="number"
                    min={100}
                    max={100_000}
                    step={100}
                    value={goal}
                    onChange={(event) => setGoal(event.target.value)}
                    className="field-input pr-12 tabular-nums"
                  />
                  <span className="pointer-events-none absolute right-4 top-1/2 -translate-y-1/2 text-[11px] text-ink-mute">
                    字 / 日
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => saveGoal()}
                  disabled={!goalDirty}
                  className={capsule("secondary", "md")}
                >
                  保存目标
                </button>
              </div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {GOAL_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => saveGoal(preset)}
                    aria-pressed={savedGoal === preset}
                    className={cn(
                      "h-7 rounded-full px-3 text-[10px] font-medium tabular-nums transition-colors",
                      savedGoal === preset
                        ? "bg-accent-soft text-accent"
                        : "bg-surface-2 text-ink-mute hover:bg-surface-3 hover:text-ink",
                    )}
                  >
                    {formatNumber(preset)} 字
                  </button>
                ))}
              </div>
              <p className="mt-2 text-[10px] leading-5 text-ink-mute">
                当前目标 {formatNumber(savedGoal)} 字。书架与编辑器的今日进度会读取这个值，范围 100 到 100000。
              </p>
            </div>

            <div className="my-5 h-px bg-line" />

            <div>
              <span className="field-label">编辑器正文字体</span>
              <div className="grid gap-2 sm:grid-cols-2">
                {(
                  [
                    {
                      id: "serif",
                      label: "宋体",
                      hint: "衬线字，适合长篇与纸面阅读",
                      style: { fontFamily: "var(--font-book)" },
                    },
                    {
                      id: "sans",
                      label: "黑体",
                      hint: "与界面同源，屏幕阅读更直接",
                      style: { fontFamily: "var(--font-ui)" },
                    },
                  ] as const
                ).map((option) => {
                  const active = editorFont === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => chooseFont(option.id)}
                      aria-pressed={active}
                      className={cn(
                        "rounded-2xl border p-3 text-left transition-colors",
                        active
                          ? "border-accent bg-accent-soft"
                          : "border-line bg-surface hover:bg-surface-2",
                      )}
                    >
                      <span className="flex items-center justify-between gap-2">
                        <span className="text-[12px] font-medium">{option.label}</span>
                        {active ? <Check size={14} className="text-accent" /> : null}
                      </span>
                      <span
                        className="mt-2 block text-[17px] leading-7"
                        style={option.style}
                      >
                        海雾漫过码头。
                      </span>
                      <span className="mt-1 block text-[10px] text-ink-mute">
                        {option.hint}
                      </span>
                    </button>
                  );
                })}
              </div>
              <p className="mt-3 flex items-center gap-1.5 text-[10px] text-ink-mute">
                <Type size={11} />
                字号与行高可在编辑器右侧面板调整。
              </p>
            </div>
          </section>
        </div>

        <aside className="space-y-5">
          <section className="card p-5" aria-labelledby="ai-title">
            <SectionHeader
              icon={Sparkles}
              title="AI 助手"
              description="OpenAI 兼容接口，经服务端代理调用。"
              id="ai-title"
            />
            <div className="mt-4 flex items-center justify-between gap-2">
              <span className={ai.configured ? "chip chip-accent" : "chip"}>
                {ai.configured ? "已连接" : "未配置"}
              </span>
              {ai.model ? (
                <span className="max-w-40 truncate font-mono text-[10px] text-ink-mute" title={ai.model}>
                  {ai.model}
                </span>
              ) : null}
            </div>
            {ai.configured ? (
              <p className="mt-3 text-[11px] leading-5 text-ink-soft">
                AI 建议只会出现在编辑器侧栏，需要你手动插入。密钥只保存在服务端环境变量中。
              </p>
            ) : (
              <div className="mt-3 rounded-2xl bg-surface-2 p-3.5">
                <p className="text-[11px] leading-5 text-ink-soft">
                  编辑器仍可正常写作与保存。要启用续写、润色、起名与大纲，请在 .env.local 中配置：
                </p>
                <ul className="mt-2.5 space-y-1 border-t border-line pt-2.5 font-mono text-[10px] text-ink-mute">
                  <li>AI_BASE_URL</li>
                  <li>AI_API_KEY</li>
                  <li>AI_MODEL</li>
                </ul>
                <p className="mt-2 text-[10px] leading-5 text-ink-mute">
                  修改后重启开发服务器，再回到此页查看状态。
                </p>
              </div>
            )}
          </section>

          <section className="card p-5" aria-labelledby="data-title">
            <SectionHeader
              icon={Database}
              title="数据"
              description="作品保存在本机 SQLite，不经过云端。"
              id="data-title"
            />
            <div className="mt-4 rounded-2xl bg-surface-2 px-3.5 py-3">
              <p className="text-[10px] text-ink-mute">数据库文件</p>
              <p className="mt-1 break-all font-mono text-[11px] text-ink-soft">
                data/inkdock.db
              </p>
            </div>
            <ul className="mt-3 space-y-2 text-[10px] leading-5 text-ink-mute">
              <li>可用环境变量 INK_DB_PATH 指向其他位置。</li>
              <li>备份前请先停止开发服务器，再复制数据库文件。</li>
              <li>整书 JSON 在作品页导出，可在书架导入为新的作品。</li>
              <li>纯文本 TXT 与 Markdown 导出不包含设定与插画。</li>
            </ul>
          </section>

          <section className="card p-5" aria-labelledby="about-title">
            <SectionHeader
              icon={Info}
              title="关于"
              description="本地优先的小说创作工作台。"
              id="about-title"
            />
            <dl className="mt-4 space-y-2.5 text-[11px]">
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-mute">产品</dt>
                <dd className="text-ink-soft">墨坞 INKDOCK</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-mute">版本</dt>
                <dd className="font-mono text-[10px] text-ink-soft">0.2.0 · 多账号</dd>
              </div>
              <div className="flex items-center justify-between gap-3">
                <dt className="text-ink-mute">数据</dt>
                <dd className="text-ink-soft">本机 SQLite</dd>
              </div>
            </dl>
            <p className="mt-4 border-t border-line pt-3 text-[10px] leading-5 text-ink-mute">
              评论与实时协作属于后续里程碑。当前版本提供本机账号、作品成员角色与整书迁移。
            </p>
          </section>
        </aside>
      </div>
    </div>
  );
}

function SectionHeader({
  icon: Icon,
  title,
  description,
  id,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  id: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className="flex h-9 w-9 flex-none items-center justify-center rounded-full bg-surface-2 text-ink-soft">
        <Icon size={16} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <h2 id={id} className="text-sm font-semibold">
          {title}
        </h2>
        <p className="mt-0.5 text-[11px] leading-5 text-ink-mute">{description}</p>
      </div>
    </div>
  );
}
