import { supabaseAdmin } from "@/lib/supabase/admin";

export async function getManageReleaseNavigation(releaseId: number) {
  const { data, error } = await supabaseAdmin
    .from("releases")
    .select("id,title,release_date")
    .order("release_date", { ascending: false, nullsFirst: false })
    .order("id", { ascending: false });

  if (error) {
    throw new Error("前後のリリース情報の取得に失敗しました。");
  }

  const releases = data ?? [];
  const index = releases.findIndex((release) => release.id === releaseId);

  return {
    previousRelease: index > 0 ? releases[index - 1] : null,
    nextRelease: index >= 0 && index < releases.length - 1 ? releases[index + 1] : null,
  };
}
