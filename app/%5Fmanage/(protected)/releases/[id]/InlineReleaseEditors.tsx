"use client";

import { useState, useTransition } from "react";
import {
  updateReleaseGroupInlineField,
  updateReleaseInlineField,
  updateReleaseInlinePrimary,
} from "@/app/%5Fmanage/actions";
import type { ManageSelectOption } from "@/app/%5Fmanage/options";

type FieldProps = {
  releaseId: number;
  field: string;
  value: string | null;
  inputType?: "text" | "date" | "url";
  multiline?: boolean;
  options?: readonly ManageSelectOption[];
};

function FieldControl({
  draft,
  setDraft,
  inputType,
  multiline,
  options,
  onEscape,
  onEnter,
}: {
  draft: string;
  setDraft: (value: string) => void;
  inputType: "text" | "date" | "url";
  multiline: boolean;
  options?: readonly ManageSelectOption[];
  onEscape: () => void;
  onEnter: () => void;
}) {
  const inputClass = "min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm";
  const hasLegacyValue = Boolean(draft && options && !options.some((option) => option.value === draft));

  if (options) {
    return (
      <select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className={inputClass}>
        {hasLegacyValue ? <option value={draft}>{draft}（現在値）</option> : null}
        {options.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
    );
  }

  if (multiline) {
    return <textarea autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} rows={3} className={inputClass} />;
  }

  return (
    <input
      autoFocus
      type={inputType}
      value={draft}
      onChange={(event) => setDraft(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === "Enter") onEnter();
        if (event.key === "Escape") onEscape();
      }}
      className={inputClass}
    />
  );
}

function DisplayValue({ value, options }: { value: string | null; options?: readonly ManageSelectOption[] }) {
  const display = options?.find((option) => option.value === value)?.label ?? value;
  return <span className={`min-w-0 break-all text-sm ${value ? "text-black/70" : "text-black/30"}`}>{display || "未入力"}</span>;
}

export function InlineReleaseFieldEditor({ releaseId, field, value, inputType = "text", multiline = false, options }: FieldProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateReleaseInlineField(releaseId, field, draft); setEditing(false); });

  if (!editing) return <span className="flex min-w-0 items-start justify-between gap-3"><DisplayValue value={value} options={options} /><button type="button" aria-label={`${field}を編集`} onClick={() => setEditing(true)} className="shrink-0 text-black/35 hover:text-black">✎</button></span>;

  return <span className="flex flex-wrap items-start gap-2"><FieldControl draft={draft} setDraft={setDraft} inputType={inputType} multiline={multiline} options={options} onEscape={() => setEditing(false)} onEnter={save} /><button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-black/50">取消</button></span>;
}

export function InlineReleaseGroupFieldEditor({ releaseId, releaseGroupId, field, value, inputType = "text", multiline = false }: FieldProps & { releaseGroupId: number }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();
  const save = () => startTransition(async () => { await updateReleaseGroupInlineField(releaseId, releaseGroupId, field, draft); setEditing(false); });

  if (!editing) return <span className="flex min-w-0 items-start justify-between gap-3"><DisplayValue value={value} /><button type="button" aria-label={`作品の${field}を編集`} onClick={() => setEditing(true)} className="shrink-0 text-black/35 hover:text-black">✎</button></span>;

  return <span className="flex flex-wrap items-start gap-2"><FieldControl draft={draft} setDraft={setDraft} inputType={inputType} multiline={multiline} onEscape={() => setEditing(false)} onEnter={save} /><button type="button" disabled={pending} onClick={save} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="px-2 py-1 text-xs text-black/50">取消</button></span>;
}

export function InlineReleasePrimaryEditor({ releaseId, value }: { releaseId: number; value: boolean | null }) {
  const [pending, startTransition] = useTransition();
  return <button type="button" disabled={pending} onClick={() => startTransition(async () => { await updateReleaseInlinePrimary(releaseId, !value); })} className="text-xs text-black/55 underline underline-offset-4 hover:text-black">{value ? "代表形態" : "代表形態にする"}</button>;
}

export function InlineReleaseGroupSelectEditor({ releaseId, currentGroupId, groups }: { releaseId: number; currentGroupId: number | null; groups: { id: number; title: string | null }[] }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(currentGroupId ? String(currentGroupId) : "");
  const [pending, startTransition] = useTransition();

  if (!editing) return <button type="button" onClick={() => setEditing(true)} className="text-xs text-black/55 underline underline-offset-4 hover:text-black">作品グループを変更</button>;

  return <span className="flex flex-wrap items-center gap-2"><select autoFocus value={draft} onChange={(event) => setDraft(event.target.value)} className="border border-black/30 bg-white px-2 py-1 text-sm"><option value="">グループ未設定</option>{groups.map((group) => <option key={group.id} value={group.id}>#{group.id} {group.title ?? "名称未設定"}</option>)}</select><button type="button" disabled={pending} onClick={() => startTransition(async () => { await updateReleaseInlineField(releaseId, "release_group_id", draft); setEditing(false); })} className="border border-black bg-black px-2 py-1 text-xs text-white">保存</button><button type="button" onClick={() => setEditing(false)} className="text-xs text-black/50">取消</button></span>;
}
