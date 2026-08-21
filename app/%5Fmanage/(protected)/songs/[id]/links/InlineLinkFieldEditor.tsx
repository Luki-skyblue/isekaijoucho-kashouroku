"use client";

import { useState, useTransition } from "react";
import { updateSongLinkInlineField } from "@/app/%5Fmanage/actions";
import type { ManageSelectOption } from "@/app/%5Fmanage/options";

export default function InlineLinkFieldEditor({ linkId, songId, field, value, multiline = false, options, inputType = "text" }: { linkId: number; songId: number; field: string; value: string | null; multiline?: boolean; options?: readonly ManageSelectOption[]; inputType?: "text" | "date" | "url" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateSongLinkInlineField(linkId, songId, field, draft); setEditing(false); });
  const displayValue = options?.find((option) => option.value === value)?.label ?? value;
  if (!editing) return <span className="flex min-w-0 items-start justify-between gap-3"><span className={`min-w-0 break-all text-sm ${value ? "text-black/70" : "text-black/30"}`}>{displayValue || "未入力"}</span><button type="button" aria-label="編集" onClick={() => setEditing(true)} className="shrink-0 text-black/35 hover:text-black">✎</button></span>;
  const inputClass = "min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm";
  const hasLegacyValue = Boolean(draft && options && !options.some((option) => option.value === draft));
  return <span className="flex flex-wrap items-start gap-2">{options ? <select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className={inputClass}>{hasLegacyValue ? <option value={draft}>{draft}（現在値）</option> : null}{options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}</select> : multiline ? <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className={inputClass} /> : <input autoFocus type={inputType} value={draft} onChange={(event) => setDraft(event.target.value)} className={inputClass} />}<button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-black/50">取消</button></span>;
}
