"use client";

import { useState } from "react";

const LINK_TYPE_OPTIONS = [
  "mv",
  "trailer",
  "lyric_mv",
  "live_mv",
  "original",
  "streaming",
  "lyrics",
  "piapro",
  "x",
  "announcement",
  "album",
  "other",
];

function TextInput({
  name,
  label,
  defaultValue,
  required = false,
  type = "text",
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  required?: boolean;
  type?: string;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
        required={required}
        placeholder={placeholder}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  placeholder,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
}) {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      {label}
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        rows={3}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      />
    </label>
  );
}

function LinkTypeSelect() {
  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      LINK TYPE
      <select
        name="link_type"
        defaultValue="mv"
        required
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      >
        {LINK_TYPE_OPTIONS.map((type) => (
          <option key={type} value={type}>
            {type}
          </option>
        ))}
      </select>
    </label>
  );
}

function CopyDateButton({
  label,
  date,
  onClick,
}: {
  label: string;
  date: string | null;
  onClick: (date: string) => void;
}) {
  const disabled = !date;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={() => {
        if (date) {
          onClick(date);
        }
      }}
      className={
        disabled
          ? "border border-neutral-200 px-2.5 py-1 text-[11px] tracking-[0.12em] text-neutral-300"
          : "border border-neutral-300 px-2.5 py-1 text-[11px] tracking-[0.12em] text-neutral-500 transition hover:border-neutral-900 hover:text-neutral-900"
      }
    >
      {label}
    </button>
  );
}

export default function CreateSongLinkForm({
  action,
  firstDate,
  firstFullDate,
}: {
  action: (formData: FormData) => void;
  firstDate: string | null;
  firstFullDate: string | null;
}) {
  const [publishedDate, setPublishedDate] = useState("");

  return (
    <form action={action} className="grid gap-5">
      <div className="grid gap-4 md:grid-cols-3">
        <LinkTypeSelect />

        <TextInput name="label" label="LABEL" />

        <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
          PUBLISHED DATE
          <input
            name="published_date"
            type="date"
            value={publishedDate}
            onChange={(event) => setPublishedDate(event.target.value)}
            className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
          />
          <div className="mt-1 flex flex-wrap gap-1.5">
            <CopyDateButton
              label="USE FIRST"
              date={firstDate}
              onClick={setPublishedDate}
            />
            <CopyDateButton
              label="USE FIRST FULL"
              date={firstFullDate}
              onClick={setPublishedDate}
            />
            <button
              type="button"
              onClick={() => setPublishedDate("")}
              className="border border-neutral-200 px-2.5 py-1 text-[11px] tracking-[0.12em] text-neutral-400 transition hover:border-neutral-500 hover:text-neutral-600"
            >
              CLEAR
            </button>
          </div>
        </label>
      </div>

      <TextInput
        name="url"
        label="URL"
        required
        placeholder="https://..."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <TextInput
          name="title"
          label="TITLE"
          placeholder="表示用タイトル"
        />
        <TextInput
          name="site_name"
          label="SITE NAME"
          placeholder="YouTube / X / piapro など"
        />
      </div>

      <TextInput
        name="thumbnail_url"
        label="THUMBNAIL URL"
        placeholder="https://..."
      />

      <TextArea
        name="notes"
        label="NOTES"
        placeholder="補足メモ"
      />

      <div>
        <button
          type="submit"
          className="border border-neutral-900 bg-neutral-950 px-5 py-2 text-sm tracking-[0.18em] text-[#f5f5f2] hover:bg-neutral-800"
        >
          ADD LINK
        </button>
      </div>
    </form>
  );
}