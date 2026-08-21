"use client";

import { useState, useTransition } from "react";
import { updateSongGroupInlineField, updateSongInlineField, updateSongInlinePrimary, updateSongInlineStatus } from "../actions";
import type { ManageSelectOption } from "../options";

const statuses = [
  ["confirmed", "確認済み"], ["uncertain", "要確認"], ["unverified", "未確認"], ["wanted", "情報募集中"],
] as const;

export function InlineFieldEditor({ songId, field, value, options, inputType = "text" }: { songId: number; field: string; value: string | null; options?: readonly ManageSelectOption[]; inputType?: "text" | "date" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateSongInlineField(songId, field, draft); setEditing(false); });
  if (!editing) return <button type="button" aria-label={`${field}を編集`} onClick={() => setEditing(true)} className="ml-2 text-black/35 transition hover:text-black">✎</button>;
  const hasLegacyValue = Boolean(draft && options && !options.some((option) => option.value === draft));
  return <span className="flex flex-wrap items-center gap-2 sm:justify-end">{options ? <select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Escape") setEditing(false); }} className="min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm sm:max-w-xs"><option value="">未設定</option>{hasLegacyValue ? <option value={draft}>{draft}（現在値）</option> : null}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : <input autoFocus type={inputType} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") setEditing(false); }} className="min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm sm:max-w-xs" />}<button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs text-black/50">取消</button></span>;
}

export function InlineFieldCopyButton({ songId, field, value, label }: { songId: number; field: string; value: string | null; label: string }) {
  const [pending, startTransition] = useTransition();

  return (
    <button
      type="button"
      disabled={pending || !value}
      onClick={() => startTransition(async () => { await updateSongInlineField(songId, field, value ?? ""); })}
      className="ml-3 text-[11px] text-black/40 underline decoration-black/20 underline-offset-4 transition hover:text-black disabled:cursor-not-allowed disabled:opacity-35"
    >
      {pending ? "コピー中…" : label}
    </button>
  );
}

export function InlineStatusEditor({ songId, field, value }: { songId: number; field: string; value: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = statuses.find(([key]) => key === value);
  return <span className="relative inline-flex items-center"><button type="button" aria-label="確認状態を変更" disabled={pending} onClick={() => setOpen((state) => !state)} className="inline-flex items-center gap-2 text-xs text-black/50"><span className={`inline-block h-2 w-2 rounded-full ${value === "confirmed" ? "bg-black/60" : "border border-black/35"}`} />{current?.[1] ?? "未設定"}</button>{open ? <span className="absolute right-0 top-6 z-10 grid min-w-28 border border-black/20 bg-[#f5f5f2] p-1 shadow-sm">{statuses.map(([key, label]) => <button key={key} type="button" onClick={() => { startTransition(async () => { await updateSongInlineStatus(songId, field, key); setOpen(false); }); }} className="px-2 py-1 text-left text-xs hover:bg-black/[0.06]">{label}</button>)}</span> : null}</span>;
}

export function InlinePrimaryEditor({ songId, value }: { songId: number; value: boolean | null }) {
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => { await updateSongInlinePrimary(songId, !value); })} className="text-xs text-black/55 underline underline-offset-4 hover:text-black">{value ? "代表版" : "代表版にする"}</button>;
}

export function InlineGroupSelectEditor({ songId, currentGroupId, groups }: { songId: number; currentGroupId: number | null; groups: { id: number; title: string | null }[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentGroupId ? String(currentGroupId) : "");
  const [pending, startTransition] = useTransition();
  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="text-xs text-black/55 underline underline-offset-4 hover:text-black">グループを変更</button>;
  return <span className="flex flex-wrap items-center gap-2"><select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className="border border-black/30 bg-white px-2 py-1 text-sm"><option value="">グループ未設定</option>{groups.map((group) => <option key={group.id} value={group.id}>#{group.id} {group.title ?? "名称未設定"}</option>)}</select><button type="button" disabled={pending} onClick={() => startTransition(async () => { await updateSongInlineField(songId, "song_group_id", draft); setEditing(false); })} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs text-black/50">取消</button></span>;
}

export function InlineGroupFieldEditor({ groupId, field, value }: { groupId: number; field: string; value: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateSongGroupInlineField(groupId, field, draft); setEditing(false); });
  if (!editing) return <span className="inline-flex items-center gap-2"><span className={`font-serif-jp text-3xl tracking-[0.02em] md:text-5xl ${value ? "text-black" : "text-black/35"}`}>{value?.trim() || "未入力"}</span><button type="button" aria-label="グループ情報を編集" onClick={() => setEditing(true)} className="text-black/35 hover:text-black">✎</button></span>;
  return <span className="flex flex-wrap items-center gap-2"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className="border border-black/30 bg-white px-2 py-1 text-sm" /><button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs text-black/50">取消</button></span>;
}
