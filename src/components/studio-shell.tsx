// Author: yxpil

"use client";

import { useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Database, Library, Loader2, LogOut, Plus, Settings } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { BrandLockup, BrandMark } from "@/components/brand";
import { ThemeToggle } from "@/components/ui/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { cn, initialOf } from "@/lib/utils";
import type { User } from "@/lib/types";

const NAV: Array<{ href: string; label: string; icon: LucideIcon }> = [
  { href: "/library", label: "书架", icon: Library },
  { href: "/settings", label: "设置", icon: Settings },
];

function navIsActive(pathname: string, href: string): boolean {
  if (href === "/library") return pathname === "/library" || pathname === "/";
  return pathname.startsWith(href);
}

function breadcrumbFor(pathname: string): string {
  if (pathname.startsWith("/works/")) return "作品";
  if (pathname.startsWith("/settings")) return "设置";
  return "书架";
}

export function StudioShell({
  user,
  children,
}: {
  user: User;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();
  const [loggingOut, setLoggingOut] = useState(false);
  const crumb = breadcrumbFor(pathname);

  const logout = async () => {
    if (loggingOut) return;
    setLoggingOut(true);
    try {
      await apiFetch("/api/auth/logout", { method: "POST" });
      router.replace("/login");
      router.refresh();
    } catch (error) {
      setLoggingOut(false);
      toast(error instanceof Error ? error.message : "退出登录失败", "danger");
    }
  };

  return (
    <div className="min-h-dvh">
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-[248px] flex-col border-r border-line bg-paper px-4 py-5 lg:flex">
        <Link href="/library" className="px-2" aria-label="返回书架">
          <BrandLockup />
        </Link>

        <nav className="mt-9 flex flex-col gap-1" aria-label="主导航">
          <span className="mb-1.5 px-3 text-[10px] font-medium tracking-[0.16em] text-ink-mute">
            工作台
          </span>
          {NAV.map((item) => {
            const active = navIsActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "flex h-11 items-center gap-3 rounded-full px-3.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-accent-soft text-accent"
                    : "text-ink-soft hover:bg-surface-2 hover:text-ink",
                )}
              >
                <Icon size={18} strokeWidth={1.75} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto flex flex-col gap-4 px-3 pb-1">
          <p className="font-serif text-[13px] leading-6 text-ink-mute">先写完，再写好。</p>
          <div className="flex items-center gap-2 text-[11px] text-ink-mute">
            <Database size={13} strokeWidth={1.75} />
            数据保存在本机 SQLite
          </div>
        </div>
      </aside>

      <div className="lg:pl-[248px]">
        <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b border-line bg-paper px-5 sm:px-7 lg:px-10">
          <div className="flex min-w-0 items-center gap-3">
            <Link href="/library" className="lg:hidden" aria-label="返回书架">
              <BrandMark size="sm" />
            </Link>
            <div className="hidden items-center gap-2 text-[13px] text-ink-mute sm:flex">
              <span>工作台</span>
              <span className="text-line-strong">/</span>
              <span className="font-medium text-ink">{crumb}</span>
            </div>
            <span className="text-sm font-medium sm:hidden">{crumb}</span>
          </div>

          <div className="flex items-center gap-1.5">
            <span className="mr-1 hidden items-center gap-1.5 rounded-full border border-line px-3 py-1.5 text-[11px] text-ink-mute md:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-accent" aria-hidden="true" />
              本机账号
            </span>
            <ThemeToggle />
            <Link
              href="/settings"
              className="ml-1 flex items-center gap-2 rounded-full py-1 pl-1 pr-1 text-sm font-medium text-ink transition-colors hover:bg-surface-2 sm:pr-3"
              aria-label="打开设置"
            >
              <span
                className="flex h-8 w-8 items-center justify-center rounded-full text-[13px] font-semibold text-on-cover"
                style={{ backgroundColor: user.avatarColor }}
              >
                {initialOf(user.name)}
              </span>
              <span className="hidden max-w-24 truncate sm:inline">{user.name}</span>
            </Link>
            <button
              type="button"
              onClick={() => void logout()}
              disabled={loggingOut}
              className="icon-capsule h-9 w-9"
              aria-label="退出登录"
              title="退出登录"
            >
              {loggingOut ? (
                <Loader2 size={15} className="animate-spin-slow" />
              ) : (
                <LogOut size={15} />
              )}
            </button>
          </div>
        </header>

        <main className="mx-auto w-full max-w-[1440px] px-5 pb-28 pt-7 sm:px-7 lg:px-10 lg:pb-16 lg:pt-9">
          {children}
        </main>
      </div>

      <nav
        className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-1 rounded-full border border-line bg-surface p-1.5 shadow-float lg:hidden"
        aria-label="移动端导航"
      >
        <Link
          href="/library"
          aria-current={navIsActive(pathname, "/library") ? "page" : undefined}
          className={cn(
            "flex h-11 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium",
            navIsActive(pathname, "/library")
              ? "bg-accent-soft text-accent"
              : "text-ink-mute",
          )}
        >
          <Library size={18} strokeWidth={1.75} />
          书架
        </Link>
        <Link
          href="/library?new=1"
          aria-label="新建作品"
          className="mx-1 flex h-11 w-11 items-center justify-center rounded-full bg-accent text-on-accent transition-transform active:scale-95"
        >
          <Plus size={20} strokeWidth={2} />
        </Link>
        <Link
          href="/settings"
          aria-current={navIsActive(pathname, "/settings") ? "page" : undefined}
          className={cn(
            "flex h-11 min-w-[72px] flex-col items-center justify-center gap-0.5 rounded-full text-[10px] font-medium",
            navIsActive(pathname, "/settings")
              ? "bg-accent-soft text-accent"
              : "text-ink-mute",
          )}
        >
          <Settings size={18} strokeWidth={1.75} />
          设置
        </Link>
      </nav>
    </div>
  );
}
