import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  createSongDigitalRelease,
  deleteSongDigitalRelease,
  updateSongDigitalRelease,
} from "../../../../actions";
import ManageFormGuard from "../../../ManageFormGuard";
import { ManageSongHeader } from "../../../ManageSongTabs";
import { getManageSongNavigation } from "../../../songNavigation";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
  searchParams: Promise<{
    saved?: string;
    deleted?: string;
  }>;
};

type SongDigitalRelease = {
  id: number;
  song_id: number;
  title: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  official_url: string | null;
  notes: string | null;
};

function TextInput({
  name,
  label,
  defaultValue,
  type = "text",
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  type?: string;
}) {
  return (
    <label className="block">
      <span className="section-label text-black/45">{label}</span>

      <input
        name={name}
        type={type}
        defaultValue={defaultValue ?? ""}
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
  defaultValue?: string | null;
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

export default async function ManageSongDigitalReleasesPage({
  params,
  searchParams,
}: PageProps) {
  const { id } = await params;
  const { saved, deleted } = await searchParams;

  const songId = Number(id);

  if (!Number.isInteger(songId)) {
    notFound();
  }

  const { data: song, error: songError } = await supabaseAdmin
    .from("songs")
    .select("id,title")
    .eq("id", songId)
    .single();

  if (songError || !song) {
    notFound();
  }

  const { previousSong, nextSong } = await getManageSongNavigation(songId);

  const { data: digitalReleases, error: digitalReleasesError } =
    await supabaseAdmin
      .from("song_digital_releases")
      .select(
        "id,song_id,title,release_date,jacket_image_url,official_url,notes"
      )
      .eq("song_id", songId)
      .order("release_date", { ascending: true, nullsFirst: false })
      .order("id", { ascending: true })
      .returns<SongDigitalRelease[]>();

  if (digitalReleasesError) {
    throw new Error("配信リリース情報の取得に失敗しました。");
  }

  const createAction = createSongDigitalRelease.bind(null, songId);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <section className="hidden">
        <div className="flex flex-wrap items-center gap-4">
          <Link
            href={`/_manage/songs/${song.id}`}
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            楽曲概要へ戻る
          </Link>

          <Link
            href={`/songs/${song.id}`}
            target="_blank"
            className="text-xs font-medium tracking-[0.12em] text-black/45 transition hover:text-black"
          >
            公開ページを見る ↗
          </Link>
        </div>

        <h1 className="font-serif-jp mt-8 text-center text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          {song.title}
        </h1>

        <p className="mt-4 text-sm leading-7 text-black/55">
          この楽曲に紐づく単曲配信リリースを追加・編集します。
          同じ楽曲に複数の配信リリースを登録できます。
        </p>

        <p className="mt-3 text-sm text-black/45">
          {digitalReleases?.length ?? 0} DIGITAL RELEASES
        </p>

        {saved ? (
          <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">
            保存しました。
          </p>
        ) : null}

        {deleted ? (
          <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">
            削除しました。
          </p>
        ) : null}
      </section>

      <ManageSongHeader songId={song.id} title={song.title} previousSong={previousSong} nextSong={nextSong} active="digital" />

      {saved ? <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">保存しました。</p> : null}
      {deleted ? <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">削除しました。</p> : null}

      <section className="mt-10 border-b border-black/15 pb-10">
        <p className="section-label text-black/45">
          ADD DIGITAL RELEASE
        </p>

          <ManageFormGuard action={createAction} className="mt-5">
          <div className="grid gap-5 md:grid-cols-2">
            <TextInput
              name="digital_release_title"
              label="TITLE"
            />

            <TextInput
              name="digital_release_date"
              label="RELEASE DATE"
              type="date"
            />

            <TextInput
              name="digital_release_jacket_image_url"
              label="JACKET IMAGE URL"
            />

            <TextInput
              name="digital_release_official_url"
              label="OFFICIAL URL"
            />
          </div>

          <div className="mt-5">
            <TextArea
              name="digital_release_notes"
              label="NOTES"
              rows={4}
            />
          </div>

          <div className="mt-6">
            <button
              type="submit"
              className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
            >
              ADD DIGITAL RELEASE
            </button>
          </div>
          </ManageFormGuard>
      </section>

      <section className="mt-10">
        <p className="section-label text-black/45">
          EXISTING DIGITAL RELEASES
        </p>

        <div className="mt-5 space-y-8">
          {(digitalReleases ?? []).map((digitalRelease, index) => {
            const updateAction = updateSongDigitalRelease.bind(
              null,
              songId,
              digitalRelease.id
            );

            const deleteAction = deleteSongDigitalRelease.bind(
              null,
              songId,
              digitalRelease.id
            );

            return (
              <details
                key={digitalRelease.id}
                className="group border border-black/15"
              >
                <summary className="flex cursor-pointer list-none flex-col gap-3 px-5 py-4 marker:hidden sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="section-label text-black/35">
                      DIGITAL RELEASE {index + 1}
                    </p>

                    <p className="mt-2 text-sm font-medium text-black/75">
                      {digitalRelease.title ?? song.title}
                    </p>
                  </div>

                  <p className="text-xs tabular-nums text-black/35">
                    ID {digitalRelease.id}
                    {digitalRelease.release_date
                      ? ` / ${digitalRelease.release_date}`
                      : ""}
                  </p>
                  <span className="border border-black/20 px-3 py-1 text-xs text-black/45 group-open:bg-black group-open:text-[#f5f5f2]">
                    編集を開く
                  </span>
                </summary>

                <div className="grid gap-6 border-t border-black/10 p-5 md:grid-cols-[160px_minmax(0,1fr)]">
                  <div>
                    {digitalRelease.jacket_image_url ? (
                      <div className="flex aspect-square items-center justify-center overflow-hidden border border-black/10 bg-black/[0.02]">
                        <img
                          src={digitalRelease.jacket_image_url}
                          alt=""
                          loading="lazy"
                          decoding="async"
                          className="max-h-full max-w-full"
                        />
                      </div>
                    ) : (
                      <div className="aspect-square border border-black/10 bg-black/[0.02] p-4">
                        <p className="section-label text-black/25">
                          IMAGE
                        </p>
                        <p className="mt-2 text-xs leading-5 text-black/30">
                          情報がありません。
                        </p>
                      </div>
                    )}
                  </div>

                  <ManageFormGuard action={updateAction}>
                    <div className="grid gap-5 md:grid-cols-2">
                      <TextInput
                        name="digital_release_title"
                        label="TITLE"
                        defaultValue={digitalRelease.title}
                      />

                      <TextInput
                        name="digital_release_date"
                        label="RELEASE DATE"
                        type="date"
                        defaultValue={digitalRelease.release_date}
                      />

                      <TextInput
                        name="digital_release_jacket_image_url"
                        label="JACKET IMAGE URL"
                        defaultValue={digitalRelease.jacket_image_url}
                      />

                      <TextInput
                        name="digital_release_official_url"
                        label="OFFICIAL URL"
                        defaultValue={digitalRelease.official_url}
                      />
                    </div>

                    <div className="mt-5">
                      <TextArea
                        name="digital_release_notes"
                        label="NOTES"
                        defaultValue={digitalRelease.notes}
                        rows={4}
                      />
                    </div>

                    <div className="mt-6">
                      <button
                        type="submit"
                        className="border border-black px-5 py-3 text-xs font-medium tracking-[0.12em] text-black transition hover:bg-black hover:text-[#f5f5f2]"
                      >
                        UPDATE DIGITAL RELEASE
                      </button>
                    </div>
                  </ManageFormGuard>
                </div>

                <div className="border-t border-black/10 px-5 py-4">
                  <details>
                    <summary className="cursor-pointer text-xs font-medium tracking-[0.12em] text-black/40 transition hover:text-black">
                      DELETE
                    </summary>

                    <form action={deleteAction} className="mt-4">
                      <p className="text-sm leading-6 text-black/55">
                        この配信リリースだけを削除します。楽曲本体や他の配信リリースは削除されません。
                      </p>

                      <button
                        type="submit"
                        className="mt-4 border border-black/35 px-4 py-2 text-xs font-medium tracking-[0.12em] text-black/60 transition hover:border-black hover:bg-black hover:text-[#f5f5f2]"
                      >
                        CONFIRM DELETE
                      </button>
                    </form>
                  </details>
                </div>
              </details>
            );
          })}

          {(!digitalReleases || digitalReleases.length === 0) ? (
            <div className="border-y border-black/10 py-8">
              <p className="text-sm text-black/40">
                配信リリース情報はまだ登録されていません。
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
