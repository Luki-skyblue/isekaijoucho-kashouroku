"use client";

import { useState, useTransition } from "react";
import { updateSongInlineField, updateSongInlineStatus } from "../actions";

const statuses = [
  ["confirmed", "確認済み"], ["uncertain", "要確認"], ["unverified", "未確認"], ["wanted", "情報募集中"],
] as const;

export function InlineFieldEditor({ songId, field, value }: { songId: number; field: string; value: string | null }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateSongInlineField(songId, field, draft); setEditing(false); });
  if (!editing) return <button type="button" aria-label={`${field}を編集`} onClick={() => setEditing(true)} className="ml-2 text-black/35 transition hover:text-black">✎</button>;
  return <span className="flex flex-wrap items-center gap-2 sm:justify-end"><input autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") setEditing(false); }} className="min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm sm:max-w-xs" /><button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs text-black/50">取消</button></span>;
}

export function InlineStatusEditor({ songId, field, value }: { songId: number; field: string; value: string | null }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const current = statuses.find(([key]) => key === value);
  return <span className="relative inline-flex items-center"><button type="button" aria-label="確認状態を変更" disabled={pending} onClick={() => setOpen((state) => !state)} className="inline-flex items-center gap-2 text-xs text-black/50"><span className={`inline-block h-2 w-2 rounded-full ${value === "confirmed" ? "bg-black/60" : "border border-black/35"}`} />{current?.[1] ?? "未設定"}</button>{open ? <span className="absolute right-0 top-6 z-10 grid min-w-28 border border-black/20 bg-[#f5f5f2] p-1 shadow-sm">{statuses.map(([key, label]) => <button key={key} type="button" onClick={() => { startTransition(async () => { await updateSongInlineStatus(songId, field, key); setOpen(false); }); }} className="px-2 py-1 text-left text-xs hover:bg-black/[0.06]">{label}</button>)}</span> : null}</span>;
}
