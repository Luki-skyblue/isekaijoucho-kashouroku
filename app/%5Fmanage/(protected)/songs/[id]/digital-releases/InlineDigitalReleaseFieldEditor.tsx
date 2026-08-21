"use client";

import { useState, useTransition } from "react";
import { updateSongDigitalReleaseInlineField } from "@/app/%5Fmanage/actions";

type Props = {
  songId: number;
  digitalReleaseId: number;
  field: string;
  value: string | null;
  inputType?: "text" | "date" | "url";
  multiline?: boolean;
};

export default function InlineDigitalReleaseFieldEditor({
  songId,
  digitalReleaseId,
  field,
  value,
  inputType = "text",
  multiline = false,
}: Props) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const [pending, startTransition] = useTransition();

  const save = () => {
    startTransition(async () => {
      await updateSongDigitalReleaseInlineField(
        songId,
        digitalReleaseId,
        field,
        draft,
      );
      setEditing(false);
    });
  };

  if (!editing) {
    return (
      <span className="flex min-w-0 items-start justify-between gap-3">
        <span className={`min-w-0 break-all text-sm ${value ? "text-black/70" : "text-black/30"}`}>
          {value || "未入力"}
        </span>
        <button
          type="button"
          aria-label={`${field}を編集`}
          onClick={() => setEditing(true)}
          className="shrink-0 text-black/35 transition hover:text-black"
        >
          ✎
        </button>
      </span>
    );
  }

  const inputClass = "min-w-0 flex-1 border border-black/30 bg-white px-2 py-1 text-sm";

  return (
    <span className="flex flex-wrap items-start gap-2">
      {multiline ? (
        <textarea
          autoFocus
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          rows={3}
          className={inputClass}
        />
      ) : (
        <input
          autoFocus
          type={inputType}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") save();
            if (event.key === "Escape") setEditing(false);
          }}
          className={inputClass}
        />
      )}
      <button
        type="button"
        disabled={pending}
        onClick={save}
        className="border border-black bg-black px-2 py-1 text-xs text-white"
      >
        保存
      </button>
      <button
        type="button"
        onClick={() => setEditing(false)}
        className="px-2 py-1 text-xs text-black/50"
      >
        取消
      </button>
    </span>
  );
}
