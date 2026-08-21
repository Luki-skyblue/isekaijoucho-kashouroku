import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getManageSongNavigation(songId: number) {
  const { data, error } = await supabaseAdmin
    .from("songs")
    .select("id,title,first_date")
    .order("first_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (error) throw new Error("前後の楽曲データの取得に失敗しました。");
  const index = (data ?? []).findIndex((song) => song.id === songId);
  return {
    previousSong: index > 0 ? data![index - 1] : null,
    nextSong: index >= 0 && index < (data?.length ?? 0) - 1 ? data![index + 1] : null,
  };
}
