import Link from "next/link";
import { Fragment } from "react";

const ARCHIVE_ONLY_SUFFIX = "(アーカイブ限定)";

export type LiveSetlistSongEntry = {
  id: string;
  kind: "song";
  setlistNoRaw: string;
  songTitleRaw: string;
  artistCreditRaw: string;
  noteRaw: string | null;
  songId?: number;
  componentSongs?: Array<{
    songId: number;
    title: string;
  }>;
};

export type LiveSetlistMarkerEntry = {
  id: string;
  kind: "marker";
  label: string;
};

export type LiveSetlistEntry =
  | LiveSetlistSongEntry
  | LiveSetlistMarkerEntry;

export type LiveSetlistTable = {
  id: string;
  tableIndexRaw: string;
  sectionLabelRaw: string | null;
  entries: LiveSetlistEntry[];
};

type LiveSetlistProps = {
  tables: LiveSetlistTable[];
};

function isArchiveOnlySong(entry: LiveSetlistEntry | undefined) {
  return (
    entry?.kind === "song" && entry.songTitleRaw.endsWith(ARCHIVE_ONLY_SUFFIX)
  );
}

function getSongDisplayTitle(entry: LiveSetlistSongEntry) {
  return isArchiveOnlySong(entry)
    ? entry.songTitleRaw.slice(0, -ARCHIVE_ONLY_SUFFIX.length).trimEnd()
    : entry.songTitleRaw;
}

function SetlistMarker({ label }: { label: string }) {
  return (
    <div
      role="separator"
      aria-label={label}
      className="flex items-center gap-3 py-4"
    >
      <div className="h-px flex-1 bg-black/15" />
      <p className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-black/40">
        {label}
      </p>
      <div className="h-px flex-1 bg-black/15" />
    </div>
  );
}

export default function LiveSetlist({ tables }: LiveSetlistProps) {
  if (tables.length === 0) {
    return (
      <p className="border-y border-black/10 py-4 text-sm text-black/35">
        セットリスト情報がありません。
      </p>
    );
  }

  return (
    <div className="grid gap-8">
      {tables.map((table) => (
        <div key={table.id}>
          {table.sectionLabelRaw ? (
            <div className="mb-3 flex items-center gap-3">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-black/45">
                {table.sectionLabelRaw}
              </p>
              <div className="h-px flex-1 bg-black/10" />
            </div>
          ) : tables.length > 1 ? (
            <div className="mb-3 flex items-center gap-3">
              <p className="font-mono text-xs font-medium tracking-[0.18em] text-black/45">
                SETLIST {table.tableIndexRaw}
              </p>
              <div className="h-px flex-1 bg-black/10" />
            </div>
          ) : null}

          <div className="divide-y divide-black/10 border-y border-black/10">
            {table.entries.map((entry, entryIndex) => {
              if (entry.kind === "marker") {
                return <SetlistMarker key={entry.id} label={entry.label} />;
              }

              const isLinkedSong = entry.songId !== undefined;
              const isArchiveOnly = isArchiveOnlySong(entry);
              const startsArchiveOnlyBlock =
                isArchiveOnly &&
                !isArchiveOnlySong(table.entries[entryIndex - 1]);
              const displayTitle = getSongDisplayTitle(entry);

              return (
                <Fragment key={entry.id}>
                  {startsArchiveOnlyBlock ? (
                    <SetlistMarker label="アーカイブ限定" />
                  ) : null}

                  <div className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[3.25rem_minmax(0,1fr)]">
                    <p className="font-mono text-xs tabular-nums tracking-[0.08em] text-black/35">
                      {entry.setlistNoRaw || "--"}
                    </p>

                    <div className="min-w-0">
                      {isLinkedSong ? (
                        <Link
                          href={`/songs/${entry.songId}`}
                          className="text-sm font-medium leading-6 text-black underline-offset-4 hover:underline sm:text-[15px]"
                        >
                          {displayTitle}
                        </Link>
                      ) : (
                        <p className="text-sm font-medium leading-6 text-black/40 sm:text-[15px]">
                          {displayTitle}
                        </p>
                      )}

                      <p className="mt-0.5 break-words text-xs leading-5 text-black/45">
                        {entry.artistCreditRaw || "-"}
                      </p>

                      {entry.componentSongs?.length ? (
                        <p className="mt-1 break-words text-xs leading-5 text-black/55">
                          <span className="text-black/35">構成曲: </span>
                          {entry.componentSongs.map((song, songIndex) => (
                            <Fragment key={song.songId}>
                              {songIndex > 0 ? " / " : null}
                              <Link
                                href={`/songs/${song.songId}`}
                                className="underline-offset-4 hover:underline"
                              >
                                {song.title}
                              </Link>
                            </Fragment>
                          ))}
                        </p>
                      ) : null}

                      {entry.noteRaw ? (
                        <p className="mt-1 text-xs leading-5 text-black/35">
                          {entry.noteRaw}
                        </p>
                      ) : null}
                    </div>
                  </div>
                </Fragment>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
