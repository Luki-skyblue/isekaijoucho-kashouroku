"use client";

import { useState } from "react";

type SongOption = {
  id: number;
  title: string | null;
  artist_credit: string | null;
  version_name: string | null;
  is_primary_version: boolean | null;
};

function getSongOptionLabel(song: SongOption) {
  const version =
    song.version_name ||
    (song.is_primary_version === false ? "別バージョン" : null);

  return `#${song.id} ${song.title ?? "無題"}${
    version ? ` (${version})` : ""
  } / ${song.artist_credit ?? "-"}`;
}

export default function SongIdInput({
  songs,
  defaultValue,
}: {
  songs: SongOption[];
  defaultValue?: number | null;
}) {
  const [value, setValue] = useState(
    defaultValue !== null && defaultValue !== undefined ? String(defaultValue) : ""
  );

  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      登録楽曲
      <select
        name="song_id"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      >
        <option value="">楽曲未設定（未登録曲）</option>
        {songs.map((song) => <option key={song.id} value={song.id}>{getSongOptionLabel(song)}</option>)}
      </select>
      <p className="text-[11px] leading-5 tracking-normal text-neutral-400">未登録曲の場合は「楽曲未設定」を選び、曲名とアーティストを入力します。</p>
    </label>
  );
}
