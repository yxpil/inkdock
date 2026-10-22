// Author: yxpil

"use client";

import { Loader2 } from "lucide-react";
import { Modal } from "@/components/ui/modal";
import { capsule } from "@/components/ui/button";

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "确认",
  pending = false,
  danger = true,
  onConfirm,
  onClose,
}: {
  open: boolean;
  title: string;
  description: string;
  confirmLabel?: string;
  pending?: boolean;
  danger?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title={title}
      description={description}
      width="sm"
      footer={
        <>
          <button type="button" className={capsule("ghost", "md")} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={capsule(danger ? "danger" : "primary", "md", "min-w-[96px]")}
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? <Loader2 size={14} className="animate-spin-slow" /> : null}
            {confirmLabel}
          </button>
        </>
      }
    >
      <div className="rounded-3xl bg-surface-2 px-4 py-3 text-[13px] leading-6 text-ink-soft">
        此操作会立即生效。如果你还需要这份内容，请先取消。
      </div>
    </Modal>
  );
}
