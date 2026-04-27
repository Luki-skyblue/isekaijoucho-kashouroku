"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";

type Song = {
  id: number;
  title: string;
  title_kana: string | null;
  sort_title: string | null;
  first_date: string | null;
  first_source: string | null;
  artist_credit: string | null;
  song_type: string | null;
  verification_status: string | null;
};

type SongsListProps = {
  songs: Song[];
};

type SortKey = "date" | "title";
type SortDirection = "asc" | "desc";

type CreditBase = "isekai" | "vwp" | "other";

const creditBases: Array<{
  key: CreditBase;
  label: string;
}> = [
  { key: "isekai", label: "ヰ世界情緒" },
  { key: "vwp", label: "V.W.P" },
  { key: "other", label: "その他" },
];

const allCreditBases = creditBases.map((item) => item.key);

function uniqueValues(values: Array<string | null>) {
  return Array.from(
    new Set(values.filter((value): value is string => Boolean(value)))
  ).sort();
}

function matchesCreditBase(
  artistCredit: string | null,
  base: CreditBase,
  exactOptions: {
    isekaiExact: boolean;
    vwpExact: boolean;
  }
) {
  const credit = artistCredit?.trim() ?? "";

  if (base === "isekai") {
    if (exactOptions.isekaiExact) {
      return credit === "ヰ世界情緒";
    }

    return credit.includes("ヰ世界情緒");
  }

  if (base === "vwp") {
    if (exactOptions.vwpExact) {
      return credit === "V.W.P";
    }

    return credit.includes("V.W.P");
  }

  return !credit.includes("ヰ世界情緒") && !credit.includes("V.W.P");
}

function SortButton({
  label,
  sortValue,
  directionValue,
  sortKey,
  sortDirection,
  onClick,
}: {
  label: string;
  sortValue: SortKey;
  directionValue: SortDirection;
  sortKey: SortKey;
  sortDirection: SortDirection;
  onClick: () => void;
}) {
  const active = sortKey === sortValue && sortDirection === directionValue;

  return (
    <button
      type="button"
      onClick={onClick}
      className={
        active
          ? "border border-black bg-black px-1.5 py-0.5 text-[10px] leading-none text-[#f5f5f2]"
          : "border border-black/20 px-1.5 py-0.5 text-[10px] leading-none text-black/45 transition hover:border-black hover:text-black"
      }
      aria-label={label}
    >
      {directionValue === "asc" ? "↑" : "↓"}
    </button>
  );
}

function getTitleSortKey(song: Song) {
  const raw = (song.sort_title || song.title).trim();

  if (!raw) {
    return {
      group: 3,
      value: "",
    };
  }

  const firstChar = raw[0];

  // 数字始まり：0-9、全角０-９
  if (/^[0-9０-９]$/.test(firstChar)) {
    return {
      group: 0,
      value: raw,
    };
  }

  // アルファベット始まり：A-Z、a-z、全角Ａ-Ｚ、ａ-ｚ
  if (/^[A-Za-zＡ-Ｚａ-ｚ]$/.test(firstChar)) {
    return {
      group: 1,
      value: raw.toLowerCase(),
    };
  }

  // それ以外は日本語読み・五十音用キーとして扱う
  return {
    group: 2,
    value: raw,
  };
}

export default function SongsList({ songs }: SongsListProps) {
  const [query, setQuery] = useState("");
  const [sortKey, setSortKey] = useState<SortKey>("date");
  const [sortDirection, setSortDirection] = useState<SortDirection>("desc");

  const [enabledCreditBases, setEnabledCreditBases] =
    useState<CreditBase[]>(allCreditBases);
  const [isekaiExact, setIsekaiExact] = useState(false);
  const [vwpExact, setVwpExact] = useState(false);

  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);

  const songTypes = useMemo(() => {
    const preferredOrder = ["original", "cover"];

    const values = uniqueValues(songs.map((song) => song.song_type));

    return values.sort((a, b) => {
      const aIndex = preferredOrder.indexOf(a);
      const bIndex = preferredOrder.indexOf(b);

      if (aIndex !== -1 && bIndex !== -1) {
        return aIndex - bIndex;
      }

      if (aIndex !== -1) {
        return -1;
      }

      if (bIndex !== -1) {
        return 1;
      }

      return a.localeCompare(b, "ja");
    });
  }, [songs]);

  useEffect(() => {
    setEnabledTypes(songTypes);
  }, [songTypes]);

  const allCreditsEnabled = enabledCreditBases.length === allCreditBases.length;
  const noCreditsEnabled = enabledCreditBases.length === 0;
  const allTypesEnabled = enabledTypes.length === songTypes.length;
  const noTypesEnabled = enabledTypes.length === 0;

  function toggleCreditBase(base: CreditBase) {
    setEnabledCreditBases((current) => {
      if (current.includes(base)) {
        return current.filter((item) => item !== base);
      }

      return [...current, base];
    });
  }

  function toggleAllCredits() {
    if (allCreditsEnabled) {
      setEnabledCreditBases([]);
      return;
    }

    setEnabledCreditBases(allCreditBases);
  }

  function toggleType(type: string) {
    setEnabledTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  function toggleAllTypes() {
    if (allTypesEnabled) {
      setEnabledTypes([]);
      return;
    }

    setEnabledTypes(songTypes);
  }

  function resetFilters() {
    setQuery("");
    setSortKey("date");
    setSortDirection("desc");
    setEnabledCreditBases(allCreditBases);
    setIsekaiExact(false);
    setVwpExact(false);
    setEnabledTypes(songTypes);
  }

  const filteredSongs = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();

    return songs.filter((song) => {
      const matchesQuery =
        normalizedQuery.length === 0 ||
        [song.title, song.title_kana, song.artist_credit]
          .filter(Boolean)
          .some((value) => value!.toLowerCase().includes(normalizedQuery));

      const matchesCredit = enabledCreditBases.some((base) =>
        matchesCreditBase(song.artist_credit, base, {
          isekaiExact,
          vwpExact,
        })
      );

      const matchesType =
        song.song_type !== null && enabledTypes.includes(song.song_type);

      return matchesQuery && matchesCredit && matchesType;
    });
  }, [
    songs,
    query,
    enabledCreditBases,
    isekaiExact,
    vwpExact,
    enabledTypes,
  ]);

  const sortedSongs = useMemo(() => {
    const songsToSort = [...filteredSongs];

    songsToSort.sort((a, b) => {
      if (sortKey === "title") {
        const aKey = getTitleSortKey(a);
        const bKey = getTitleSortKey(b);

        if (aKey.group !== bKey.group) {
          const result = aKey.group - bKey.group;
          return sortDirection === "asc" ? result : -result;
        }

        const result = aKey.value.localeCompare(bKey.value, "ja", {
          numeric: true,
          sensitivity: "base",
        });

        return sortDirection === "asc" ? result : -result;
      }

      const aDate = a.first_date ?? "0000-00-00";
      const bDate = b.first_date ?? "0000-00-00";
      const result = aDate.localeCompare(bDate);

      return sortDirection === "asc" ? result : -result;
    });

    return songsToSort;
  }, [filteredSongs, sortKey, sortDirection]);

  return (
    <>
      <section className="mt-8 border-y border-black/15 py-5">
        <div>
          <label className="block">
            <span className="section-label text-black/45">SEARCH</span>
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="曲名・読み・名義で検索"
              className="mt-2 w-full border border-black/20 bg-transparent px-3 py-2 text-sm text-black outline-none transition placeholder:text-black/35 focus:border-black"
            />
          </label>
        </div>

        <div className="mt-5 grid gap-5 border-t border-black/10 pt-5 md:grid-cols-[1fr_1fr]">
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="section-label text-black/45">CREDIT FILTER</p>

              <button
                type="button"
                onClick={toggleAllCredits}
                className="border border-black/25 px-2.5 py-1 text-[11px] text-black/60 transition hover:border-black hover:text-black"
              >
                {allCreditsEnabled ? "ALL OFF" : "ALL ON"}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCreditBase("isekai")}
                  className={
                    enabledCreditBases.includes("isekai")
                      ? "border border-black bg-black px-3 py-1.5 text-xs text-[#f5f5f2]"
                      : "border border-black/20 px-3 py-1.5 text-xs text-black/40"
                  }
                >
                  ヰ世界情緒
                </button>

                <label
                  className={
                    enabledCreditBases.includes("isekai")
                      ? "flex cursor-pointer items-center gap-1.5 text-[11px] text-black/65"
                      : "flex cursor-not-allowed items-center gap-1.5 text-[11px] text-black/25"
                  }
                >
                  <input
                    type="checkbox"
                    checked={isekaiExact}
                    disabled={!enabledCreditBases.includes("isekai")}
                    onChange={(event) => setIsekaiExact(event.target.checked)}
                    className="h-3.5 w-3.5 accent-black"
                  />
                  完全一致
                </label>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggleCreditBase("vwp")}
                  className={
                    enabledCreditBases.includes("vwp")
                      ? "border border-black bg-black px-3 py-1.5 text-xs text-[#f5f5f2]"
                      : "border border-black/20 px-3 py-1.5 text-xs text-black/40"
                  }
                >
                  V.W.P
                </button>

                <label
                  className={
                    enabledCreditBases.includes("vwp")
                      ? "flex cursor-pointer items-center gap-1.5 text-[11px] text-black/65"
                      : "flex cursor-not-allowed items-center gap-1.5 text-[11px] text-black/25"
                  }
                >
                  <input
                    type="checkbox"
                    checked={vwpExact}
                    disabled={!enabledCreditBases.includes("vwp")}
                    onChange={(event) => setVwpExact(event.target.checked)}
                    className="h-3.5 w-3.5 accent-black"
                  />
                  完全一致
                </label>
              </div>

              <div>
                <button
                  type="button"
                  onClick={() => toggleCreditBase("other")}
                  className={
                    enabledCreditBases.includes("other")
                      ? "border border-black bg-black px-3 py-1.5 text-xs text-[#f5f5f2]"
                      : "border border-black/20 px-3 py-1.5 text-xs text-black/40"
                  }
                >
                  その他
                </button>
              </div>
            </div>

            {(enabledCreditBases.includes("isekai") && !isekaiExact) ||
            (enabledCreditBases.includes("vwp") && !vwpExact) ? (
              <p className="mt-3 text-[11px] leading-5 text-black/40">
                完全一致を外すと、その名義を含む楽曲を表示します。
              </p>
            ) : null}
          </div>

          <div>
            <div className="flex flex-wrap items-center gap-3">
              <p className="section-label text-black/45">TYPE FILTER</p>

              <button
                type="button"
                onClick={toggleAllTypes}
                className="border border-black/25 px-2.5 py-1 text-[11px] text-black/60 transition hover:border-black hover:text-black"
              >
                {allTypesEnabled ? "ALL OFF" : "ALL ON"}
              </button>
            </div>

            <div className="mt-3 space-y-2">
              {songTypes.map((type) => {
                const enabled = enabledTypes.includes(type);

                return (
                  <div key={type}>
                    <button
                      type="button"
                      onClick={() => toggleType(type)}
                      className={
                        enabled
                          ? "border border-black bg-black px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-[#f5f5f2]"
                          : "border border-black/20 px-3 py-1.5 text-xs uppercase tracking-[0.08em] text-black/40"
                      }
                    >
                      {type}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <div className="mt-5 border-t border-black/10 pt-5 md:hidden">
          <p className="section-label text-black/45">SORT</p>

          <div className="mt-3 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setSortKey("date");
                setSortDirection("desc");
              }}
              className={
                sortKey === "date" && sortDirection === "desc"
                  ? "border border-black bg-black px-3 py-2 text-left text-xs tracking-[0.08em] text-[#f5f5f2]"
                  : "border border-black/20 px-3 py-2 text-left text-xs tracking-[0.08em] text-black/45"
              }
            >
              DATE ↓
            </button>

            <button
              type="button"
              onClick={() => {
                setSortKey("date");
                setSortDirection("asc");
              }}
              className={
                sortKey === "date" && sortDirection === "asc"
                  ? "border border-black bg-black px-3 py-2 text-left text-xs tracking-[0.08em] text-[#f5f5f2]"
                  : "border border-black/20 px-3 py-2 text-left text-xs tracking-[0.08em] text-black/45"
              }
            >
              DATE ↑
            </button>

            <button
              type="button"
              onClick={() => {
                setSortKey("title");
                setSortDirection("asc");
              }}
              className={
                sortKey === "title" && sortDirection === "asc"
                  ? "border border-black bg-black px-3 py-2 text-left text-xs tracking-[0.08em] text-[#f5f5f2]"
                  : "border border-black/20 px-3 py-2 text-left text-xs tracking-[0.08em] text-black/45"
              }
            >
              TITLE ↑
            </button>

            <button
              type="button"
              onClick={() => {
                setSortKey("title");
                setSortDirection("desc");
              }}
              className={
                sortKey === "title" && sortDirection === "desc"
                  ? "border border-black bg-black px-3 py-2 text-left text-xs tracking-[0.08em] text-[#f5f5f2]"
                  : "border border-black/20 px-3 py-2 text-left text-xs tracking-[0.08em] text-black/45"
              }
            >
              TITLE ↓
            </button>
          </div>
        </div>

        <div className="mt-5 flex justify-end border-t border-black/10 pt-4">
          <button
            type="button"
            onClick={resetFilters}
            className="border border-black/25 px-4 py-2 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
          >
            RESET ALL
          </button>
        </div>

        <p className="mt-5 text-xs text-black/45">
          {filteredSongs.length} / {songs.length} SONGS
        </p>
      </section>

      <section className="mt-8">
        <div className="hidden border-y border-black/15 py-3 text-xs font-medium tracking-[0.12em] text-black/45 md:grid md:grid-cols-[110px_1fr_180px_90px]">
          <div className="flex items-center gap-2">
            <span>DATE</span>
            <span className="flex gap-1">
              <SortButton
                label="日付の古い順"
                sortValue="date"
                directionValue="asc"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => {
                  setSortKey("date");
                  setSortDirection("asc");
                }}
              />
              <SortButton
                label="日付の新しい順"
                sortValue="date"
                directionValue="desc"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => {
                  setSortKey("date");
                  setSortDirection("desc");
                }}
              />
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span>TITLE</span>
            <span className="flex gap-1">
              <SortButton
                label="曲名昇順"
                sortValue="title"
                directionValue="asc"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => {
                  setSortKey("title");
                  setSortDirection("asc");
                }}
              />
              <SortButton
                label="曲名降順"
                sortValue="title"
                directionValue="desc"
                sortKey={sortKey}
                sortDirection={sortDirection}
                onClick={() => {
                  setSortKey("title");
                  setSortDirection("desc");
                }}
              />
            </span>
          </div>

          <p>CREDIT</p>
          <p>TYPE</p>
        </div>

        <div className="divide-y divide-black/10 border-b border-black/15">
          {sortedSongs.map((song) => (
            <Link
              key={song.id}
              href={`/songs/${song.id}`}
              className="grid gap-1.5 py-3 transition hover:bg-black/[0.03] md:grid-cols-[110px_1fr_180px_90px] md:items-center md:gap-4"
            >
              <div className="flex items-center justify-between gap-3 md:block">
                <time className="text-xs tabular-nums text-black/45">
                  {song.first_date ?? "----.--.--"}
                </time>

                <p className="text-xs uppercase tracking-[0.1em] text-black/45 md:hidden">
                  {song.song_type ?? "-"}
                </p>
              </div>

              <div
                className="min-w-0 truncate text-sm font-medium tracking-[0.01em] text-black md:hidden"
                title={`${song.title}${song.artist_credit ? ` / ${song.artist_credit}` : ""}`}
              >
                {song.title}
                {song.artist_credit && (
                  <span className="text-xs font-normal text-black/45">
                    {" "}
                    / {song.artist_credit}
                  </span>
                )}
                {song.verification_status &&
                  song.verification_status !== "confirmed" && (
                    <span className="ml-2 text-[10px] font-normal text-black/45">
                      要確認
                    </span>
                  )}
              </div>

              <div className="hidden min-w-0 md:block">
                <div className="flex min-w-0 items-baseline gap-2">
                  <p className="truncate text-sm font-medium tracking-[0.01em] text-black">
                    {song.title}
                  </p>

                  {song.verification_status &&
                    song.verification_status !== "confirmed" && (
                      <span className="shrink-0 border border-black/20 px-1.5 py-0.5 text-[10px] tracking-[0.06em] text-black/50">
                        要確認
                      </span>
                    )}
                </div>
              </div>

              <p className="hidden truncate text-xs text-black/45 md:block">
                {song.artist_credit ?? "-"}
              </p>

              <p className="hidden text-xs uppercase tracking-[0.1em] text-black/45 md:block">
                {song.song_type ?? "-"}
              </p>
            </Link>
          ))}

          {sortedSongs.length === 0 && (
            <div className="py-10 text-sm text-black/50">
              条件に一致する楽曲がありません。
            </div>
          )}
        </div>
      </section>
    </>
  );
}