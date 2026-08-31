import Link from "next/link";
import { notFound } from "next/navigation";
import { deleteRelease, duplicateRelease } from "@/app/%5Fmanage/actions";
import { RELEASE_TYPE_OPTIONS } from "@/app/%5Fmanage/options";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  InlineReleaseFieldEditor,
  InlineReleaseGroupFieldEditor,
  InlineReleaseGroupSelectEditor,
  InlineReleasePrimaryEditor,
} from "./InlineReleaseEditors";

type PageProps = {
  params: Promise<{ id: string }>;
  searchParams?: Promise<{ saved?: string }>;
};

type ReleaseOverview = {
  id: number;
  title: string | null;
  title_kana: string | null;
  sort_title: string | null;
  release_type: string | null;
  artist_credit: string | null;
  release_date: string | null;
  jacket_image_url: string | null;
  official_url: string | null;
  notes: string | null;
  edition_name: string | null;
  is_primary_edition: boolean | null;
  release_group_id: number | null;
  release_groups: {
    id: number;
    title: string | null;
    title_kana: string | null;
    sort_title: string | null;
    release_date: string | null;
    tagline: string | null;
    notes: string | null;
  } | null;
};

type GroupEdition = {
  id: number;
  title: string | null;
  edition_name: string | null;
  release_type: string | null;
  is_primary_edition: boolean | null;
};

function InfoRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b border-black/10 py-4 sm:grid-cols-[160px_1fr] sm:items-start sm:gap-5">
      <dt className="text-xs text-black/45">{label}</dt>
      <dd>{children}</dd>
    </div>
  );
}

export default async function ManageReleaseOverviewPage({ params, searchParams }: PageProps) {
  const { id } = await params;
  const { saved } = searchParams ? await searchParams : {};
  const releaseId = Number(id);

  if (!Number.isInteger(releaseId)) {
    notFound();
  }

  const { data: release, error } = await supabaseAdmin
    .from("releases")
    .select("id,title,title_kana,sort_title,release_type,artist_credit,release_date,jacket_image_url,official_url,notes,edition_name,is_primary_edition,release_group_id,release_groups(id,title,title_kana,sort_title,release_date,tagline,notes)")
    .eq("id", releaseId)
    .single<ReleaseOverview>();

  if (error || !release) {
    notFound();
  }

  const [{ data: groupEditions }, { count: itemCount }, { data: releaseGroups }] = await Promise.all([
    release.release_group_id
      ? supabaseAdmin.from("releases").select("id,title,edition_name,release_type,is_primary_edition").eq("release_group_id", release.release_group_id).order("is_primary_edition", { ascending: false }).order("id").returns<GroupEdition[]>()
      : Promise.resolve({ data: [] as GroupEdition[] }),
    supabaseAdmin.from("release_items").select("id", { count: "exact", head: true }).eq("release_id", release.id),
    supabaseAdmin.from("release_groups").select("id,title").order("title"),
  ]);

  const duplicateAction = duplicateRelease.bind(null, release.id);
  const deleteAction = deleteRelease.bind(null, release.id);

  return (
    <>
      {saved ? <p className="mt-5 border border-black/15 p-3 text-sm text-black/60">保存しました。</p> : null}

      <section className="mt-10">
        <div className="flex items-baseline justify-between border-b border-black/15 pb-4">
          <div>
            <p className="section-label text-black/45">EDITION</p>
            <h2 className="font-serif-jp mt-2 text-2xl text-black/80">この形態の登録内容</h2>
          </div>
          <p className="text-xs text-black/35">ID #{release.id}</p>
        </div>

        <dl className="mt-2">
          <InfoRow label="タイトル"><InlineReleaseFieldEditor releaseId={release.id} field="title" value={release.title} /></InfoRow>
          <InfoRow label="タイトル（読み）"><InlineReleaseFieldEditor releaseId={release.id} field="title_kana" value={release.title_kana} /></InfoRow>
          <InfoRow label="並び替え用タイトル"><InlineReleaseFieldEditor releaseId={release.id} field="sort_title" value={release.sort_title} /></InfoRow>
          <InfoRow label="リリース種別"><InlineReleaseFieldEditor releaseId={release.id} field="release_type" value={release.release_type} options={RELEASE_TYPE_OPTIONS} /></InfoRow>
          <InfoRow label="アーティスト表記"><InlineReleaseFieldEditor releaseId={release.id} field="artist_credit" value={release.artist_credit} /></InfoRow>
          <InfoRow label="発売日"><InlineReleaseFieldEditor releaseId={release.id} field="release_date" value={release.release_date} inputType="date" /></InfoRow>
          <InfoRow label="形態名"><InlineReleaseFieldEditor releaseId={release.id} field="edition_name" value={release.edition_name} /></InfoRow>
          <InfoRow label="代表形態"><InlineReleasePrimaryEditor releaseId={release.id} value={release.is_primary_edition} /></InfoRow>
          <InfoRow label="ジャケット画像URL"><InlineReleaseFieldEditor releaseId={release.id} field="jacket_image_url" value={release.jacket_image_url} inputType="url" /></InfoRow>
          <InfoRow label="公式URL"><InlineReleaseFieldEditor releaseId={release.id} field="official_url" value={release.official_url} inputType="url" /></InfoRow>
          <InfoRow label="管理メモ"><InlineReleaseFieldEditor releaseId={release.id} field="notes" value={release.notes} multiline /></InfoRow>
        </dl>
      </section>

      <section className="mt-10 border-t border-black/15 pt-8">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="section-label text-black/45">WORK / RELEASE GROUP</p>
            <h2 className="font-serif-jp mt-2 text-2xl text-black/80">作品共通情報</h2>
          </div>
          <p className="text-xs text-black/40">同一作品 {groupEditions?.length ?? 0}形態 · この形態の収録曲 {itemCount ?? 0}曲</p>
        </div>

        <div className="mt-4 border border-black/15 bg-black/[0.02] p-5">
          <p className="text-sm text-black/65">{release.release_group_id ? `作品グループ #${release.release_group_id}` : "作品グループ未設定"}</p>
          <div className="mt-3"><InlineReleaseGroupSelectEditor releaseId={release.id} currentGroupId={release.release_group_id} groups={releaseGroups ?? []} /></div>
          <p className="mt-3 text-xs leading-6 text-black/45">作品グループは同じ作品として扱う形態をまとめるための情報です。収録曲はこの形態単位で管理します。</p>
        </div>

        {release.release_groups ? (
          <dl className="mt-4">
            <InfoRow label="作品名"><InlineReleaseGroupFieldEditor releaseId={release.id} releaseGroupId={release.release_groups.id} field="title" value={release.release_groups.title} /></InfoRow>
            <InfoRow label="作品名（読み）"><InlineReleaseGroupFieldEditor releaseId={release.id} releaseGroupId={release.release_groups.id} field="title_kana" value={release.release_groups.title_kana} /></InfoRow>
            <InfoRow label="並び替え用作品名"><InlineReleaseGroupFieldEditor releaseId={release.id} releaseGroupId={release.release_groups.id} field="sort_title" value={release.release_groups.sort_title} /></InfoRow>
            <InfoRow label="作品の発売日"><InlineReleaseGroupFieldEditor releaseId={release.id} releaseGroupId={release.release_groups.id} field="release_date" value={release.release_groups.release_date} inputType="date" /></InfoRow>
            <InfoRow label="キャッチコピー"><InlineReleaseGroupFieldEditor releaseId={release.id} releaseGroupId={release.release_groups.id} field="tagline" value={release.release_groups.tagline} /></InfoRow>
            <InfoRow label="作品メモ"><InlineReleaseGroupFieldEditor releaseId={release.id} releaseGroupId={release.release_groups.id} field="notes" value={release.release_groups.notes} multiline /></InfoRow>
          </dl>
        ) : null}

        {(groupEditions ?? []).length > 0 ? (
          <div className="mt-8">
            <p className="section-label text-black/45">同じ作品の形態</p>
            <ul className="mt-3 divide-y divide-black/10 border-y border-black/10">
              {(groupEditions ?? []).map((edition) => (
                <li key={edition.id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-sm">
                  <Link href={`/_manage/releases/${edition.id}`} className="text-black/70 hover:underline">{edition.title ?? `#${edition.id}`}</Link>
                  <span className="text-xs text-black/40">{edition.edition_name || "形態名未設定"}{edition.is_primary_edition ? " · 代表形態" : ""}{edition.id === release.id ? " · 現在表示中" : ""}</span>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>

      <section className="mt-10 border-t border-black/15 pt-8">
        <p className="section-label text-black/45">OPERATIONS</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <form action={duplicateAction}><button type="submit" className="border border-black/25 px-4 py-2 text-xs text-black/60 hover:border-black hover:text-black">同じ作品に形態を複製</button></form>
          <details>
            <summary className="cursor-pointer border border-red-900/25 px-4 py-2 text-xs text-red-900/60 marker:hidden hover:border-red-900">削除</summary>
            <form action={deleteAction} className="mt-3 max-w-md border border-red-900/20 p-4">
              <p className="text-xs leading-6 text-black/55">この形態を削除します。関連する収録曲への影響を確認してから実行してください。</p>
              <button type="submit" className="mt-3 border border-red-900/40 px-3 py-2 text-xs text-red-900/70 hover:bg-red-900 hover:text-white">削除を実行</button>
            </form>
          </details>
        </div>
      </section>
    </>
  );
}
