"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

type Song = {
  id: number;
  title: string;
  title_kana: string | null;
  first_date: string | null;
  first_source: string | null;
  artist_credit: string | null;
  song_type: string | null;
  verification_status: string | null;
};

type SongsListProps = {
  songs: Song[];
};

function uniqueValues(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort();
}

export default function SongsList({ songs }: SongsListProps) {
  const [query, setQuery] = useState("");
  const [songType, setSongType] = useState("");

  const songTypes = useMemo(
    () => uniqueValues(songs.map((song) => song.song_type)),
    [songs]
  );

  const filteredSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return songs.filter((song) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [song.title, song.title_kana, song.artist_credit]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));

      const matchesType = songType === "" || song.song_type === songType;

      return matchesQuery && matchesType;
    });
  }, [songs, query, songType]);

  return (
    <>
      <section className="mt-8 border-y border-black/15 py-5">
        <div className="grid gap-4 md:grid-cols-[1fr_180px_auto] md:items-end">
          <label className="block">
            <span className="archive-label text-black/45">SEARCH</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="曲名・読み・名義で検索"
              className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black"
            />
          </label>

          <label className="block">
            <span className="archive-label text-black/45">TYPE</span>
            <select
              value={songType}
              onChange={(event) => setSongType(event.target.value)}
              className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition focus:border-black"
            >
              <option value="">すべて</option>
              {songTypes.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              setQuery("");
              setSongType("");
            }}
            className="border border-black px-4 py-2 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
          >
            RESET
          </button>
        </div>

        <p className="mt-4 text-xs text-black/45">
          {filteredSongs.length} / {songs.length} SONGS
        </p>
      </section>

      <section className="mt-8">
        <div className="hidden border-y border-black/15 py-3 text-xs font-medium tracking-[0.12em] text-black/45 md:grid md:grid-cols-[120px_1fr_140px_120px]">
          <p>DATE</p>
          <p>TITLE</p>
          <p>SOURCE</p>
          <p>TYPE</p>
        </div>

        <div className="divide-y divide-black/10">
          {filteredSongs.map((song) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              className="grid gap-2 py-5 transition hover:bg-black/[0.03] md:grid-cols-[120px_1fr_140px_120px] md:items-start"
            >
              <time className="text-xs text-black/45">
                {song.first_date ?? "----.--.--"}
              </time>

              <div>
                <p className="text-base font-medium tracking-[0.01em] text-black">
                  {song.title}
                </p>

                {song.artist_credit && (
                  <p className="mt-1 text-xs text-black/45">
                    {song.artist_credit}
                  </p>
                )}

                {song.verification_status &&
                  song.verification_status !== "confirmed" && (
                    <p className="mt-2 inline-flex border border-black/20 px-2 py-1 text-[11px] tracking-[0.08em] text-black/55">
                      要確認
                    </p>
                  )}
              </div>

              <p className="text-xs text-black/50">
                {song.first_source ?? "-"}
              </p>

              <p className="text-xs uppercase tracking-[0.12em] text-black/45">
                {song.song_type ?? "-"}
              </p>
            </Link>
          ))}

          {filteredSongs.length === 0 && (
            <div className="py-10 text-sm text-black/50">
              条件に一致する楽曲がありません。
            </div>
          )}
        </div>
      </section>
    </>
  );
}