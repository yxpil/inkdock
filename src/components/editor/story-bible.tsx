// Author: yxpil

"use client";

import { useEffect, useMemo, useState, type Dispatch, type SetStateAction } from "react";
import {
  ArrowLeft,
  BookMarked,
  Building2,
  Check,
  Loader2,
  MapPin,
  Package,
  Pencil,
  Plus,
  Search,
  Sparkles,
  Trash2,
  UserRound,
  X,
} from "lucide-react";
import type { StoryEntity, StoryEntityType } from "@/lib/types";
import {
  DEFAULT_STORY_ENTITY_COLOR,
  STORY_ENTITY_COLORS,
  STORY_ENTITY_TYPES,
  STORY_ENTITY_TYPE_HINT,
  STORY_ENTITY_TYPE_LABEL,
} from "@/lib/constants";
import { capsule } from "@/components/ui/button";
import { ConfirmDialog } from "@/components/ui/confirm-dialog";
import { Modal } from "@/components/ui/modal";
import { useToast } from "@/components/ui/toast";
import { apiFetch } from "@/lib/api-client";
import { cn, formatDateTime, initialOf } from "@/lib/utils";

const TYPE_ICON = {
  character: UserRound,
  organization: Building2,
  location: MapPin,
  item: Package,
  concept: Sparkles,
} satisfies Record<StoryEntityType, typeof UserRound>;

type Filter = "all" | StoryEntityType;

const FILTERS: Array<{ value: Filter; label: string }> = [
  { value: "all", label: "全部" },
  ...STORY_ENTITY_TYPES.map((type) => ({
    value: type,
    label: STORY_ENTITY_TYPE_LABEL[type],
  })),
];

export function StoryBiblePanel({
  workId,
  entities,
  onEntitiesChange,
  onClose,
}: {
  workId: string;
  entities: StoryEntity[];
  onEntitiesChange: Dispatch<SetStateAction<StoryEntity[]>>;
  onClose?: () => void;
}) {
  const { toast } = useToast();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<StoryEntity | "create" | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<StoryEntity | null>(null);
  const [deleting, setDeleting] = useState(false);

  const selected = selectedId
    ? entities.find((entity) => entity.id === selectedId) ?? null
    : null;

  const counts = useMemo(() => {
    const map = new Map<StoryEntityType, number>();
    for (const entity of entities) {
      map.set(entity.type, (map.get(entity.type) ?? 0) + 1);
    }
    return map;
  }, [entities]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return entities.filter((entity) => {
      if (filter !== "all" && entity.type !== filter) return false;
      if (!needle) return true;
      return [entity.name, entity.subtitle, entity.summary, entity.description]
        .join("\n")
        .toLowerCase()
        .includes(needle);
    });
  }, [entities, filter, query]);

  const handleSaved = (entity: StoryEntity) => {
    onEntitiesChange((current) => {
      const index = current.findIndex((item) => item.id === entity.id);
      if (index === -1) return [...current, entity];
      const next = [...current];
      next[index] = entity;
      return next;
    });
    setEditing(null);
    setSelectedId(entity.id);
    toast(editing === "create" ? "设定已建立" : "设定已更新");
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await apiFetch(`/api/story-entities/${deleteTarget.id}`, { method: "DELETE" });
      onEntitiesChange((current) => current.filter((item) => item.id !== deleteTarget.id));
      if (selectedId === deleteTarget.id) setSelectedId(null);
      setDeleteTarget(null);
      toast("设定已删除");
    } catch (error) {
      toast(error instanceof Error ? error.message : "删除失败", "danger");
    } finally {
      setDeleting(false);
    }
  };

  const resetFilters = () => {
    setFilter("all");
    setQuery("");
  };

  return (
    <div className="space-y-4 p-4" data-story-bible={workId}>
      <header className="sticky top-0 z-10 -mx-4 -mt-4 border-b border-line bg-paper px-4 py-3">
        <div className="flex items-center justify-between gap-2">
          {selected ? (
            <button
              type="button"
              onClick={() => setSelectedId(null)}
              className="inline-flex h-8 items-center gap-1.5 rounded-full pl-1.5 pr-2.5 text-[12px] font-medium text-ink-soft transition-colors hover:bg-surface-2 hover:text-ink"
            >
              <ArrowLeft size={15} />
              返回列表
            </button>
          ) : (
            <div className="min-w-0">
              <h2 className="flex items-center gap-2 text-sm font-semibold">
                <BookMarked size={15} className="text-ink-mute" aria-hidden="true" />
                故事设定
              </h2>
              <p className="mt-0.5 text-[10px] text-ink-mute">
                {entities.length > 0
                  ? `${entities.length} 条 · 只属于这本书`
                  : "角色、组织与世界的备忘"}
              </p>
            </div>
          )}
          <div className="flex flex-none items-center gap-1">
            {!selected ? (
              <button
                type="button"
                className={capsule("secondary", "sm", "h-8 px-2.5")}
                onClick={() => setEditing("create")}
              >
                <Plus size={13} />
                新建
              </button>
            ) : (
              <button
                type="button"
                className="inline-flex h-8 items-center gap-1.5 rounded-full bg-surface-2 px-3 text-[11px] font-medium text-ink-soft transition-colors hover:bg-surface-3 hover:text-ink"
                onClick={() => setEditing(selected)}
              >
                <Pencil size={12} />
                编辑
              </button>
            )}
            {onClose ? (
              <button
                type="button"
                onClick={onClose}
                className="icon-capsule h-8 w-8"
                aria-label="关闭故事设定"
              >
                <X size={16} />
              </button>
            ) : null}
          </div>
        </div>
      </header>

      {selected ? (
        <EntityDetail
          entity={selected}
          onEdit={() => setEditing(selected)}
          onDelete={() => setDeleteTarget(selected)}
        />
      ) : (
        <>
          <div className="relative">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink-mute"
              aria-hidden="true"
            />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="搜索名称、身份或设定"
              aria-label="搜索故事设定"
              className="h-9 w-full rounded-full border border-transparent bg-surface-2 pl-8 pr-8 text-[12px] text-ink outline-none transition-colors placeholder:text-ink-mute focus:border-accent focus:bg-surface"
            />
            {query ? (
              <button
                type="button"
                onClick={() => setQuery("")}
                className="absolute right-2 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full text-ink-mute hover:bg-surface-3 hover:text-ink"
                aria-label="清除搜索"
              >
                <X size={12} />
              </button>
            ) : null}
          </div>

          <div className="flex flex-wrap gap-1.5" role="tablist" aria-label="设定类型筛选">
            {FILTERS.map((item) => {
              const count = item.value === "all" ? entities.length : counts.get(item.value) ?? 0;
              return (
                <button
                  key={item.value}
                  type="button"
                  role="tab"
                  aria-selected={filter === item.value}
                  onClick={() => setFilter(item.value)}
                  className={cn(
                    "inline-flex h-7 items-center gap-1.5 rounded-full px-2.5 text-[10.5px] font-medium transition-colors",
                    filter === item.value
                      ? "bg-ink text-paper"
                      : "bg-surface-2 text-ink-soft hover:bg-surface-3 hover:text-ink",
                  )}
                >
                  {item.label}
                  <span
                    className={cn(
                      "tabular-nums",
                      filter === item.value ? "text-paper/60" : "text-ink-mute",
                    )}
                  >
                    {count}
                  </span>
                </button>
              );
            })}
          </div>

          {entities.length === 0 ? (
            <div className="flex flex-col items-center rounded-3xl border border-dashed border-line-strong px-5 py-10 text-center">
              <span className="flex h-11 w-11 items-center justify-center rounded-full bg-accent-soft text-accent">
                <BookMarked size={20} strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-[13px] font-semibold">还没有故事设定</p>
              <p className="mt-1.5 text-[11px] leading-5 text-ink-mute">
                把角色、组织、地点和规则记在这里，写作时随时翻看。
              </p>
              <button
                type="button"
                className={capsule("primary", "sm", "mt-4")}
                onClick={() => setEditing("create")}
              >
                <Plus size={13} />
                写下第一条
              </button>
            </div>
          ) : visible.length === 0 ? (
            <div className="flex flex-col items-center px-5 py-10 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-surface-2 text-ink-mute">
                <Search size={17} strokeWidth={1.5} />
              </span>
              <p className="mt-3 text-[12px] font-medium">没有找到匹配的设定</p>
              <button
                type="button"
                className={capsule("ghost", "sm", "mt-2")}
                onClick={resetFilters}
              >
                清除筛选
              </button>
            </div>
          ) : (
            <ul className="space-y-1.5">
              {visible.map((entity) => (
                <li key={entity.id}>
                  <EntityRow entity={entity} onSelect={() => setSelectedId(entity.id)} />
                </li>
              ))}
            </ul>
          )}

          {visible.length > 0 ? (
            <p className="px-1 text-[10px] leading-5 text-ink-mute">
              设定用于写作参考，不会进入正文、手机预览或导出文件。
            </p>
          ) : null}
        </>
      )}

      {editing ? (
        <StoryEntityDialog
          key={editing === "create" ? "create" : editing.id}
          open
          workId={workId}
          entity={editing === "create" ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={handleSaved}
        />
      ) : null}

      <ConfirmDialog
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        onConfirm={() => void confirmDelete()}
        pending={deleting}
        title={deleteTarget ? `删除「${deleteTarget.name}」？` : "删除这条设定？"}
        description="设定不会影响正文内容，但删除后无法恢复。"
        confirmLabel="确认删除"
      />
    </div>
  );
}

function EntityRow({ entity, onSelect }: { entity: StoryEntity; onSelect: () => void }) {
  const Icon = TYPE_ICON[entity.type];
  return (
    <button
      type="button"
      onClick={onSelect}
      className="group flex w-full items-center gap-2.5 rounded-2xl border border-line bg-surface px-2.5 py-2.5 text-left transition-colors hover:border-line-strong hover:bg-surface-2"
    >
      <span
        className="flex h-9 w-9 flex-none items-center justify-center rounded-full font-serif text-[13px] font-semibold"
        style={{ backgroundColor: entity.color, color: "var(--on-cover)" }}
        aria-hidden="true"
      >
        {initialOf(entity.name)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="min-w-0 truncate text-[12.5px] font-semibold">{entity.name}</span>
          <span className="inline-flex flex-none items-center gap-1 text-[9px] text-ink-mute">
            <Icon size={10} aria-hidden="true" />
            {STORY_ENTITY_TYPE_LABEL[entity.type]}
          </span>
        </span>
        <span className="mt-0.5 block truncate text-[10.5px] text-ink-mute">
          {entity.subtitle || entity.summary || STORY_ENTITY_TYPE_HINT[entity.type]}
        </span>
      </span>
    </button>
  );
}

function EntityDetail({
  entity,
  onEdit,
  onDelete,
}: {
  entity: StoryEntity;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const Icon = TYPE_ICON[entity.type];
  return (
    <div className="space-y-5 pb-4">
      <div className="flex items-start gap-3">
        <span
          className="flex h-14 w-14 flex-none items-center justify-center rounded-[20px] font-serif text-2xl font-semibold"
          style={{ backgroundColor: entity.color, color: "var(--on-cover)" }}
          aria-hidden="true"
        >
          {initialOf(entity.name)}
        </span>
        <div className="min-w-0 flex-1">
          <h3 className="font-serif text-xl font-semibold leading-7">{entity.name}</h3>
          {entity.subtitle ? (
            <p className="mt-1 text-[11.5px] leading-5 text-ink-soft">{entity.subtitle}</p>
          ) : null}
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="chip h-6 px-2 text-[10px]">
              <Icon size={11} aria-hidden="true" />
              {STORY_ENTITY_TYPE_LABEL[entity.type]}
            </span>
            <span className="text-[9.5px] text-ink-mute">
              更新于 {formatDateTime(entity.updatedAt)}
            </span>
          </div>
        </div>
      </div>

      {entity.summary ? (
        <p className="rounded-3xl bg-surface-2 px-4 py-3 text-[12px] leading-6 text-ink-soft">
          {entity.summary}
        </p>
      ) : null}

      <section>
        <h4 className="text-[10px] font-medium tracking-[0.08em] text-ink-mute">详细设定</h4>
        <p className="mt-2 whitespace-pre-wrap text-[12.5px] leading-6 text-ink-soft">
          {entity.description || "还没有详细设定。可以补充背景、动机、关系与伏笔。"}
        </p>
      </section>

      <div className="flex flex-wrap gap-2 border-t border-line pt-4">
        <button type="button" className={capsule("secondary", "sm")} onClick={onEdit}>
          <Pencil size={13} />
          编辑设定
        </button>
        <button type="button" className={capsule("ghost", "sm", "text-danger")} onClick={onDelete}>
          <Trash2 size={13} />
          删除
        </button>
      </div>
    </div>
  );
}

function StoryEntityDialog({
  open,
  workId,
  entity,
  onClose,
  onSaved,
}: {
  open: boolean;
  workId: string;
  entity: StoryEntity | null;
  onClose: () => void;
  onSaved: (entity: StoryEntity) => void;
}) {
  const [type, setType] = useState<StoryEntityType>(entity?.type ?? "character");
  const [name, setName] = useState(entity?.name ?? "");
  const [subtitle, setSubtitle] = useState(entity?.subtitle ?? "");
  const [summary, setSummary] = useState(entity?.summary ?? "");
  const [description, setDescription] = useState(entity?.description ?? "");
  const [color, setColor] = useState(entity?.color ?? DEFAULT_STORY_ENTITY_COLOR);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!open) return;
    setType(entity?.type ?? "character");
    setName(entity?.name ?? "");
    setSubtitle(entity?.subtitle ?? "");
    setSummary(entity?.summary ?? "");
    setDescription(entity?.description ?? "");
    setColor(entity?.color ?? DEFAULT_STORY_ENTITY_COLOR);
    setError("");
  }, [entity, open]);

  const save = async () => {
    if (!name.trim()) {
      setError("请先写下名称。");
      return;
    }
    setPending(true);
    setError("");
    try {
      const payload = JSON.stringify({
        type,
        name: name.trim(),
        subtitle: subtitle.trim(),
        summary: summary.trim(),
        description: description.trim(),
        color,
      });
      const data = entity
        ? await apiFetch<{ entity: StoryEntity }>(`/api/story-entities/${entity.id}`, {
            method: "PATCH",
            body: payload,
          })
        : await apiFetch<{ entity: StoryEntity }>(`/api/works/${workId}/story-entities`, {
            method: "POST",
            body: payload,
          });
      if (!data.entity) throw new Error("保存后未能读回设定");
      onSaved(data.entity);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "保存失败");
    } finally {
      setPending(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={entity ? "编辑设定" : "新建设定"}
      description="记录名字、身份与关键信息，写作时可以随时回看。"
      width="lg"
      footer={
        <>
          <button type="button" className={capsule("ghost", "md")} onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            className={capsule("primary", "lg", "min-w-[112px]")}
            onClick={() => void save()}
            disabled={pending}
          >
            {pending ? <Loader2 size={15} className="animate-spin-slow" /> : null}
            {entity ? "保存修改" : "建立设定"}
          </button>
        </>
      }
    >
      <div className="space-y-5">
        <div>
          <span className="field-label">类型</span>
          <div className="flex flex-wrap gap-2">
            {STORY_ENTITY_TYPES.map((item) => {
              const Icon = TYPE_ICON[item];
              return (
                <button
                  key={item}
                  type="button"
                  onClick={() => setType(item)}
                  className={cn(
                    "capsule h-8 px-3 text-xs",
                    type === item
                      ? "bg-accent text-on-accent"
                      : "bg-surface-2 text-ink-soft hover:text-ink",
                  )}
                  aria-pressed={type === item}
                >
                  <Icon size={13} />
                  {STORY_ENTITY_TYPE_LABEL[item]}
                </button>
              );
            })}
          </div>
          <p className="mt-2 text-[10px] text-ink-mute">{STORY_ENTITY_TYPE_HINT[type]}</p>
        </div>

        <div className="grid gap-4 sm:grid-cols-[1fr_1fr]">
          <div>
            <label className="field-label" htmlFor="story-entity-name">
              名称
            </label>
            <input
              id="story-entity-name"
              className="field-input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              maxLength={60}
              placeholder="例如：许砚"
              autoComplete="off"
            />
            {error ? <p className="mt-2 text-xs text-danger">{error}</p> : null}
          </div>
          <div>
            <label className="field-label" htmlFor="story-entity-subtitle">
              一句话标签
            </label>
            <input
              id="story-entity-subtitle"
              className="field-input"
              value={subtitle}
              onChange={(event) => setSubtitle(event.target.value)}
              maxLength={80}
              placeholder="例如：回到雾港的长子"
            />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="story-entity-summary">
            摘要
          </label>
          <textarea
            id="story-entity-summary"
            className="field-textarea"
            value={summary}
            onChange={(event) => setSummary(event.target.value)}
            rows={2}
            maxLength={300}
            placeholder="一句话记住这个角色、地点或规则。"
          />
        </div>

        <div>
          <label className="field-label" htmlFor="story-entity-description">
            详细设定
          </label>
          <textarea
            id="story-entity-description"
            className="field-textarea"
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            rows={6}
            maxLength={6000}
            placeholder="背景、动机、人物关系、伏笔，或这个世界必须遵守的规则。"
          />
        </div>

        <div>
          <span className="field-label">识别色</span>
          <div className="flex flex-wrap gap-2">
            {STORY_ENTITY_COLORS.map((item) => (
              <button
                key={item.value}
                type="button"
                onClick={() => setColor(item.value)}
                className={cn(
                  "flex h-8 w-8 items-center justify-center rounded-full border-2 transition-transform",
                  color === item.value
                    ? "scale-105 border-accent"
                    : "border-transparent hover:scale-105",
                )}
                style={{ backgroundColor: item.value }}
                aria-label={item.name}
                aria-pressed={color === item.value}
                title={item.name}
              >
                {color === item.value ? (
                  <Check size={13} style={{ color: "var(--on-cover)" }} strokeWidth={3} />
                ) : null}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Modal>
  );
}
