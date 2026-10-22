// Author: yxpil

"use client";

import { useEffect, useState } from "react";
import { Moon, Sun } from "lucide-react";
import { applyTheme, getStoredTheme, resolveTheme, type ResolvedTheme } from "@/lib/theme";

export function ThemeToggle() {
  const [mounted, setMounted] = useState(false);
  const [resolved, setResolved] = useState<ResolvedTheme>("light");

  useEffect(() => {
    setMounted(true);
    setResolved(resolveTheme(getStoredTheme()));

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const handleChange = () => {
      const preference = getStoredTheme();
      if (preference === "system") {
        setResolved(media.matches ? "dark" : "light");
        applyTheme("system");
      }
    };
    media.addEventListener("change", handleChange);
    return () => media.removeEventListener("change", handleChange);
  }, []);

  const toggle = () => {
    const next = resolved === "dark" ? "light" : "dark";
    applyTheme(next);
    setResolved(next);
  };

  return (
    <button
      type="button"
      className="icon-capsule"
      onClick={toggle}
      aria-label={resolved === "dark" ? "切换到浅色模式" : "切换到深色模式"}
      title={resolved === "dark" ? "切换到浅色模式" : "切换到深色模式"}
    >
      {mounted && resolved === "dark" ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
