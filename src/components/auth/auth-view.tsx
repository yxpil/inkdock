// Author: yxpil

"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, LockKeyhole, UserRound } from "lucide-react";
import { BrandLockup } from "@/components/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { capsule } from "@/components/ui/button";
import { apiFetch } from "@/lib/api-client";
import { cn } from "@/lib/utils";

type AuthMode = "login" | "register";

const HANDLE_PATTERN = /^[a-z0-9_]{3,24}$/;

export function AuthView({ hasAccounts }: { hasAccounts: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<AuthMode>(hasAccounts ? "login" : "register");
  const [handle, setHandle] = useState("");
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  const switchMode = (next: AuthMode) => {
    setMode(next);
    setError("");
    setPassword("");
    setConfirm("");
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (pending) return;

    const normalizedHandle = handle.trim().replace(/^@/, "").toLowerCase();
    if (!HANDLE_PATTERN.test(normalizedHandle)) {
      setError("账号需为 3-24 位小写字母、数字或下划线");
      return;
    }
    if (password.length < 8) {
      setError("密码至少需要 8 位");
      return;
    }
    if (mode === "register" && password !== confirm) {
      setError("两次输入的密码不一致");
      return;
    }

    setPending(true);
    setError("");
    try {
      await apiFetch(
        mode === "login" ? "/api/auth/login" : "/api/auth/register",
        {
          method: "POST",
          body: JSON.stringify(
            mode === "login"
              ? { handle: normalizedHandle, password }
              : { handle: normalizedHandle, password, name: name.trim() },
          ),
        },
      );
      router.replace("/library");
      router.refresh();
    } catch (submitError) {
      setError(
        submitError instanceof Error ? submitError.message : "操作失败，请稍后重试",
      );
      setPending(false);
    }
  };

  return (
    <div className="flex min-h-dvh flex-col">
      <header className="flex items-center justify-between px-5 py-5 sm:px-8">
        <BrandLockup />
        <ThemeToggle />
      </header>

      <main className="mx-auto flex w-full max-w-[1080px] flex-1 items-center px-5 pb-10 pt-2 sm:px-8">
        <div className="grid w-full gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:items-center lg:gap-12">
          <section className="relative hidden overflow-hidden rounded-[34px] bg-accent px-10 py-14 text-on-accent lg:block">
            <div
              className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full border border-on-accent/15"
              aria-hidden="true"
            />
            <div
              className="pointer-events-none absolute -bottom-24 -left-12 h-64 w-64 rounded-full border border-on-accent/10"
              aria-hidden="true"
            />
            <p className="text-[10px] font-medium tracking-[0.24em] text-on-accent/60">
              INKDOCK WORKSPACE
            </p>
            <h1 className="mt-5 max-w-md font-serif text-[38px] font-semibold leading-[1.3] tracking-[-0.01em]">
              把故事留在
              <br />
              自己的坞里。
            </h1>
            <p className="mt-5 max-w-sm text-[13px] leading-7 text-on-accent/70">
              本机多账号与作品协作。作者与读者都可注册；每位成员拥有独立书架，按角色分享同一部作品，可直接导出网页、TXT 或 JSON。
            </p>
            <dl className="mt-10 grid grid-cols-3 gap-4 border-t border-on-accent/15 pt-6 text-[11px] text-on-accent/70">
              <div>
                <dt className="text-on-accent/50">数据</dt>
                <dd className="mt-1 text-on-accent">本机 SQLite</dd>
              </div>
              <div>
                <dt className="text-on-accent/50">角色</dt>
                <dd className="mt-1 text-on-accent">四级权限</dd>
              </div>
              <div>
                <dt className="text-on-accent/50">导出</dt>
                <dd className="mt-1 text-on-accent">网页 / JSON</dd>
              </div>
            </dl>
          </section>

          <section className="card mx-auto w-full max-w-[420px] p-6 sm:p-8">
            <p className="text-[10px] font-medium tracking-[0.18em] text-ink-mute">
              ACCOUNT
            </p>
            <h2 className="mt-1.5 font-serif text-[26px] font-semibold tracking-[-0.01em]">
              {mode === "login" ? "回到工作台" : "创建本机账号"}
            </h2>
            <p className="mt-2 text-[12px] leading-6 text-ink-soft">
              {mode === "login"
                ? "用账号和密码进入你的书架。"
                : hasAccounts
                  ? "作者与读者都可注册。账号用于区分书架与作品权限，不会上传。"
                  : "首次使用。创建后，本机已有的示例作品会归入该账号。"}
            </p>

            <div className="segmented mt-6 w-full" role="tablist" aria-label="登录或注册">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "login"}
                data-active={mode === "login"}
                className="segmented-item flex-1"
                onClick={() => switchMode("login")}
              >
                登录
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "register"}
                data-active={mode === "register"}
                className="segmented-item flex-1"
                onClick={() => switchMode("register")}
              >
                注册
              </button>
            </div>

            {mode === "register" ? (
              <p className="mt-3 rounded-2xl bg-surface-2 px-3.5 py-2.5 text-[10px] leading-5 text-ink-mute">
                注册后既可以开始写作，也可以等待作品所有者按账号邀请，成为只读读者。
              </p>
            ) : null}

            <form className="mt-6 space-y-4" onSubmit={submit}>
              <div>
                <label htmlFor="auth-handle" className="field-label">
                  账号
                </label>
                <div className="relative">
                  <UserRound
                    size={15}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute"
                  />
                  <input
                    id="auth-handle"
                    value={handle}
                    onChange={(event) => setHandle(event.target.value)}
                    autoComplete="username"
                    autoCapitalize="none"
                    spellCheck={false}
                    maxLength={24}
                    placeholder="例如 shenyan"
                    className="field-input pl-10"
                  />
                </div>
                <p className="mt-1.5 text-[10px] text-ink-mute">
                  3-24 位小写字母、数字或下划线。
                </p>
              </div>

              {mode === "register" ? (
                <div>
                  <label htmlFor="auth-name" className="field-label">
                    笔名 <span className="font-normal text-ink-mute">可选</span>
                  </label>
                  <input
                    id="auth-name"
                    value={name}
                    onChange={(event) => setName(event.target.value)}
                    autoComplete="nickname"
                    maxLength={24}
                    placeholder="留空则使用账号名"
                    className="field-input"
                  />
                </div>
              ) : null}

              <div>
                <label htmlFor="auth-password" className="field-label">
                  密码
                </label>
                <div className="relative">
                  <LockKeyhole
                    size={15}
                    className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-ink-mute"
                  />
                  <input
                    id="auth-password"
                    type="password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    autoComplete={mode === "login" ? "current-password" : "new-password"}
                    maxLength={128}
                    placeholder="至少 8 位"
                    className="field-input pl-10"
                  />
                </div>
              </div>

              {mode === "register" ? (
                <div>
                  <label htmlFor="auth-confirm" className="field-label">
                    确认密码
                  </label>
                  <input
                    id="auth-confirm"
                    type="password"
                    value={confirm}
                    onChange={(event) => setConfirm(event.target.value)}
                    autoComplete="new-password"
                    maxLength={128}
                    placeholder="再输入一次"
                    className="field-input"
                  />
                </div>
              ) : null}

              {error ? (
                <p
                  role="alert"
                  className="rounded-2xl bg-danger-soft px-3.5 py-2.5 text-[11px] leading-5 text-danger"
                >
                  {error}
                </p>
              ) : null}

              <button
                type="submit"
                className={cn(capsule("primary", "lg"), "w-full")}
                disabled={pending}
              >
                {pending ? <Loader2 size={15} className="animate-spin-slow" /> : null}
                {mode === "login" ? "进入工作台" : "创建并进入"}
              </button>
            </form>

            <p className="mt-5 border-t border-line pt-4 text-[10px] leading-5 text-ink-mute">
              密码经 scrypt 加盐后保存在本机数据库。忘记密码需要直接操作 SQLite，暂不提供找回。
            </p>
          </section>
        </div>
      </main>
    </div>
  );
}
