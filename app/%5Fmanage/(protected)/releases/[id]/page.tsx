import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

type PageProps = {
  params: Promise<{
    id: string;
  }>;
};

type ReleaseOverview = {
  id: number;
  title: string | null;
  title_kana: string | null;
  release_type: string | null;
  artist_credit: string | null;
  release_date: string | null;
  edition_name: string | null;
  is_primary_edition: boolean | null;
  release_group_id: number | null;
  release_groups: {
    id: number;
    title: string | null;
    tagline: string | null;
  } | null;
};

type GroupEdition = {
  id: number;
  title: string | null;
  edition_name: string | null;
  release_type: string | null;
  is_primary_edition: boolean | null;
};

function formatValue(value: string | null) {
  return value?.trim() || "未入力";
}

function formatDate(value: string | null) {
  return value ? value.replaceAll("-", ".") : "未入力";
}

function formatType(value: string | null) {
  return value?.replaceAll("_", " ").toUpperCase() || "未設定";
}

export default async function ManageReleaseOverviewPage({ params }: PageProps) {
  const { id } = await params;
  const releaseId = Number(id);

  if (!Number.isInteger(releaseId)) {
    notFound();
  }

  const { data: release, error } = await supabaseAdmin
    .from("releases")
    .select(
      "id,title,title_kana,release_type,artist_credit,release_date,edition_name,is_primary_edition,release_group_id,release_groups(id,title,tagline)"
    )
    .eq("id", releaseId)
    .single<ReleaseOverview>();

  if (error || !release) {
    notFound();
  }

  const [{ data: groupEditions }, { count: itemCount }] = await Promise.all([
    release.release_group_id
      ? supabaseAdmin
          .from("releases")
          .select("id,title,edition_name,release_type,is_primary_edition")
          .eq("release_group_id", release.release_group_id)
          .order("is_primary_edition", { ascending: false })
          .order("id", { ascending: true })
          .returns<GroupEdition[]>()
      : Promise.resolve({ data: [] as GroupEdition[] }),
    supabaseAdmin
      .from("release_items")
      .select("id", { count: "exact", head: true })
      .eq("release_id", releaseId),
  ]);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <header className="border-b border-black/15 pb-8">
        <div className="flex flex-wrap items-center gap-4">
          <Link href="/_manage/releases" className="text-xs text-black/45 transition hover:text-black">
            リリース一覧へ戻る
          </Link>
          <Link href={`/releases/${release.id}`} target="_blank" className="text-xs text-black/45 transition hover:text-black">
            公開ページを見る ↗
          </Link>
        </div>
        <p className="section-label mt-8 text-black/45">RELEASE / OVERVIEW</p>
        <p className="mt-4 text-xs text-black/45">
          作品: {formatValue(release.release_groups?.title ?? null)}
        </p>
        <h1 className="font-serif-jp mt-2 text-3xl font-medium tracking-[0.02em] text-black md:text-5xl">
          {release.title ?? `#${release.id}`}
        </h1>
        <div className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-sm text-black/50">
          <span>{formatValue(release.edition_name)}</span>
          <span>{formatType(release.release_type)}</span>
          <span>{formatDate(release.release_date)}</span>
        </div>
      </header>

      <section className="mt-8 grid gap-4 sm:grid-cols-3">
        <div className="border border-black/20 bg-black/[0.02] p-5">
          <p className="section-label text-black/40">登録内容</p>
          <p className="mt-3 text-sm text-black/70">各項目の鉛筆アイコンから編集できます</p>
        </div>
        <Link href={`/_manage/releases/${release.id}/items`} className="border border-black/20 p-5 transition hover:border-black/50 hover:bg-black/[0.02]">
          <p className="section-label text-black/40">収録曲</p>
          <p className="mt-3 text-sm text-black/70">{itemCount ?? 0}曲を確認・編集 →</p>
        </Link>
        <div className="border border-black/20 bg-black/[0.02] p-5">
          <p className="section-label text-black/40">作品グループ</p>
          <p className="mt-3 text-sm text-black/70">
            {groupEditions?.length ?? 0}形態
          </p>
        </div>
      </section>

      <section className="mt-10">
        <div className="border-b border-black/15 pb-4">
          <p className="section-label text-black/45">EDITION</p>
          <h2 className="font-serif-jp mt-2 text-2xl text-black/80">この形態の情報</h2>
        </div>
        <dl className="mt-2">
          <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[150px_1fr] sm:gap-5">
            <dt className="text-xs text-black/45">タイトル（読み）</dt>
            <dd className="text-sm text-black/70">{formatValue(release.title_kana)}</dd>
          </div>
          <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[150px_1fr] sm:gap-5">
            <dt className="text-xs text-black/45">アーティスト表記</dt>
            <dd className="text-sm text-black/70">{formatValue(release.artist_credit)}</dd>
          </div>
          <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[150px_1fr] sm:gap-5">
            <dt className="text-xs text-black/45">代表形態</dt>
            <dd className="text-sm text-black/70">{release.is_primary_edition ? "はい" : "いいえ"}</dd>
          </div>
        </dl>
      </section>

      <section className="mt-10 border-t border-black/15 pt-8">
        <p className="section-label text-black/45">WORK</p>
        <h2 className="font-serif-jp mt-2 text-2xl text-black/80">
          {formatValue(release.release_groups?.title ?? null)}
        </h2>
        <p className="mt-3 text-sm leading-7 text-black/50">
          {formatValue(release.release_groups?.tagline ?? null)}
        </p>
        <p className="mt-5 text-xs leading-6 text-black/50">
          この作品に属する形態は、リリース一覧でまとめて確認できます。作品情報を変更すると、同じ作品の全形態に影響します。
        </p>
        <ul className="mt-4 space-y-2 border-t border-black/10 pt-4">
          {(groupEditions ?? []).map((edition) => (
            <li key={edition.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-black/60">
              <span className="text-xs text-black/35">#{edition.id}</span>
              <span>{edition.title ?? "無題"}</span>
              {edition.edition_name ? <span className="text-xs text-black/45">{edition.edition_name}</span> : null}
              {edition.id === release.id ? <span className="text-xs text-black/35">（現在）</span> : null}
            </li>
          ))}
        </ul>
      </section>
    </main>
  );
}
