// Author: yxpil

import { cn } from "@/lib/utils";

const COVER_FOREGROUND = "var(--on-cover)";
const IMAGE_BAND = "var(--cover-scrim)";

export function BookCover({
  title,
  author,
  genre,
  color,
  image,
  size = "md",
  className,
}: {
  title: string;
  author?: string;
  genre?: string;
  color: string;
  image?: string | null;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  const titleSize =
    size === "lg" ? "text-2xl sm:text-3xl" : size === "sm" ? "text-base" : "text-lg";
  const padding = size === "lg" ? "p-6" : size === "sm" ? "p-3" : "p-4";

  if (image) {
    return (
      <div
        className={cn(
          "cover-shadow relative aspect-[4/5] w-full overflow-hidden rounded-[20px]",
          className,
        )}
        style={{ backgroundColor: color, color: COVER_FOREGROUND }}
        aria-hidden="true"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={image}
          alt=""
          className="absolute inset-0 h-full w-full object-cover"
        />
        <div
          className="absolute inset-x-2.5 bottom-2.5 rounded-[12px] px-3 py-2.5"
          style={{ backgroundColor: IMAGE_BAND }}
        >
          <span className="block text-[8px] font-medium tracking-[0.2em] opacity-70">
            {genre || "长篇小说"}
          </span>
          <span
            className={cn(
              "mt-1 block font-serif font-semibold leading-[1.35] tracking-[0.01em] line-clamp-2",
              size === "lg" ? "text-xl sm:text-2xl" : size === "sm" ? "text-[13px]" : "text-[15px]",
            )}
          >
            {title}
          </span>
          {author ? (
            <span className="mt-1.5 block truncate text-[9px] tracking-[0.08em] opacity-75">
              {author}
            </span>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        "cover-shadow relative aspect-[4/5] w-full overflow-hidden rounded-[20px]",
        className,
      )}
      style={{ backgroundColor: color, color: COVER_FOREGROUND }}
      aria-hidden="true"
    >
      <div className="absolute inset-2.5 rounded-[14px] border border-current opacity-20" />
      <div className="absolute -right-10 -top-12 h-36 w-36 rounded-full border border-current opacity-20" />
      <div className="absolute -right-3 -top-6 h-24 w-24 rounded-full border border-current opacity-10" />
      <div
        className="absolute bottom-0 left-4 top-0 w-px opacity-15"
        style={{ backgroundColor: COVER_FOREGROUND }}
      />
      <div className={cn("relative flex h-full flex-col", padding)}>
        <span className="text-[9px] font-medium tracking-[0.22em] opacity-60">
          {genre || "长篇小说"}
        </span>
        <span
          className={cn(
            "mt-auto font-serif font-semibold leading-[1.35] tracking-[0.01em] line-clamp-4",
            titleSize,
          )}
        >
          {title}
        </span>
        <div className="mt-3 flex items-center gap-2">
          <span className="h-px w-5 bg-current opacity-40" />
          <span className="text-[9px] tracking-[0.08em] opacity-70">{author}</span>
        </div>
      </div>
    </div>
  );
}
