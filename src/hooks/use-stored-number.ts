// Author: yxpil

"use client";

import { useEffect, useState } from "react";

export function useStoredNumber(key: string, fallback: number): number {
  const [value, setValue] = useState(fallback);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      const parsed = raw ? Number(raw) : NaN;
      if (Number.isFinite(parsed) && parsed > 0) setValue(parsed);
    } catch {
      // Ignore storage errors; the fallback keeps the UI usable.
    }
  }, [key, fallback]);

  return value;
}
