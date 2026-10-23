// Author: yxpil

import Link from "next/link";
import { BrandLockup } from "@/components/brand";
import { capsule } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6 text-center">
      <BrandLockup />
      <p className="mt-10 font-mono text-[11px] tracking-[0.3em] text-ink-mute">404</p>
      <h1 className="mt-3 font-serif text-3xl font-semibold tracking-[-0.01em]">
        这一页没有落笔
      </h1>
      <p className="mt-3 max-w-sm text-[13px] leading-6 text-ink-soft">
        地址可能写错了，或者这本作品不在你的书架里。
      </p>
      <Link href="/library" className={capsule("primary", "lg", "mt-7")}>
        返回书架
      </Link>
    </main>
  );
}
