import { notFound } from "next/navigation";
import {
  createSongLink,
  deleteSongLink,
  fetchSongLinkMetadata,
} from "@/app/%5Fmanage/actions";
import { supabaseAdmin } from "@/lib/supabase/admin";
import CreateSongLinkForm from "./CreateSongLinkForm";
import InlineLinkFieldEditor from "./InlineLinkFieldEditor";
import { LINK_TYPE_OPTIONS } from "@/app/%5Fmanage/options";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams?: Promise<{
    saved?: string;
  }>;
};

type Song = {
  id: number;
  title: string | null;
  artist_credit: string | null;
  first_date: string | null;
  first_source: string | null;
  first_full_date: string | null;
  first_full_source: string | null;
};

type SongLink = {
  id: number;
  link_type: string | null;
  label: string | null;
  title: string | null;
  site_name: string | null;
  url: string | null;
  published_date: string | null;
  notes: string | null;
  thumbnail_url: string | null;
  created_at: string | null;
};

function formatReferenceDate(date: string | null) {
  if (!date) {
    return "----.--.--";
  }

  return date.replaceAll("-", ".");
}

function ReleaseReferenceRow({
  label,
  date,
  source,
}: {
  label: string;
  date: string | null;
  source: string | null;
}) {
  const hasDate = Boolean(date);
  const hasSource = Boolean(source && source.trim() && source.trim() !== "-");

  return (
    <div className="grid gap-1 border-b border-black/10 py-2 md:grid-cols-[120px_120px_1fr] md:gap-4">
      <p className="font-mono text-[10px] tracking-[0.2em] text-black/40">
        {label}
      </p>
      <p className="text-xs tabular-nums text-black/55">
        {hasDate ? formatReferenceDate(date) : "日付なし"}
      </p>
      <p className="min-w-0 text-xs leading-5 text-black/55">
        {hasSource ? source : "初出情報なし"}
      </p>
    </div>
  );
}

function ReleaseReference({ song }: { song: Song }) {
  return (
    <section className="grid gap-3 border border-black/15 p-4">
      <div>
        <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
          RELEASE REFERENCE
        </p>
        <p className="mt-1 text-xs leading-5 text-black/45">
          関連リンクの投稿日を入力するときの参照用です。
        </p>
      </div>

      <div>
        <ReleaseReferenceRow
          label="FIRST"
          date={song.first_date}
          source={song.first_source}
        />
        <ReleaseReferenceRow
          label="FIRST FULL"
          date={song.first_full_date}
          source={song.first_full_source}
        />
      </div>
    </section>
  );
}

export default async function ManageSongLinksPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const songId = Number(id);

  if (!Number.isInteger(songId)) {
    notFound();
  }

  const { data: song, error: songError } = await supabaseAdmin
    .from("songs")
    .select(
    "id, title, artist_credit, first_date, first_source, first_full_date, first_full_source"
    )
    .eq("id", songId)
    .single<Song>();

  if (songError || !song) {
    notFound();
  }

  const { data: links, error: linksError } = await supabaseAdmin
    .from("links")
    .select(
      "id, link_type, label, title, site_name, url, published_date, notes, thumbnail_url, created_at"
    )
    .eq("target_type", "song")
    .eq("target_id", songId)
    .order("published_date", { ascending: true, nullsFirst: false })
    .order("id", { ascending: true })
    .returns<SongLink[]>();

  if (linksError) {
    throw new Error("関連リンクの取得に失敗しました。");
  }

  const createAction = createSongLink.bind(null, songId);

  return (
    <>
        {resolvedSearchParams.saved ? <p className="border border-black/15 p-3 text-sm text-black/60">保存しました。</p> : null}

        <details className="group mt-8">
          <summary className="inline-flex cursor-pointer list-none items-center gap-2 border border-black px-4 py-2 text-sm text-black transition marker:hidden hover:bg-black hover:text-white">
            <span className="group-open:hidden">リンクを追加 ＋</span><span className="hidden group-open:inline">追加フォームを閉じる −</span>
          </summary>
          <section className="mt-5 grid gap-4 border border-black/15 p-5">
        <ReleaseReference song={song} />
        <div>
            <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
            ADD LINK
            </p>
            <h2 className="mt-1 font-serif text-xl">関連リンクを追加</h2>
        </div>

        <CreateSongLinkForm
            action={createAction}
            firstDate={song.first_date}
            firstFullDate={song.first_full_date}
        />
          </section>
        </details>

        <section className="mt-8 grid gap-4">
          <div>
            <p className="font-mono text-xs tracking-[0.28em] text-neutral-500">
              CURRENT LINKS
            </p>
            <h2 className="mt-1 font-serif text-xl">
              登録済みリンク：{links.length}件
            </h2>
          </div>

          {links.length === 0 ? (
            <p className="border border-neutral-300 p-5 text-sm text-neutral-600">
              まだ関連リンクは登録されていません。
            </p>
          ) : (
            <div className="grid gap-5">
              {links.map((link) => {
                const deleteAction = deleteSongLink.bind(null, link.id, songId);

                const fetchMetadataAction = fetchSongLinkMetadata.bind(
                null,
                link.id,
                songId
                );

                return (
                  <details
                    key={link.id}
                    className="group border border-neutral-300"
                  >
                    <summary className="flex cursor-pointer list-none flex-wrap items-start justify-between gap-3 p-5 marker:hidden">
                      <div className="min-w-0">
                        <p className="text-xs text-neutral-500">
                          {link.link_type ?? "その他"}{link.site_name ? ` · ${link.site_name}` : ""}
                        </p>
                        <p className="mt-1 font-serif text-lg">
                          {link.title || link.label || link.url || "Untitled"}
                        </p>
                        {link.published_date ? <p className="mt-1 text-xs text-neutral-500">掲載日: {link.published_date}</p> : null}
                        {link.url ? (
                          <p className="mt-1 truncate text-xs text-neutral-500">
                            {link.url}
                          </p>
                        ) : null}
                      </div>

                      <span className="shrink-0 border border-neutral-300 px-3 py-2 text-xs text-neutral-500 group-open:bg-neutral-900 group-open:text-[#f5f5f2]">
                        鉛筆で編集
                      </span>
                    </summary>

                    <div className="grid gap-5 border-t border-neutral-200 p-5">
                      <div className="flex flex-wrap gap-2">
                        <form action={fetchMetadataAction}>
                          <button type="submit" className="border border-neutral-300 px-3 py-2 text-xs tracking-[0.18em] text-neutral-600 hover:border-neutral-900 hover:text-neutral-900">
                            メタデータ取得
                          </button>
                        </form>
                        <form action={deleteAction}>
                          <button type="submit" className="border border-red-300 px-3 py-2 text-xs tracking-[0.18em] text-red-700 hover:border-red-700">
                            削除
                          </button>
                        </form>
                      </div>
                      <dl className="grid gap-0 border-t border-black/10">
                        {([
                          ["種別", "link_type", link.link_type],
                          ["表示ラベル", "label", link.label],
                          ["タイトル", "title", link.title],
                          ["サイト名", "site_name", link.site_name],
                          ["URL", "url", link.url],
                          ["掲載日", "published_date", link.published_date],
                          ["サムネイルURL", "thumbnail_url", link.thumbnail_url],
                        ] satisfies Array<[string, string, string | null]>).map(([label, field, value]) => (
                          <div key={field} className="grid gap-2 border-b border-black/10 py-3 sm:grid-cols-[130px_1fr]">
                            <dt className="text-xs text-black/45">{label}</dt>
                            <dd>
                              <InlineLinkFieldEditor
                                linkId={link.id}
                                songId={songId}
                                field={field}
                                value={value}
                                options={field === "link_type" ? LINK_TYPE_OPTIONS : undefined}
                                inputType={field === "published_date" ? "date" : field === "url" || field === "thumbnail_url" ? "url" : "text"}
                              />
                            </dd>
                          </div>
                        ))}
                        <div className="grid gap-2 border-b border-black/10 py-3 sm:grid-cols-[130px_1fr]"><dt className="text-xs text-black/45">メモ</dt><dd><InlineLinkFieldEditor linkId={link.id} songId={songId} field="notes" value={link.notes} multiline /></dd></div>
                      </dl>
                    </div>
                  </details>
                );
              })}
            </div>
          )}
        </section>
    </>
  );
}
