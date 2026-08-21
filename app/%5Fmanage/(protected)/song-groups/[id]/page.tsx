import Link from "next/link";
import { notFound } from "next/navigation";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ManageSongGroupPage({ params }: { params: Promise<{ id: string }> }) {
  const id = Number((await params).id);
  if (!Number.isInteger(id)) notFound();
  const [{ data: group }, { data: songs }] = await Promise.all([
    supabaseAdmin.from("song_groups").select("id,title,title_kana,sort_title").eq("id", id).single(),
    supabaseAdmin.from("songs").select("id,title,title_kana,version_name,version_type,is_primary_version,first_date").eq("song_group_id", id).order("is_primary_version", { ascending: false }).order("id"),
  ]);
  if (!group || !songs) notFound();
  return <main className="mx-auto max-w-5xl px-6 py-12"><div className="flex flex-wrap gap-4"><Link href="/_manage/song-groups" className="text-xs text-black/45 hover:text-black">楽曲グループ一覧へ戻る</Link><Link href="/_manage/songs" className="text-xs text-black/45 hover:text-black">楽曲一覧へ戻る</Link></div><header className="mt-8 border-b border-black/15 pb-8"><p className="section-label text-black/45">楽曲グループ</p><h1 className="font-serif-jp mt-3 text-3xl text-black md:text-5xl">{group.title ?? `グループ #${group.id}`}</h1><p className="mt-4 text-sm text-black/50">{songs.length}曲 · グループ #{group.id}</p></header><section className="mt-8"><div className="flex items-end justify-between border-b border-black/15 pb-4"><div><p className="section-label text-black/45">MEMBERS</p><h2 className="font-serif-jp mt-2 text-2xl text-black/80">所属する楽曲</h2></div><span className="text-xs text-black/40">各楽曲の概要から編集</span></div><ul className="mt-2 divide-y divide-black/10">{songs.map((song) => <li key={song.id} className="flex flex-wrap items-center justify-between gap-3 py-4"><div><p className="text-sm text-black/75">{song.title ?? `#${song.id}`}</p><p className="mt-1 text-xs text-black/45">{song.version_name ?? "バージョン名未設定"}{song.is_primary_version ? " · 代表" : ""}</p></div><Link href={`/_manage/songs/${song.id}`} className="text-xs text-black/55 underline underline-offset-4 hover:text-black">概要を開く →</Link></li>)}</ul></section></main>;
}
