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
    first_status: getNullableString(formData, "first_status") ?? "confirmed",
    first_full_status:
      getNullableString(formData, "first_full_status") ?? "confirmed",
    tie_up_status: getNullableString(formData, "tie_up_status") ?? "confirmed",
    album_text_status:
      getNullableString(formData, "album_text_status") ?? "confirmed",
    original_artist_status:
      getNullableString(formData, "original_artist_status") ?? "confirmed",
    original_vocal_status:
      getNullableString(formData, "original_vocal_status") ?? "confirmed",
    original_lyricist_status:
      getNullableString(formData, "original_lyricist_status") ?? "confirmed",
    original_composer_status:
      getNullableString(formData, "original_composer_status") ?? "confirmed",
    original_arranger_status:
      getNullableString(formData, "original_arranger_status") ?? "confirmed",
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

export async function createSong(formData: FormData) {
  const title = getNullableString(formData, "title");

  if (!title) {
    throw new Error("title is required.");
  }

  const payload = {
    title,
    title_kana: getNullableString(formData, "title_kana"),
    sort_title: getNullableString(formData, "sort_title"),
    song_type: getNullableString(formData, "song_type"),
    artist_credit: getNullableString(formData, "artist_credit"),
    first_date: getNullableString(formData, "first_date"),
    first_source: getNullableString(formData, "first_source"),

    verification_status: "confirmed",
    verification_note: null,

    first_status: "unverified",
    first_full_status: "unverified",
    tie_up_status: "unverified",
    album_text_status: "unverified",
    original_artist_status: "unverified",
    original_vocal_status: "unverified",
    original_lyricist_status: "unverified",
    original_composer_status: "unverified",
    original_arranger_status: "unverified",
  };

  const { data, error } = await supabaseAdmin
    .from("songs")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("楽曲データの作成に失敗しました。");
  }

  redirect(`/_manage/songs/${data.id}/edit?saved=1`);
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

function decodeHtmlEntities(value: string) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replaceAll("&apos;", "'")
    .trim();
}

function getAttribute(tag: string, attributeName: string) {
  const regex = new RegExp(`${attributeName}=["']([^"']*)["']`, "i");
  const match = tag.match(regex);

  return match ? decodeHtmlEntities(match[1]) : null;
}

function findMetaContent(html: string, names: string[]) {
  const metaTags = html.match(/<meta\s+[^>]*>/gi) ?? [];

  for (const tag of metaTags) {
    const property = getAttribute(tag, "property");
    const name = getAttribute(tag, "name");
    const content = getAttribute(tag, "content");

    if (!content) {
      continue;
    }

    const key = property || name;

    if (key && names.includes(key.toLowerCase())) {
      return content;
    }
  }

  return null;
}

function findTitleTag(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);

  return match ? decodeHtmlEntities(match[1].replace(/\s+/g, " ")) : null;
}

function makeAbsoluteUrl(value: string | null, baseUrl: string) {
  if (!value) {
    return null;
  }

  try {
    return new URL(value, baseUrl).toString();
  } catch {
    return null;
  }
}

function getHostname(url: string) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

async function fetchPageMetadata(url: string) {
  const parsedUrl = new URL(url);

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    throw new Error("http/https のURLのみ取得できます。");
  }

  const youtubeMetadata = await fetchYouTubeMetadata(url);

  if (youtubeMetadata) {
    return youtubeMetadata;
  }

  const response = await fetch(url, {
    headers: {
      "user-agent":
        "Mozilla/5.0 (compatible; KashourokuMetadataFetcher/1.0)",
      accept: "text/html,application/xhtml+xml",
    },
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error("リンク先の取得に失敗しました。");
  }

  const html = await response.text();

  const title =
    findMetaContent(html, ["og:title", "twitter:title"]) ||
    findTitleTag(html);

  const siteName =
    findMetaContent(html, ["og:site_name", "application-name"]) ||
    getHostname(url);

  const image =
    findMetaContent(html, ["og:image", "twitter:image", "twitter:image:src"]);

  return {
    title,
    site_name: siteName,
    thumbnail_url: makeAbsoluteUrl(image, url),
  };
}

function getYouTubeVideoId(url: string) {
  try {
    const parsedUrl = new URL(url);
    const hostname = parsedUrl.hostname.replace(/^www\./, "");

    if (
      hostname === "youtube.com" ||
      hostname === "m.youtube.com" ||
      hostname === "music.youtube.com"
    ) {
      if (parsedUrl.pathname === "/watch") {
        return parsedUrl.searchParams.get("v");
      }

      if (parsedUrl.pathname.startsWith("/shorts/")) {
        return parsedUrl.pathname.split("/")[2] || null;
      }

      if (parsedUrl.pathname.startsWith("/embed/")) {
        return parsedUrl.pathname.split("/")[2] || null;
      }
    }

    if (hostname === "youtu.be") {
      return parsedUrl.pathname.split("/")[1] || null;
    }

    return null;
  } catch {
    return null;
  }
}

function getYouTubeWatchUrl(videoId: string) {
  return `https://www.youtube.com/watch?v=${videoId}`;
}

function getYouTubeFallbackThumbnailUrl(videoId: string) {
  return `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
}

async function fetchYouTubeMetadata(url: string) {
  const videoId = getYouTubeVideoId(url);

  if (!videoId) {
    return null;
  }

  const watchUrl = getYouTubeWatchUrl(videoId);
  const oembedUrl = new URL("https://www.youtube.com/oembed");

  oembedUrl.searchParams.set("url", watchUrl);
  oembedUrl.searchParams.set("format", "json");

  try {
    const response = await fetch(oembedUrl.toString(), {
      headers: {
        accept: "application/json",
        "user-agent":
          "Mozilla/5.0 (compatible; KashourokuMetadataFetcher/1.0)",
      },
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      return {
        title: null,
        site_name: "YouTube",
        thumbnail_url: getYouTubeFallbackThumbnailUrl(videoId),
      };
    }

    const data = (await response.json()) as {
      title?: string;
      provider_name?: string;
      thumbnail_url?: string;
    };

    return {
      title: data.title?.trim() || null,
      site_name: data.provider_name?.trim() || "YouTube",
      thumbnail_url:
        data.thumbnail_url?.trim() || getYouTubeFallbackThumbnailUrl(videoId),
    };
  } catch {
    return {
      title: null,
      site_name: "YouTube",
      thumbnail_url: getYouTubeFallbackThumbnailUrl(videoId),
    };
  }
}

export async function fetchSongLinkMetadata(linkId: number, songId: number) {
  const { data: link, error: fetchLinkError } = await supabaseAdmin
    .from("links")
    .select("id, url")
    .eq("id", linkId)
    .eq("target_type", "song")
    .eq("target_id", songId)
    .single();

  if (fetchLinkError || !link?.url) {
    throw new Error("関連リンクのURL取得に失敗しました。");
  }

  const metadata = await fetchPageMetadata(link.url);

  const { error: updateError } = await supabaseAdmin
    .from("links")
    .update({
      title: metadata.title,
      site_name: metadata.site_name,
      thumbnail_url: metadata.thumbnail_url,
      fetched_at: new Date().toISOString(),
    })
    .eq("id", linkId)
    .eq("target_type", "song")
    .eq("target_id", songId);

  if (updateError) {
    throw new Error("メタ情報の保存に失敗しました。");
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