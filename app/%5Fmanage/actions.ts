"use server";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  clearAdminSession,
  isAdminLoggedIn,
  setAdminSession,
} from "@/lib/adminAuth";
import { supabaseAdmin } from "@/lib/supabase/admin";
import {
  DISCOVERY_CATEGORY_OPTIONS,
  isManageOptionValue,
  LINK_TYPE_OPTIONS,
  RELEASE_TYPE_OPTIONS,
  SONG_TYPE_OPTIONS,
} from "./options";

async function requireAdmin() {
  if (!(await isAdminLoggedIn())) {
    redirect("/_manage/login");
  }
}

function isPrivateIpAddress(address: string) {
  const version = isIP(address);

  if (version === 4) {
    const octets = address.split(".").map(Number);
    const [first, second] = octets;

    return (
      first === 0 ||
      first === 10 ||
      first === 127 ||
      (first === 100 && second >= 64 && second <= 127) ||
      (first === 169 && second === 254) ||
      (first === 172 && second >= 16 && second <= 31) ||
      (first === 192 && second === 168) ||
      (first === 198 && (second === 18 || second === 19)) ||
      first >= 224
    );
  }

  const normalized = address.toLowerCase();

  if (normalized.startsWith("::ffff:")) {
    return isPrivateIpAddress(normalized.slice(7));
  }

  return (
    normalized === "::" ||
    normalized === "::1" ||
    normalized.startsWith("fc") ||
    normalized.startsWith("fd") ||
    normalized.startsWith("fe8") ||
    normalized.startsWith("fe9") ||
    normalized.startsWith("fea") ||
    normalized.startsWith("feb") ||
    normalized.startsWith("ff")
  );
}

async function assertPublicHttpUrl(value: string) {
  const parsedUrl = new URL(value);

  if (![
    "http:",
    "https:",
  ].includes(parsedUrl.protocol)) {
    throw new Error("http/https のURLのみ取得できます。");
  }

  if (
    parsedUrl.username ||
    parsedUrl.password ||
    (parsedUrl.port && !["80", "443"].includes(parsedUrl.port))
  ) {
    throw new Error("安全に取得できないURLです。");
  }

  const hostname = parsedUrl.hostname.toLowerCase().replace(/\.$/, "");

  if (
    hostname === "localhost" ||
    hostname.endsWith(".localhost") ||
    hostname.endsWith(".local") ||
    hostname.endsWith(".internal")
  ) {
    throw new Error("内部ネットワークのURLは取得できません。");
  }

  if (isPrivateIpAddress(hostname)) {
    throw new Error("内部ネットワークのURLは取得できません。");
  }

  try {
    const addresses = await lookup(hostname, { all: true, verbatim: true });

    if (!addresses.length || addresses.some(({ address }) => isPrivateIpAddress(address))) {
      throw new Error("内部ネットワークのURLは取得できません。");
    }
  } catch {
    throw new Error("URLの安全性を確認できませんでした。");
  }
}

function getNullableHttpUrl(formData: FormData, key: string) {
  const value = getNullableString(formData, key);

  if (!value) {
    return null;
  }

  try {
    const parsedUrl = new URL(value);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error();
    }

    return parsedUrl.toString();
  } catch {
    throw new Error(`${key} must be an http/https URL.`);
  }
}

function getRequiredHttpUrl(formData: FormData, key: string) {
  const value = getRequiredString(formData, key);

  try {
    const parsedUrl = new URL(value);

    if (!["http:", "https:"].includes(parsedUrl.protocol)) {
      throw new Error();
    }

    return parsedUrl.toString();
  } catch {
    throw new Error(`${key} must be an http/https URL.`);
  }
}

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

function getNullableNumber(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    return null;
  }

  const numberValue = Number(value);

  if (!Number.isFinite(numberValue)) {
    return null;
  }

  return numberValue;
}

function getRequiredString(formData: FormData, key: string) {
  const value = String(formData.get(key) ?? "").trim();

  if (!value) {
    throw new Error(`${key} is required.`);
  }

  return value;
}

export async function updateSong(songId: number, formData: FormData) {
  await requireAdmin();

  const section = getNullableString(formData, "save_section");

  const fullPayload = {
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
    hero_image_url: getNullableHttpUrl(formData, "hero_image_url"),
    original_artist: getNullableString(formData, "original_artist"),
    original_vocal: getNullableString(formData, "original_vocal"),
    original_lyricist: getNullableString(formData, "original_lyricist"),
    original_composer: getNullableString(formData, "original_composer"),
    original_arranger: getNullableString(formData, "original_arranger"),
    notes: getNullableString(formData, "notes"),
    verification_status: getNullableString(formData, "verification_status"),
    verification_note: getNullableString(formData, "verification_note"),
    first_status: getNullableString(formData, "first_status"),
    first_full_status: getNullableString(formData, "first_full_status"),
    tie_up_status: getNullableString(formData, "tie_up_status"),
    album_text_status: getNullableString(formData, "album_text_status"),
    original_artist_status: getNullableString(formData, "original_artist_status"),
    original_vocal_status: getNullableString(formData, "original_vocal_status"),
    original_lyricist_status: getNullableString(formData, "original_lyricist_status"),
    original_composer_status: getNullableString(formData, "original_composer_status"),
    original_arranger_status: getNullableString(formData, "original_arranger_status"),
    song_group_id: getNullableNumber(formData, "song_group_id"),
    version_name: getNullableString(formData, "version_name"),
    version_type: getNullableString(formData, "version_type") ?? "standard",
    is_primary_version: formData.get("is_primary_version") === "on",
  };

  const sectionFields: Record<string, (keyof typeof fullPayload)[]> = {
    basic: [
      "title",
      "title_kana",
      "sort_title",
      "song_type",
      "artist_credit",
      "hero_image_url",
    ],
    version: [
      "song_group_id",
      "version_name",
      "version_type",
      "is_primary_version",
    ],
    release: [
      "first_date",
      "first_source",
      "first_full_date",
      "first_full_source",
      "tie_up",
      "first_status",
      "first_full_status",
      "tie_up_status",
    ],
    credits: [
      "original_artist",
      "original_vocal",
      "original_lyricist",
      "original_composer",
      "original_arranger",
      "original_artist_status",
      "original_vocal_status",
      "original_lyricist_status",
      "original_composer_status",
      "original_arranger_status",
    ],
    text: ["album_text", "album_text_status", "notes"],
    verification: ["verification_status", "verification_note"],
  };

  const payload = section && sectionFields[section]
    ? Object.fromEntries(
        sectionFields[section].map((field) => [field, fullPayload[field]])
      )
    : fullPayload;

  if ((!section || section === "basic") && !fullPayload.title) {
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

export async function createSongDigitalRelease(
  songId: number,
  formData: FormData
) {
  await requireAdmin();

  const payload = {
    song_id: songId,
    title: getNullableString(formData, "digital_release_title"),
    release_date: getNullableString(formData, "digital_release_date"),
    jacket_image_url: getNullableString(
      formData,
      "digital_release_jacket_image_url"
    ),
    official_url: getNullableHttpUrl(formData, "digital_release_official_url"),
    notes: getNullableString(formData, "digital_release_notes"),
  };

  const hasAnyValue =
    payload.title ||
    payload.release_date ||
    payload.jacket_image_url ||
    payload.official_url ||
    payload.notes;

  if (!hasAnyValue) {
    throw new Error("配信リリース情報を1項目以上入力してください。");
  }

  const { error } = await supabaseAdmin
    .from("song_digital_releases")
    .insert(payload);

  if (error) {
    throw new Error("配信リリース情報の作成に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/digital-releases?saved=1`);
}

export async function updateSongDigitalRelease(
  songId: number,
  digitalReleaseId: number,
  formData: FormData
) {
  await requireAdmin();

  const payload = {
    title: getNullableString(formData, "digital_release_title"),
    release_date: getNullableString(formData, "digital_release_date"),
    jacket_image_url: getNullableString(
      formData,
      "digital_release_jacket_image_url"
    ),
    official_url: getNullableHttpUrl(formData, "digital_release_official_url"),
    notes: getNullableString(formData, "digital_release_notes"),
  };

  const hasAnyValue =
    payload.title ||
    payload.release_date ||
    payload.jacket_image_url ||
    payload.official_url ||
    payload.notes;

  if (!hasAnyValue) {
    throw new Error(
      "全項目を空にする場合は、更新ではなく削除を使用してください。"
    );
  }

  const { error } = await supabaseAdmin
    .from("song_digital_releases")
    .update(payload)
    .eq("id", digitalReleaseId)
    .eq("song_id", songId);

  if (error) {
    throw new Error("配信リリース情報の更新に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/digital-releases?saved=1`);
}

export async function updateSongDigitalReleaseInlineField(
  songId: number,
  digitalReleaseId: number,
  field: string,
  value: string,
) {
  await requireAdmin();

  const allowedFields = new Set([
    "title",
    "release_date",
    "jacket_image_url",
    "official_url",
    "notes",
  ]);

  if (!Number.isInteger(songId) || !Number.isInteger(digitalReleaseId) || !allowedFields.has(field)) {
    throw new Error("編集項目が不正です。");
  }

  const normalized = value.trim();
  if ((field === "jacket_image_url" || field === "official_url") && normalized) {
    await assertPublicHttpUrl(normalized);
  }

  const { data: current, error: currentError } = await supabaseAdmin
    .from("song_digital_releases")
    .select("title,release_date,jacket_image_url,official_url,notes")
    .eq("id", digitalReleaseId)
    .eq("song_id", songId)
    .single();

  if (currentError || !current) {
    throw new Error("配信リリース情報が見つかりません。");
  }

  const nextValues = { ...current, [field]: normalized || null };
  if (!Object.values(nextValues).some(Boolean)) {
    throw new Error("全項目を空にする場合は削除を使用してください。");
  }

  const { error } = await supabaseAdmin
    .from("song_digital_releases")
    .update({ [field]: normalized || null })
    .eq("id", digitalReleaseId)
    .eq("song_id", songId);

  if (error) {
    throw new Error("配信リリース情報の更新に失敗しました。");
  }

  revalidatePath(`/_manage/songs/${songId}/digital-releases`);
  return { ok: true };
}

export async function deleteSongDigitalRelease(
  songId: number,
  digitalReleaseId: number
) {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("song_digital_releases")
    .delete()
    .eq("id", digitalReleaseId)
    .eq("song_id", songId);

  if (error) {
    throw new Error("配信リリース情報の削除に失敗しました。");
  }

  redirect(`/_manage/songs/${songId}/digital-releases?deleted=1`);
}

export async function createSong(formData: FormData) {
  await requireAdmin();

  const title = getNullableString(formData, "title");
  const songType = getNullableString(formData, "song_type");

  if (!title) {
    throw new Error("title is required.");
  }
  if (songType && !isManageOptionValue(SONG_TYPE_OPTIONS, songType)) {
    throw new Error("楽曲種別が不正です。");
  }

  const payload = {
    title,
    title_kana: getNullableString(formData, "title_kana"),
    sort_title: getNullableString(formData, "sort_title"),
    song_type: songType,
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
    version_name: null,
    version_type: "standard",
    is_primary_version: true,
  };

  const { data, error } = await supabaseAdmin
    .from("songs")
    .insert(payload)
    .select("id, title, title_kana, sort_title")
    .single();

  if (error || !data) {
    throw new Error("楽曲データの作成に失敗しました。");
  }

  const { error: groupError } = await supabaseAdmin.from("song_groups").insert({
    id: data.id,
    title: data.title,
    title_kana: data.title_kana,
    sort_title: data.sort_title,
  });

  if (groupError) {
    throw new Error("楽曲グループの作成に失敗しました。");
  }

  const { error: updateGroupError } = await supabaseAdmin
    .from("songs")
    .update({
      song_group_id: data.id,
    })
    .eq("id", data.id);

  if (updateGroupError) {
    throw new Error("楽曲グループの紐づけに失敗しました。");
  }

  redirect(`/_manage/songs/${data.id}/edit?saved=1`);
}

export async function createSongLink(songId: number, formData: FormData) {
  await requireAdmin();
  const linkType = getRequiredString(formData, "link_type");
  if (!isManageOptionValue(LINK_TYPE_OPTIONS, linkType)) {
    throw new Error("関連リンク種別が不正です。");
  }

  const payload = {
    target_type: "song",
    target_id: songId,
    link_type: linkType,
    label: getNullableString(formData, "label"),
    title: getNullableString(formData, "title"),
    site_name: getNullableString(formData, "site_name"),
    url: getRequiredHttpUrl(formData, "url"),
    published_date: getNullableString(formData, "published_date"),
    notes: getNullableString(formData, "notes"),
    thumbnail_url: getNullableHttpUrl(formData, "thumbnail_url"),
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
  await requireAdmin();
  const linkType = getRequiredString(formData, "link_type");
  if (!isManageOptionValue(LINK_TYPE_OPTIONS, linkType)) {
    throw new Error("関連リンク種別が不正です。");
  }

  const payload = {
    link_type: linkType,
    label: getNullableString(formData, "label"),
    title: getNullableString(formData, "title"),
    site_name: getNullableString(formData, "site_name"),
    url: getRequiredHttpUrl(formData, "url"),
    published_date: getNullableString(formData, "published_date"),
    notes: getNullableString(formData, "notes"),
    thumbnail_url: getNullableHttpUrl(formData, "thumbnail_url"),
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
  await assertPublicHttpUrl(url);

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
    redirect: "error",
    signal: AbortSignal.timeout(10000),
  });

  if (!response.ok) {
    throw new Error("リンク先の取得に失敗しました。");
  }

  const contentType = response.headers.get("content-type") ?? "";
  const contentLength = Number(response.headers.get("content-length") ?? 0);

  if (
    !contentType.includes("text/html") &&
    !contentType.includes("application/xhtml+xml")
  ) {
    throw new Error("HTMLページ以外のURLは取得できません。");
  }

  if (contentLength > 1024 * 1024) {
    throw new Error("リンク先のページサイズが大きすぎます。");
  }

  const html = await response.text();

  if (html.length > 1024 * 1024) {
    throw new Error("リンク先のページサイズが大きすぎます。");
  }

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
  await requireAdmin();

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
  await requireAdmin();

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

async function getReleaseItemScope(releaseId: number) {
  const { data: release, error } = await supabaseAdmin
    .from("releases")
    .select("id, release_group_id")
    .eq("id", releaseId)
    .single();

  if (error || !release) {
    throw new Error("リリース情報の取得に失敗しました。");
  }

  return {
    releaseId: release.id,
    releaseGroupId: release.release_group_id as number | null,
  };
}

export async function createReleaseItem(releaseId: number, formData: FormData) {
  await requireAdmin();

  const scope = await getReleaseItemScope(releaseId);

  const payload = {
    release_id: scope.releaseId,
    release_group_id: scope.releaseGroupId,
    disc_number: getNullableNumber(formData, "disc_number"),
    track_number: getNullableNumber(formData, "track_number"),
    song_id: getNullableNumber(formData, "song_id"),
    track_title: getNullableString(formData, "track_title"),
    track_artist: getNullableString(formData, "track_artist"),
    title_override: getNullableString(formData, "title_override"),
    notes: getNullableString(formData, "notes"),
  };

  const { error } = await supabaseAdmin.from("release_items").insert(payload);

  if (error) {
    throw new Error("収録曲の追加に失敗しました。");
  }

  redirect(`/_manage/releases/${releaseId}/items?saved=1`);
}

export async function updateReleaseItem(
  releaseId: number,
  itemId: number,
  formData: FormData
) {
  await requireAdmin();

  const scope = await getReleaseItemScope(releaseId);

  const payload = {
    disc_number: getNullableNumber(formData, "disc_number"),
    track_number: getNullableNumber(formData, "track_number"),
    song_id: getNullableNumber(formData, "song_id"),
    track_title: getNullableString(formData, "track_title"),
    track_artist: getNullableString(formData, "track_artist"),
    title_override: getNullableString(formData, "title_override"),
    notes: getNullableString(formData, "notes"),
  };

  const { error } = await supabaseAdmin
    .from("release_items")
    .update(payload)
    .eq("id", itemId)
    .eq("release_id", scope.releaseId);

  if (error) {
    throw new Error("収録曲の更新に失敗しました。");
  }

  redirect(`/_manage/releases/${releaseId}/items?saved=1`);
}

export async function deleteReleaseItem(releaseId: number, itemId: number) {
  await requireAdmin();

  const scope = await getReleaseItemScope(releaseId);

  const { error } = await supabaseAdmin
    .from("release_items")
    .delete()
    .eq("id", itemId)
    .eq("release_id", scope.releaseId);

  if (error) {
    throw new Error("収録曲の削除に失敗しました。");
  }

  redirect(`/_manage/releases/${releaseId}/items?saved=1`);
}

export async function updateRelease(releaseId: number, formData: FormData) {
  await requireAdmin();
  const releaseType = getNullableString(formData, "release_type") ?? "other";
  if (!isManageOptionValue(RELEASE_TYPE_OPTIONS, releaseType)) {
    throw new Error("リリース種別が不正です。");
  }

  const payload = {
    title: getNullableString(formData, "title"),
    title_kana: getNullableString(formData, "title_kana"),
    sort_title: getNullableString(formData, "sort_title"),
    release_type: releaseType,
    artist_credit: getNullableString(formData, "artist_credit"),
    release_date: getNullableString(formData, "release_date"),
    jacket_image_url: getNullableHttpUrl(formData, "jacket_image_url"),
    official_url: getNullableHttpUrl(formData, "official_url"),
    notes: getNullableString(formData, "notes"),

    release_group_id: getNullableNumber(formData, "release_group_id"),
    edition_name: getNullableString(formData, "edition_name"),
    is_primary_edition: formData.get("is_primary_edition") === "on",
  };

  if (!payload.title) {
    throw new Error("title is required.");
  }

  const { error } = await supabaseAdmin
    .from("releases")
    .update(payload)
    .eq("id", releaseId);

  if (error) {
    throw new Error("リリース情報の更新に失敗しました。");
  }

  redirect(`/_manage/releases/${releaseId}/edit?saved=1`);
}

const inlineReleaseFields = new Set([
  "title",
  "title_kana",
  "sort_title",
  "release_type",
  "artist_credit",
  "release_date",
  "jacket_image_url",
  "official_url",
  "notes",
  "release_group_id",
  "edition_name",
]);

export async function updateReleaseInlineField(
  releaseId: number,
  field: string,
  value: string,
) {
  await requireAdmin();

  if (!Number.isInteger(releaseId) || !inlineReleaseFields.has(field)) {
    throw new Error("編集項目が不正です。");
  }

  const normalized = value.trim();
  if (field === "title" && !normalized) {
    throw new Error("タイトルは必須です。");
  }
  if (field === "release_type" && !isManageOptionValue(RELEASE_TYPE_OPTIONS, normalized)) {
    throw new Error("リリース種別が不正です。");
  }
  if ((field === "jacket_image_url" || field === "official_url") && normalized) {
    await assertPublicHttpUrl(normalized);
  }

  const payload = field === "release_group_id"
    ? { release_group_id: normalized ? Number(normalized) : null }
    : { [field]: normalized || null };

  if (field === "release_group_id" && normalized && !Number.isInteger(Number(normalized))) {
    throw new Error("作品グループが不正です。");
  }

  const { error } = await supabaseAdmin
    .from("releases")
    .update(payload)
    .eq("id", releaseId);

  if (error) {
    throw new Error("リリース情報の更新に失敗しました。");
  }

  revalidatePath(`/_manage/releases/${releaseId}`);
  revalidatePath(`/_manage/releases/${releaseId}/items`);
  revalidatePath("/_manage/releases");
  revalidatePath(`/releases/${releaseId}`);
  return { ok: true };
}

export async function updateReleaseInlinePrimary(releaseId: number, value: boolean) {
  await requireAdmin();

  if (!Number.isInteger(releaseId)) {
    throw new Error("リリースIDが不正です。");
  }

  const { error } = await supabaseAdmin
    .from("releases")
    .update({ is_primary_edition: value })
    .eq("id", releaseId);

  if (error) {
    throw new Error("代表形態の更新に失敗しました。");
  }

  revalidatePath(`/_manage/releases/${releaseId}`);
  revalidatePath("/_manage/releases");
  return { ok: true };
}

const inlineReleaseGroupFields = new Set([
  "title",
  "title_kana",
  "sort_title",
  "release_date",
  "tagline",
  "notes",
]);

export async function updateReleaseGroupInlineField(
  releaseId: number,
  releaseGroupId: number,
  field: string,
  value: string,
) {
  await requireAdmin();

  if (!Number.isInteger(releaseId) || !Number.isInteger(releaseGroupId) || !inlineReleaseGroupFields.has(field)) {
    throw new Error("編集項目が不正です。");
  }

  const normalized = value.trim();
  if (field === "title" && !normalized) {
    throw new Error("作品名は必須です。");
  }

  const { data: release, error: releaseError } = await supabaseAdmin
    .from("releases")
    .select("id")
    .eq("id", releaseId)
    .eq("release_group_id", releaseGroupId)
    .single();

  if (releaseError || !release) {
    throw new Error("このリリースの作品グループではありません。");
  }

  const { error } = await supabaseAdmin
    .from("release_groups")
    .update({ [field]: normalized || null })
    .eq("id", releaseGroupId);

  if (error) {
    throw new Error("作品情報の更新に失敗しました。");
  }

  revalidatePath(`/_manage/releases/${releaseId}`);
  revalidatePath("/_manage/releases");
  revalidatePath(`/releases/${releaseId}`);
  return { ok: true };
}

export async function updateReleaseItemInlineField(
  releaseId: number,
  itemId: number,
  field: string,
  value: string,
) {
  await requireAdmin();

  const allowedFields = new Set([
    "disc_number",
    "track_number",
    "song_id",
    "track_title",
    "track_artist",
    "title_override",
    "notes",
  ]);

  if (!Number.isInteger(releaseId) || !Number.isInteger(itemId) || !allowedFields.has(field)) {
    throw new Error("編集項目が不正です。");
  }

  const normalized = value.trim();
  const numericField = field === "disc_number" || field === "track_number" || field === "song_id";
  const numericValue = normalized ? Number(normalized) : null;
  if (numericField && numericValue !== null && !Number.isInteger(numericValue)) {
    throw new Error("数値が不正です。");
  }

  const scope = await getReleaseItemScope(releaseId);
  const { error } = await supabaseAdmin
    .from("release_items")
    .update({ [field]: numericField ? numericValue : normalized || null })
    .eq("id", itemId)
    .eq("release_id", scope.releaseId);
  if (error) {
    throw new Error("収録曲情報の更新に失敗しました。");
  }

  revalidatePath(`/_manage/releases/${releaseId}/items`);
  revalidatePath(`/_manage/releases/${releaseId}`);
  return { ok: true };
}

export async function updateReleaseGroup(releaseId: number, formData: FormData) {
  await requireAdmin();

  const releaseGroupId = getNullableNumber(formData, "release_group_id");

  if (!releaseGroupId) {
    throw new Error("release_group_id is required.");
  }

  const payload = {
    title: getNullableString(formData, "group_title"),
    title_kana: getNullableString(formData, "group_title_kana"),
    sort_title: getNullableString(formData, "group_sort_title"),
    release_date: getNullableString(formData, "group_release_date"),
    tagline: getNullableString(formData, "group_tagline"),
    notes: getNullableString(formData, "group_notes"),
  };

  if (!payload.title) {
    throw new Error("group title is required.");
  }

  const { error } = await supabaseAdmin
    .from("release_groups")
    .update(payload)
    .eq("id", releaseGroupId);

  if (error) {
    throw new Error("作品グループ情報の更新に失敗しました。");
  }

  redirect(`/_manage/releases/${releaseId}/edit?saved=1`);
}

export async function createRelease(formData: FormData) {
  await requireAdmin();

  const title = getNullableString(formData, "title");
  const releaseType = getNullableString(formData, "release_type") ?? "other";

  if (!title) {
    throw new Error("title is required.");
  }
  if (!isManageOptionValue(RELEASE_TYPE_OPTIONS, releaseType)) {
    throw new Error("リリース種別が不正です。");
  }

  const releaseGroupIdFromForm = getNullableNumber(formData, "release_group_id");

  let releaseGroupId = releaseGroupIdFromForm;

  if (!releaseGroupId) {
    const groupTitle = getNullableString(formData, "group_title") ?? title;

    const groupPayload = {
      title: groupTitle,
      title_kana:
        getNullableString(formData, "group_title_kana") ??
        getNullableString(formData, "title_kana"),
      sort_title:
        getNullableString(formData, "group_sort_title") ??
        getNullableString(formData, "sort_title"),
      release_date: getNullableString(formData, "release_date"),
      tagline: getNullableString(formData, "group_tagline"),
      notes: null,
    };

    const { data: groupData, error: groupError } = await supabaseAdmin
      .from("release_groups")
      .insert(groupPayload)
      .select("id")
      .single();

    if (groupError || !groupData) {
      throw new Error("作品グループの作成に失敗しました。");
    }

    releaseGroupId = groupData.id;
  }

  const payload = {
    title,
    title_kana: getNullableString(formData, "title_kana"),
    sort_title: getNullableString(formData, "sort_title"),
    release_type: releaseType,
    artist_credit: getNullableString(formData, "artist_credit"),
    release_date: getNullableString(formData, "release_date"),
    jacket_image_url: getNullableHttpUrl(formData, "jacket_image_url"),
    official_url: getNullableHttpUrl(formData, "official_url"),
    notes: getNullableString(formData, "notes"),

    release_group_id: releaseGroupId,
    edition_name: getNullableString(formData, "edition_name"),
    is_primary_edition: formData.get("is_primary_edition") === "on",
  };

  const { data, error } = await supabaseAdmin
    .from("releases")
    .insert(payload)
    .select("id")
    .single();

  if (error || !data) {
    throw new Error("リリース情報の作成に失敗しました。");
  }

  redirect(`/_manage/releases/${data.id}?saved=1`);
}

export async function duplicateRelease(releaseId: number) {
  await requireAdmin();

  const { data: release, error: releaseError } = await supabaseAdmin
    .from("releases")
    .select(
      "title,title_kana,sort_title,release_type,artist_credit,release_date,jacket_image_url,official_url,notes,release_group_id,edition_name,is_primary_edition"
    )
    .eq("id", releaseId)
    .single();

  if (releaseError || !release) {
    throw new Error("複製元のリリース情報の取得に失敗しました。");
  }

  const { data: newRelease, error: insertReleaseError } = await supabaseAdmin
    .from("releases")
    .insert({
      title: `${release.title} copy`,
      title_kana: release.title_kana,
      sort_title: release.sort_title,
      release_type: release.release_type,
      artist_credit: release.artist_credit,
      release_date: release.release_date,
      jacket_image_url: release.jacket_image_url,
      official_url: release.official_url,
      notes: release.notes,

      release_group_id: release.release_group_id,
      edition_name: release.edition_name,
      is_primary_edition: false,
    })
    .select("id")
    .single();

  if (insertReleaseError || !newRelease) {
    throw new Error("リリース情報の複製に失敗しました。");
  }

  // const { data: items, error: itemsError } = await supabaseAdmin
  //   .from("release_items")
  //   .select(
  //     "disc_number,track_number,song_id,track_title,track_artist,title_override,notes"
  //   )
  //   .eq("release_id", releaseId)
  //   .order("disc_number", { ascending: true, nullsFirst: false })
  //   .order("track_number", { ascending: true, nullsFirst: false })
  //   .order("id", { ascending: true });

  // if (itemsError) {
  //   throw new Error("収録曲情報の取得に失敗しました。");
  // }

  // if (items && items.length > 0) {
  //   const copiedItems = items.map((item) => ({
  //     release_id: newRelease.id,
  //     disc_number: item.disc_number,
  //     track_number: item.track_number,
  //     song_id: item.song_id,
  //     track_title: item.track_title,
  //     track_artist: item.track_artist,
  //     title_override: item.title_override,
  //     notes: item.notes,
  //   }));

  //   const { error: insertItemsError } = await supabaseAdmin
  //     .from("release_items")
  //     .insert(copiedItems);

  //   if (insertItemsError) {
  //     throw new Error("収録曲情報の複製に失敗しました。");
  //   }
  // }

  redirect(`/_manage/releases/${newRelease.id}?saved=1`);
}

export async function deleteRelease(releaseId: number) {
  await requireAdmin();

  const { error } = await supabaseAdmin
    .from("releases")
    .delete()
    .eq("id", releaseId);

  if (error) {
    throw new Error("リリース情報の削除に失敗しました。");
  }

  redirect("/_manage/releases?deleted=1");
}

const inlineSongFields = new Set([
  "title", "title_kana", "artist_credit", "song_type", "first_date", "first_source",
  "first_full_date", "first_full_source", "original_artist", "original_vocal", "original_composer", "original_lyricist",
  "original_arranger", "tie_up", "album_text", "notes", "version_name", "version_type", "song_group_id", "discovery_category",
]);

const inlineSongStatusFields = new Set([
  "verification_status", "first_status", "first_full_status", "tie_up_status", "album_text_status", "original_artist_status", "original_vocal_status",
  "original_lyricist_status", "original_composer_status", "original_arranger_status",
]);

export async function updateSongInlineField(
  songId: number,
  field: string,
  value: string,
) {
  await requireAdmin();
  if (!inlineSongFields.has(field) || !Number.isInteger(songId)) throw new Error("編集項目が不正です。");
  const normalized = value.trim();
  if (field === "song_type" && normalized && !isManageOptionValue(SONG_TYPE_OPTIONS, normalized)) {
    throw new Error("楽曲種別が不正です。");
  }
  if (field === "discovery_category" && normalized && !isManageOptionValue(DISCOVERY_CATEGORY_OPTIONS, normalized)) {
    throw new Error("Discover分類が不正です。");
  }
  const payload = field === "song_group_id"
    ? { song_group_id: normalized ? Number(normalized) : null }
    : { [field]: normalized || null };
  const { error } = await supabaseAdmin.from("songs").update(payload).eq("id", songId);
  if (error) throw new Error("楽曲データの更新に失敗しました。");
  revalidatePath(`/_manage/songs/${songId}`);
  if (field === "discovery_category") {
    revalidatePath("/discover");
  }
  return { ok: true };
}

export async function updateSongInlineStatus(
  songId: number,
  field: string,
  value: string,
) {
  await requireAdmin();
  if (!inlineSongStatusFields.has(field) || !["confirmed", "uncertain", "unverified", "wanted"].includes(value)) {
    throw new Error("確認状態が不正です。");
  }
  const { error } = await supabaseAdmin.from("songs").update({ [field]: value }).eq("id", songId);
  if (error) throw new Error("確認状態の更新に失敗しました。");
  revalidatePath(`/_manage/songs/${songId}`);
  return { ok: true };
}

const humanCheckableSongFields = new Set([
  "artist_credit",
  "discovery_category",
  "first_date",
  "first_source",
  "first_full_date",
  "first_full_source",
  "tie_up",
  "album_text",
  "original_artist",
  "original_vocal",
  "original_lyricist",
  "original_composer",
  "original_arranger",
]);

function jsonSnapshotsEqual(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

export async function confirmSongFieldHuman(
  songId: number,
  field: string,
  _formData: FormData,
) {
  await requireAdmin();

  if (!Number.isInteger(songId) || !humanCheckableSongFields.has(field)) {
    throw new Error("確認対象が不正です。");
  }

  const [{ data: song, error: songError }, { data: checks, error: checksError }] =
    await Promise.all([
      supabaseAdmin.from("songs").select(field).eq("id", songId).single(),
      supabaseAdmin
        .from("song_field_checks")
        .select("id,checked_value")
        .eq("song_id", songId)
        .eq("field_name", field)
        .eq("checker_type", "human"),
    ]);

  if (songError || !song || checksError) {
    throw new Error("現在値の確認に失敗しました。");
  }

  const currentValue = (song as unknown as Record<string, unknown>)[field] ?? null;
  const alreadyChecked = (checks ?? []).some((check) =>
    jsonSnapshotsEqual(check.checked_value, currentValue)
  );

  if (!alreadyChecked) {
    const { error } = await supabaseAdmin.from("song_field_checks").insert({
      song_id: songId,
      field_name: field,
      checked_value: currentValue,
      checker_type: "human",
      evidence: [],
      note: "管理画面で現在値を人間確認",
    });

    if (error) {
      throw new Error("人間確認履歴の追加に失敗しました。");
    }
  }

  revalidatePath(`/_manage/songs/${songId}`);
}

export async function updateSongInlinePrimary(songId: number, value: boolean) {
  await requireAdmin();
  const { error } = await supabaseAdmin.from("songs").update({ is_primary_version: value }).eq("id", songId);
  if (error) throw new Error("代表版の更新に失敗しました。");
  revalidatePath(`/_manage/songs/${songId}`);
  revalidatePath(`/_manage/song-groups/${songId}`);
  return { ok: true };
}

export async function updateSongGroupInlineField(groupId: number, field: string, value: string) {
  await requireAdmin();
  if (field !== "title" && field !== "title_kana" && field !== "sort_title") throw new Error("編集項目が不正です。");
  const { error } = await supabaseAdmin.from("song_groups").update({ [field]: value.trim() || null }).eq("id", groupId);
  if (error) throw new Error("楽曲グループの更新に失敗しました。");
  revalidatePath(`/_manage/song-groups/${groupId}`);
  revalidatePath("/_manage/song-groups");
  return { ok: true };
}

export async function updateSongLinkInlineField(linkId: number, songId: number, field: string, value: string) {
  await requireAdmin();
  const allowed = new Set(["link_type", "label", "title", "site_name", "url", "published_date", "notes", "thumbnail_url"]);
  if (!allowed.has(field)) throw new Error("編集項目が不正です。");
  const normalized = value.trim();
  if (field === "link_type" && !isManageOptionValue(LINK_TYPE_OPTIONS, normalized)) {
    throw new Error("関連リンク種別が不正です。");
  }
  if (field === "url") {
    if (!normalized) throw new Error("URLは必須です。");
    await assertPublicHttpUrl(normalized);
  }
  const { error } = await supabaseAdmin.from("links").update({ [field]: normalized || null }).eq("id", linkId).eq("target_type", "song").eq("target_id", songId);
  if (error) throw new Error("関連リンクの更新に失敗しました。");
  revalidatePath(`/_manage/songs/${songId}/links`);
  return { ok: true };
}
