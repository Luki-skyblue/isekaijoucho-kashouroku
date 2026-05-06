"use client";

import { useState } from "react";

function TextInput({
  name,
  label,
  value,
  onChange,
  type = "text",
}: {
  name: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">{label}</span>
      <input
        name={name}
        type={type}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
      />
    </label>
  );
}

function TextArea({
  name,
  label,
  defaultValue,
  rows = 4,
}: {
  name: string;
  label: string;
  defaultValue: string | null;
  rows?: number;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">{label}</span>
      <textarea
        name={name}
        defaultValue={defaultValue ?? ""}
        rows={rows}
        className="mt-2 w-full border border-black/20 bg-transparent px-3 py-3 text-sm leading-7 text-black outline-none transition focus:border-black"
      />
    </label>
  );
}

function FieldStatusSelect({
  name,
  label = "STATUS",
  defaultValue,
}: {
  name: string;
  label?: string;
  defaultValue?: string | null;
}) {
  return (
    <label className="grid gap-1 text-[10px] tracking-[0.16em] text-neutral-400">
      {label}
      <select
        name={name}
        defaultValue={defaultValue ?? "confirmed"}
        className="border border-neutral-200 bg-transparent px-2 py-1.5 text-xs tracking-normal text-neutral-600 outline-none focus:border-neutral-500"
      >
        <option value="confirmed">確認済み</option>
        <option value="uncertain">不確定</option>
        <option value="unverified">未確認</option>
        <option value="wanted">情報募集中</option>
      </select>
    </label>
  );
}

function CopyButton({
  disabled,
  onClick,
  children,
}: {
  disabled?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={
        disabled
          ? "border border-black/10 px-2.5 py-1 text-[11px] tracking-[0.12em] text-black/25"
          : "border border-black/20 px-2.5 py-1 text-[11px] tracking-[0.12em] text-black/45 transition hover:border-black hover:text-black"
      }
    >
      {children}
    </button>
  );
}

export default function ReleaseFields({
  firstDate,
  firstSource,
  firstStatus,
  firstFullDate,
  firstFullSource,
  firstFullStatus,
  tieUp,
  tieUpStatus,
}: {
  firstDate: string | null;
  firstSource: string | null;
  firstStatus: string | null;
  firstFullDate: string | null;
  firstFullSource: string | null;
  firstFullStatus: string | null;
  tieUp: string | null;
  tieUpStatus: string | null;
}) {
  const [currentFirstDate, setCurrentFirstDate] = useState(firstDate ?? "");
  const [currentFirstSource, setCurrentFirstSource] = useState(
    firstSource ?? ""
  );
  const [currentFirstFullDate, setCurrentFirstFullDate] = useState(
    firstFullDate ?? ""
  );
  const [currentFirstFullSource, setCurrentFirstFullSource] = useState(
    firstFullSource ?? ""
  );

  return (
    <section>
      <p className="section-label text-black/45">RELEASE</p>

      <div className="mt-4 space-y-5">
        <div className="grid gap-4 md:grid-cols-[180px_1fr_140px]">
          <TextInput
            name="first_date"
            label="FIRST DATE"
            value={currentFirstDate}
            onChange={setCurrentFirstDate}
            type="date"
          />
          <TextInput
            name="first_source"
            label="FIRST SOURCE"
            value={currentFirstSource}
            onChange={setCurrentFirstSource}
          />
          <div className="self-end">
            <FieldStatusSelect
              name="first_status"
              defaultValue={firstStatus}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[180px_1fr_140px]">
          <div>
            <TextInput
              name="first_full_date"
              label="FIRST FULL DATE"
              value={currentFirstFullDate}
              onChange={setCurrentFirstFullDate}
              type="date"
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              <CopyButton
                disabled={!currentFirstDate}
                onClick={() => setCurrentFirstFullDate(currentFirstDate)}
              >
                USE FIRST DATE
              </CopyButton>
              <CopyButton onClick={() => setCurrentFirstFullDate("")}>
                CLEAR
              </CopyButton>
            </div>
          </div>

          <div>
            <TextInput
              name="first_full_source"
              label="FIRST FULL SOURCE"
              value={currentFirstFullSource}
              onChange={setCurrentFirstFullSource}
            />

            <div className="mt-2 flex flex-wrap gap-1.5">
              <CopyButton
                disabled={!currentFirstSource}
                onClick={() => setCurrentFirstFullSource(currentFirstSource)}
              >
                USE FIRST SOURCE
              </CopyButton>
              <CopyButton onClick={() => setCurrentFirstFullSource("")}>
                CLEAR
              </CopyButton>
            </div>
          </div>

          <div className="self-end">
            <FieldStatusSelect
              name="first_full_status"
              defaultValue={firstFullStatus}
            />
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-[1fr_140px]">
          <TextArea
            name="tie_up"
            label="TIE-UP"
            defaultValue={tieUp}
            rows={3}
          />
          <div className="self-end">
            <FieldStatusSelect
              name="tie_up_status"
              defaultValue={tieUpStatus}
            />
          </div>
        </div>
      </div>
    </section>
  );
}