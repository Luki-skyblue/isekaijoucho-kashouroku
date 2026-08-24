import Link from "next/link";

export type LiveSetlistSongEntry = {
  id: string;
  kind: "song";
  setlistNoRaw: string;
  songTitleRaw: string;
  artistCreditRaw: string;
  noteRaw: string | null;
  songId?: number;
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
            {table.entries.map((entry) => {
              if (entry.kind === "marker") {
                return (
                  <div
                    key={entry.id}
                    role="separator"
                    aria-label={entry.label}
                    className="flex items-center gap-3 py-4"
                  >
                    <div className="h-px flex-1 bg-black/15" />
                    <p className="shrink-0 font-mono text-[10px] tracking-[0.14em] text-black/40">
                      {entry.label}
                    </p>
                    <div className="h-px flex-1 bg-black/15" />
                  </div>
                );
              }

              const isLinkedSong = entry.songId !== undefined;

              return (
                <div
                  key={entry.id}
                  className="grid grid-cols-[2.75rem_minmax(0,1fr)] gap-3 py-3.5 sm:grid-cols-[3.25rem_minmax(0,1fr)]"
                >
                  <p className="font-mono text-xs tabular-nums tracking-[0.08em] text-black/35">
                    {entry.setlistNoRaw || "--"}
                  </p>

                  <div className="min-w-0">
                    {isLinkedSong ? (
                      <Link
                        href={`/songs/${entry.songId}`}
                        className="text-sm font-medium leading-6 text-black underline-offset-4 hover:underline sm:text-[15px]"
                      >
                        {entry.songTitleRaw}
                      </Link>
                    ) : (
                      <p className="text-sm font-medium leading-6 text-black/40 sm:text-[15px]">
                        {entry.songTitleRaw}
                      </p>
                    )}

                    <p className="mt-0.5 break-words text-xs leading-5 text-black/45">
                      {entry.artistCreditRaw || "-"}
                    </p>

                    {entry.noteRaw ? (
                      <p className="mt-1 text-xs leading-5 text-black/35">
                        {entry.noteRaw}
                      </p>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}
