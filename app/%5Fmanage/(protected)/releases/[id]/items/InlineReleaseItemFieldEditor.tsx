"use client";

import { useState, useTransition } from "react";
import { updateReleaseItemInlineField } from "@/app/%5Fmanage/actions";
import type { ManageSelectOption } from "@/app/%5Fmanage/options";

export default function InlineReleaseItemFieldEditor({ releaseId, itemId, field, value, inputType = "text", multiline = false, options }: { releaseId: number; itemId: number; field: string; value: string | number | null; inputType?: "text" | "number"; multiline?: boolean; options?: readonly ManageSelectOption[] }) {
  const normalizedValue = value === null ? "" : String(value);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(normalizedValue);
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateReleaseItemInlineField(releaseId, itemId, field, draft); setEditing(false); });
  const display = options?.find((option) => option.value === normalizedValue)?.label ?? normalizedValue;

  if (!editing) return <span className="flex min-w-0 items-start justify-between gap-3"><span className={`min-w-0 break-all text-sm ${normalizedValue ? "text-black/70" : "text-black/30"}`}>{display || "未入力"}</span><button type="button" aria-label={`${field}を編集`} onClick={() => setEditing(true)} className="shrink-0 text-black/35 hover:text-black">✎</button></span>;

  const inputClass = "min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm";
  return <span className="flex flex-wrap items-start gap-2">{options ? <select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className={inputClass}><option value="">楽曲未設定</option>{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : multiline ? <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className={inputClass} /> : <input autoFocus type={inputType} value={draft} onChange={(event) => setDraft(event.target.value)} onKeyDown={(event) => { if (event.key === "Enter") save(); if (event.key === "Escape") setEditing(false); }} className={inputClass} />}<button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-black/50">取消</button></span>;
}
