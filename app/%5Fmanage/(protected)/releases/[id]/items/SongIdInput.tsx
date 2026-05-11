"use client";

import { useMemo, useState } from "react";

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

  const matchedSong = useMemo(() => {
    const id = Number(value);

    if (!Number.isFinite(id) || !value.trim()) {
      return null;
    }

    return songs.find((song) => song.id === id) ?? null;
  }, [songs, value]);

  return (
    <label className="grid gap-1 text-xs tracking-[0.18em] text-neutral-500">
      SONG ID
      <input
        name="song_id"
        type="number"
        value={value}
        onChange={(event) => setValue(event.target.value)}
        placeholder="登録曲と紐づける場合のみ"
        className="border border-neutral-300 bg-[#f5f5f2] px-3 py-2 text-sm tracking-normal text-neutral-900 outline-none focus:border-neutral-900"
      />

      {value.trim() ? (
        matchedSong ? (
          <p className="text-[11px] leading-5 tracking-normal text-neutral-500">
            {getSongOptionLabel(matchedSong)}
          </p>
        ) : (
          <p className="text-[11px] leading-5 tracking-normal text-red-700/60">
            該当する楽曲がありません。
          </p>
        )
      ) : (
        <p className="text-[11px] leading-5 tracking-normal text-neutral-400">
          未登録曲の場合は空欄にして、TRACK TITLE / TRACK ARTIST を入力します。
        </p>
      )}
    </label>
  );
}