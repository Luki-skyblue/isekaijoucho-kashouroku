import Link from "next/link";
import { supabaseAdmin } from "@/lib/supabase/admin";

export default async function ManageSongGroupsPage() {
  const [{ data: groups }, { data: songs }] = await Promise.all([
    supabaseAdmin.from("song_groups").select("id,title,title_kana").order("title"),
    supabaseAdmin.from("songs").select("id,title,song_group_id,version_name,is_primary_version").not("song_group_id", "is", null),
  ]);
  const counts = new Map<number, number>();
  for (const song of songs ?? []) counts.set(song.song_group_id, (counts.get(song.song_group_id) ?? 0) + 1);
  const multiGroups = (groups ?? []).filter((group) => (counts.get(group.id) ?? 0) > 1);
  return <main className="mx-auto max-w-6xl px-6 py-12"><Link href="/_manage" className="text-xs text-black/45 hover:text-black">管理ホームへ戻る</Link><header className="mt-8 border-b border-black/15 pb-8"><p className="section-label text-black/45">複数バージョンの管理</p><h1 className="font-serif-jp mt-3 text-3xl text-black md:text-5xl">楽曲グループ</h1><p className="mt-4 text-sm leading-7 text-black/55">複数のバージョンが登録されているグループだけを表示しています。</p></header><div className="mt-8 grid gap-3">{multiGroups.map((group) => <Link key={group.id} href={`/_manage/song-groups/${group.id}`} className="border border-black/15 p-5 transition hover:border-black/45 hover:bg-black/[0.02]"><p className="text-sm text-black/75">{group.title ?? "名称未設定"}</p><p className="mt-2 text-xs text-black/45">{counts.get(group.id)}曲 · グループ #{group.id}</p></Link>)}{multiGroups.length === 0 ? <p className="border border-black/15 p-5 text-sm text-black/50">複数バージョンのグループはありません。</p> : null}</div></main>;
}
