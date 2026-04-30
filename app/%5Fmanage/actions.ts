"use server";

import { redirect } from "next/navigation";
import { clearAdminSession, setAdminSession } from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";

export async function loginAdmin(formData: FormData) {
  const password = String(formData.get("password") ?? "");

  if (!process.env.ADMIN_PASSWORD) {
    throw new Error("ADMIN_PASSWORD is not set.");
  }

  if (password !== process.env.ADMIN_PASSWORD) {
    redirect("/_manage/login?error=1");
  }

  await setAdminSession();

  redirect("/_manage");
}

export async function logoutAdmin() {
  await clearAdminSession();

  redirect("/_manage/login");
}

function getNullableString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  return value.length > 0 ? value : null;
}

function getRequiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

export async function updateSong(songId: number, formData: FormData) {
  const payload = {
    title: getNullableString(formData, "title"),
    title_kana: getNullableString(formData, "title_kana"),
    sort_title: getNullableString(formData, "sort_title"),
    song_type: getNullableString(formData, "song_type"),
    artist_credit: getNullableString(formData, "artist_credit"),
    first_date: getNullableString(formData, "first_date"),
    first_source: getNullableString(formData, "first_source"),
    first_full_date: getNullableString(formData, "first_full_date"),
    first_full_source: getNullableString(formData, "first_full_source"),
    tie_up: getNullableString(formData, "tie_up"),
    album_text: getNullableString(formData, "album_text"),
    hero_image_url: getNullableString(formData, "hero_image_url"),
    original_artist: getNullableString(formData, "original_artist"),
    original_vocal: getNullableString(formData, "original_vocal"),
    original_lyricist: getNullableString(formData, "original_lyricist"),
    original_composer: getNullableString(formData, "original_composer"),
    original_arranger: getNullableString(formData, "original_arranger"),
    notes: getNullableString(formData, "notes"),
    verification_status: getNullableString(formData, "verification_status"),
    verification_note: getNullableString(formData, "verification_note"),
  };

  if (!payload.title) {
    throw new Error("title is required.");
  }

  const { error } = await supabaseAdmin
    .from("songs")
    .update(payload)
    .eq("id", songId);

  if (error) {
    throw new Error("楽曲データの更新に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/edit?saved=1`);
}

export async function createSongLink(songId: number, formData: FormData) {
  const payload = {
    target_type: "song",
    target_id: songId,
    link_type: getRequiredString(formData, "link_type"),
    label: getNullableString(formData, "label"),
    title: getNullableString(formData, "title"),
    site_name: getNullableString(formData, "site_name"),
    url: getRequiredString(formData, "url"),
    published_date: getNullableString(formData, "published_date"),
    notes: getNullableString(formData, "notes"),
    thumbnail_url: getNullableString(formData, "thumbnail_url"),
  };

  const { error } = await supabaseAdmin.from("links").insert(payload);

  if (error) {
    throw new Error("関連リンクの追加に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/links?saved=1`);
}

export async function updateSongLink(
  linkId: number,
  songId: number,
  formData: FormData
) {
  const payload = {
    link_type: getRequiredString(formData, "link_type"),
    label: getNullableString(formData, "label"),
    title: getNullableString(formData, "title"),
    site_name: getNullableString(formData, "site_name"),
    url: getRequiredString(formData, "url"),
    published_date: getNullableString(formData, "published_date"),
    notes: getNullableString(formData, "notes"),
    thumbnail_url: getNullableString(formData, "thumbnail_url"),
  };

  const { error } = await supabaseAdmin
    .from("links")
    .update(payload)
    .eq("id", linkId)
    .eq("target_type", "song")
    .eq("target_id", songId);

  if (error) {
    throw new Error("関連リンクの更新に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/links?saved=1`);
}

export async function deleteSongLink(linkId: number, songId: number) {
  const { error } = await supabaseAdmin
    .from("links")
    .delete()
    .eq("id", linkId)
    .eq("target_type", "song")
    .eq("target_id", songId);

  if (error) {
    throw new Error("関連リンクの削除に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/links?saved=1`);
}