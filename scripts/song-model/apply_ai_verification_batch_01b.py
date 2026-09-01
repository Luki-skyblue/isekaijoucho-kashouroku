"""Focused AI verification/backfill for batch 01b (16 exact songs).

Default mode is read-only. Production writes are added only after the focused
preflight is reviewed and require an explicit confirmation token.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Final
from urllib.parse import parse_qs, urlparse
from zoneinfo import ZoneInfo


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))
from apply_song_model_backfill import canonical_hash  # noqa: E402


TARGET_IDS: Final = (42, 50, 58, 77, 80, 84, 102, 126, 164, 325, 357, 367, 377, 379, 387, 400)
CONFIRM: Final = "AI_VERIFICATION_BATCH_01B"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-verification"
SOURCE_164: Final = "https://www.youtube.com/watch?v=DkS3Zm1dYkU"
ENTITY_CREATE_ALLOWLIST: Final = frozenset({
    "AKB48", "IA", "初音ミク", "歌愛ユキ", "日暮翠", "日暮紅",
    "Yaffle", "じん", "はるまきごはん", "カンザキイオリ", "宅見将典",
    "宇多田ヒカル", "安宅秀紀", "宮崎恵里花", "山崎燿", "柊マグネタイト",
    "田中ユウスケ", "秋元康", "稲葉曇", "米津玄師", "香椎モイミ",
})


def ids_filter(values: list[int] | tuple[int, ...] | set[int]) -> str:
    return f"in.({','.join(map(str, sorted(values)))})"


def select(api: RestClient, table: str, params: list[tuple[str, str]] | None = None) -> list[dict[str, Any]]:
    result = api.request(table, params=[("select", "*"), *(params or [])])
    if not isinstance(result, list):
        raise RuntimeError(f"{table}: focused read failed")
    return result


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    state: dict[str, list[dict[str, Any]]] = {}
    state["songs"] = select(api, "songs", [("id", ids_filter(TARGET_IDS)), ("order", "id.asc")])
    if {int(row["id"]) for row in state["songs"]} != set(TARGET_IDS):
        raise RuntimeError("target song inventory drifted")
    group_ids = {int(row["song_group_id"]) for row in state["songs"]}
    state["song_groups"] = select(api, "song_groups", [("id", ids_filter(group_ids))])
    state["song_field_checks"] = select(api, "song_field_checks", [("song_id", ids_filter(TARGET_IDS))])
    state["song_group_field_checks"] = select(api, "song_group_field_checks", [("song_group_id", ids_filter(group_ids))])
    state["song_credits"] = select(api, "song_credits", [("song_id", ids_filter(TARGET_IDS))])
    credit_ids = {int(row["id"]) for row in state["song_credits"]}
    state["song_credit_checks"] = select(api, "song_credit_checks", [("song_credit_id", ids_filter(credit_ids))]) if credit_ids else []
    song_check_ids = {int(row["id"]) for row in state["song_field_checks"]}
    group_check_ids = {int(row["id"]) for row in state["song_group_field_checks"]}
    credit_check_ids = {int(row["id"]) for row in state["song_credit_checks"]}
    state["song_field_check_sources"] = select(api, "song_field_check_sources", [("song_field_check_id", ids_filter(song_check_ids))]) if song_check_ids else []
    state["song_group_field_check_sources"] = select(api, "song_group_field_check_sources", [("song_group_field_check_id", ids_filter(group_check_ids))]) if group_check_ids else []
    state["song_credit_check_sources"] = select(api, "song_credit_check_sources", [("song_credit_check_id", ids_filter(credit_check_ids))]) if credit_check_ids else []
    state["song_group_credits"] = select(api, "song_group_credits", [("song_group_id", ids_filter(group_ids))])
    state["song_participations"] = select(api, "song_participations", [("song_id", ids_filter(TARGET_IDS))])
    state["song_group_origins"] = select(api, "song_group_origins", [("song_group_id", ids_filter(group_ids))])
    state["entities"] = select(api, "entities")
    state["entity_aliases"] = select(api, "entity_aliases")
    state["entity_relationships"] = select(api, "entity_relationships")
    state["links"] = select(api, "links", [("target_type", "eq.song"), ("target_id", ids_filter(TARGET_IDS))])
    state["song_availabilities"] = select(api, "song_availabilities", [("song_id", ids_filter(TARGET_IDS))])
    availability_ids = {int(row["id"]) for row in state["song_availabilities"]}
    state["song_availability_sources"] = select(api, "song_availability_sources", [("song_availability_id", ids_filter(availability_ids))]) if availability_ids else []
    state["song_digital_releases"] = select(api, "song_digital_releases", [("song_id", ids_filter(TARGET_IDS))])
    state["release_items"] = select(api, "release_items", [("song_id", ids_filter(TARGET_IDS))])
    release_ids = {int(row["release_id"]) for row in state["release_items"]}
    related = select(api, "releases", [("or", "(title.ilike.*CANDY*,title.ilike.*Anima*,title.ilike.*魔女達*,title.ilike.*現象*)")])
    release_ids.update(int(row["id"]) for row in related)
    state["releases"] = select(api, "releases", [("id", ids_filter(release_ids))]) if release_ids else []
    state["reference_sources"] = select(api, "reference_sources")
    return state


def current_song_checks(state: dict[str, list[dict[str, Any]]]) -> list[dict[str, Any]]:
    songs = {int(row["id"]): row for row in state["songs"]}
    return [row for row in state["song_field_checks"]
            if row["field_name"] in songs[int(row["song_id"])]
            and row.get("checked_value") == songs[int(row["song_id"])].get(row["field_name"])]


def summary(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    entities = {int(row["id"]): row["canonical_name"] for row in state["entities"]}
    groups = {int(row["id"]): row for row in state["song_groups"]}
    checks_by_song: dict[int, dict[str, list[str]]] = {}
    for row in current_song_checks(state):
        checks_by_song.setdefault(int(row["song_id"]), {}).setdefault(row["field_name"], []).append(row["checker_type"])
    songs = []
    for song in state["songs"]:
        group = groups[int(song["song_group_id"])]
        songs.append({
            "id": song["id"], "title": song["title"], "artist_credit": song["artist_credit"],
            "song_group_id": song["song_group_id"], "song_type": song.get("song_type"),
            "performance_context": song.get("performance_context"), "version_kind": song.get("version_kind"),
            "version_name": song.get("version_name"), "discovery_category": song.get("discovery_category"),
            "first": [song.get("first_date"), song.get("first_source"), song.get("first_status")],
            "first_full": [song.get("first_full_date"), song.get("first_full_source"), song.get("first_full_status")],
            "original": {key: song.get(key) for key in ("original_artist", "original_vocal", "original_lyricist", "original_composer", "original_arranger")},
            "tie_up": song.get("tie_up"), "work_provenance": group.get("work_provenance"),
            "work_credits": {key: group.get(key) for key in ("work_artist_credit", "work_vocal_credit", "work_lyricist_credit", "work_composer_credit", "work_arranger_credit")},
            "checks": checks_by_song.get(int(song["id"]), {}),
        })
    return {
        "songs": songs,
        "group_credits": [{**{key: row.get(key) for key in ("id", "song_group_id", "role", "credit_name", "entity_id", "sort_order")},
                           "entity": entities.get(int(row["entity_id"])) if row.get("entity_id") is not None else None}
                          for row in state["song_group_credits"]],
        "song_credits": [{**{key: row.get(key) for key in ("id", "song_id", "role", "credit_name", "entity_id", "sort_order")},
                          "entity": entities.get(int(row["entity_id"])) if row.get("entity_id") is not None else None}
                         for row in state["song_credits"]],
        "participations": [{**{key: row.get(key) for key in ("id", "song_id", "entity_id", "participation_role", "sort_order")},
                            "entity": entities.get(int(row["entity_id"]))}
                           for row in state["song_participations"]],
        "origins": state["song_group_origins"], "links": state["links"],
        "availabilities": state["song_availabilities"], "digital_releases": state["song_digital_releases"],
        "release_items": state["release_items"], "releases": state["releases"],
        "sources": state["reference_sources"],
    }


def compact_summary(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    report = summary(state)
    target_titles = {str(row["title"]).replace(" (solo ver.)", "").replace(" multilingual ver.", "")
                     for row in state["songs"]}
    return {
        "songs": report["songs"],
        "group_credits": report["group_credits"],
        "song_credits": report["song_credits"],
        "participations": report["participations"],
        "origins": report["origins"],
        "links": [{key: row.get(key) for key in ("id", "target_id", "link_type", "label", "url", "published_date", "title", "site_name")}
                  for row in report["links"]],
        "availabilities": report["availabilities"],
        "digital_releases": report["digital_releases"],
        "release_items": report["release_items"],
        "releases": [{key: row.get(key) for key in ("id", "title", "release_date", "official_url", "release_group_id")}
                     for row in report["releases"]],
        "matching_raw_items": [row for row in report["release_items"]
                               if row.get("track_title") in target_titles
                               or int(row.get("song_id") or 0) in TARGET_IDS],
    }


def youtube_key(url: str) -> str | None:
    parsed = urlparse(url)
    host = parsed.netloc.lower().removeprefix("www.")
    if host == "youtu.be":
        return parsed.path.strip("/").split("/")[0] or None
    if host in {"youtube.com", "m.youtube.com"}:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [None])[0]
        parts = parsed.path.strip("/").split("/")
        if len(parts) >= 2 and parts[0] in {"shorts", "live", "embed"}:
            return parts[1]
    return None


def equivalent_source(sources: list[dict[str, Any]], url: str) -> dict[str, Any] | None:
    key = youtube_key(url)
    return next((row for row in sources if row["url"] == url
                 or (key is not None and youtube_key(str(row["url"])) == key)), None)


def current_check(rows: list[dict[str, Any]], owner_key: str, owner_id: int,
                  field: str, value: Any, checker: str) -> dict[str, Any] | None:
    return next((row for row in rows if int(row[owner_key]) == owner_id
                 and row["field_name"] == field and row.get("checked_value") == value
                 and row["checker_type"] == checker), None)


def entity_index(entities: list[dict[str, Any]], aliases: list[dict[str, Any]]) -> dict[str, dict[str, Any]]:
    by_id = {int(row["id"]): row for row in entities}
    result = {str(row["canonical_name"]): row for row in entities}
    for alias in aliases:
        entity = by_id.get(int(alias["entity_id"]))
        if entity is not None:
            result.setdefault(str(alias["alias_name"]), entity)
    return result


def credit_tokens(value: Any) -> set[str]:
    if not isinstance(value, str):
        return set()
    normalized = value
    for delimiter in (" feat. ", " feat ", " with. ", " with ", "×", "＆", "&", "＋", "+"):
        normalized = normalized.replace(delimiter, "|")
    return {part.strip() for part in normalized.split("|") if part.strip()}


def build_plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {int(row["id"]): row for row in state["songs"]}
    groups = {int(row["id"]): row for row in state["song_groups"]}
    song_group_ids = {song_id: int(song["song_group_id"]) for song_id, song in songs.items()}
    links = {int(row["id"]): row for row in state["links"]}
    digital = {int(row["song_id"]): row for row in state["song_digital_releases"]}
    entities = entity_index(state["entities"], state["entity_aliases"])

    entity_specs = {
        "IA": "voicebank", "じん": "artist", "香椎モイミ": "artist",
        "はるまきごはん": "artist", "柊マグネタイト": "artist",
        "宅見将典": "artist", "歌愛ユキ": "voicebank", "稲葉曇": "artist",
        "米津玄師": "artist", "宇多田ヒカル": "artist", "Yaffle": "artist",
        "安宅秀紀": "artist", "初音ミク": "voicebank", "日暮翠": "character",
        "日暮紅": "character", "宮崎恵里花": "artist", "AKB48": "group",
        "秋元康": "artist", "山崎燿": "artist", "田中ユウスケ": "artist",
        "カンザキイオリ": "artist",
    }
    new_entities = [{"canonical_name": name, "entity_type": kind,
                     "note": "human-confirmed verification batch 01b entity resolution"}
                    for name, kind in entity_specs.items()
                    if name not in entities and name in ENTITY_CREATE_ALLOWLIST]

    song_updates: dict[int, dict[str, Any]] = {
        84: {"performance_context": "live"},
        126: {"performance_context": "live", "original_vocal": "歌愛ユキ",
              "original_vocal_status": "confirmed"},
        164: {"performance_context": "live", "discovery_category": "isekai_official"},
        325: {"performance_context": "live", "original_artist": "米津玄師＋宇多田ヒカル",
              "original_artist_status": "confirmed", "original_vocal": "米津玄師 + 宇多田ヒカル",
              "original_vocal_status": "confirmed", "original_lyricist": "米津玄師",
              "original_lyricist_status": "confirmed", "original_composer": "米津玄師",
              "original_composer_status": "confirmed", "original_arranger": "米津玄師 + Yaffle",
              "original_arranger_status": "confirmed"},
        377: {"performance_context": "live"},
        379: {"performance_context": "live"},
    }
    group_updates: dict[int, dict[str, Any]] = {
        50: {"work_vocal_credit": "V.W.P", "work_lyricist_credit": "カンザキイオリ",
             "work_composer_credit": "カンザキイオリ", "work_arranger_credit": "カンザキイオリ"},
        58: {"work_vocal_credit": "ヰ世界情緒 × 花譜", "work_lyricist_credit": "香椎モイミ",
             "work_composer_credit": "香椎モイミ", "work_arranger_credit": "香椎モイミ"},
        126: {"work_vocal_credit": "歌愛ユキ"},
        336: {"work_artist_credit": "米津玄師＋宇多田ヒカル",
              "work_vocal_credit": "米津玄師 + 宇多田ヒカル",
              "work_lyricist_credit": "米津玄師", "work_composer_credit": "米津玄師",
              "work_arranger_credit": "米津玄師 + Yaffle"},
        377: {"work_artist_credit": "香椎モイミ", "work_vocal_credit": "星界",
              "work_lyricist_credit": "香椎モイミ", "work_composer_credit": "香椎モイミ"},
        379: {"work_artist_credit": "AKB48", "work_vocal_credit": "AKB48",
              "work_lyricist_credit": "秋元康", "work_composer_credit": "山崎燿",
              "work_arranger_credit": "田中ユウスケ"},
        387: {"work_vocal_credit": "V.W.P"},
    }

    conflicts: list[dict[str, Any]] = []
    for song_id, updates in list(song_updates.items()):
        for field, value in list(updates.items()):
            old = songs[song_id].get(field)
            if old != value and current_check(state["song_field_checks"], "song_id", song_id,
                                               field, old, "human"):
                conflicts.append({"song_id": song_id, "field": field,
                                  "human_value": old, "research_value": value})
                del updates[field]
    for group_id, updates in list(group_updates.items()):
        for field, value in list(updates.items()):
            old = groups[group_id].get(field)
            if old != value and current_check(state["song_group_field_checks"], "song_group_id",
                                               group_id, field, old, "human"):
                conflicts.append({"song_group_id": group_id, "field": field,
                                  "human_value": old, "research_value": value})
                del updates[field]

    group_credit_song_specs = [
        (42, "vocal", "IA", 1), (42, "lyricist", "じん", 1), (42, "composer", "じん", 1), (42, "arranger", "じん", 1),
        (50, "vocal", "V.W.P", 1), (50, "lyricist", "カンザキイオリ", 1), (50, "composer", "カンザキイオリ", 1), (50, "arranger", "カンザキイオリ", 1),
        (58, "vocal", "ヰ世界情緒", 1), (58, "vocal", "花譜", 2), (58, "lyricist", "香椎モイミ", 1), (58, "composer", "香椎モイミ", 1), (58, "arranger", "香椎モイミ", 1),
        (77, "vocal", "ヰ世界情緒", 1), (77, "lyricist", "はるまきごはん", 1), (77, "composer", "はるまきごはん", 1), (77, "arranger", "はるまきごはん", 1),
        (80, "vocal", "ヰ世界情緒", 1), (80, "vocal", "幸祜", 2), (80, "lyricist", "柊マグネタイト", 1), (80, "composer", "柊マグネタイト", 1), (80, "arranger", "柊マグネタイト", 1),
        (102, "vocal", "V.W.P", 1), (102, "lyricist", "カンザキイオリ", 1), (102, "composer", "カンザキイオリ", 1), (102, "arranger", "宅見将典", 1),
        (126, "artist", "稲葉曇", 1), (126, "vocal", "歌愛ユキ", 1),
        (325, "artist", "米津玄師", 1), (325, "artist", "宇多田ヒカル", 2), (325, "vocal", "米津玄師", 1), (325, "vocal", "宇多田ヒカル", 2), (325, "lyricist", "米津玄師", 1), (325, "composer", "米津玄師", 1), (325, "arranger", "米津玄師", 1), (325, "arranger", "Yaffle", 2),
        (367, "artist", "はるまきごはん", 1), (367, "vocal", "初音ミク", 1), (367, "lyricist", "はるまきごはん", 1), (367, "composer", "はるまきごはん", 1), (367, "arranger", "はるまきごはん", 1),
        (377, "artist", "香椎モイミ", 1), (377, "vocal", "星界", 1), (377, "lyricist", "香椎モイミ", 1), (377, "composer", "香椎モイミ", 1),
        (379, "artist", "AKB48", 1), (379, "vocal", "AKB48", 1), (379, "lyricist", "秋元康", 1), (379, "composer", "山崎燿", 1), (379, "arranger", "田中ユウスケ", 1),
        (387, "vocal", "V.W.P", 1),
        (400, "vocal", "V.W.P", 1), (400, "lyricist", "カンザキイオリ", 1), (400, "composer", "カンザキイオリ", 1), (400, "arranger", "カンザキイオリ", 1),
    ]
    group_credit_specs = [
        (song_group_ids[song_id], role, name, order)
        for song_id, role, name, order in group_credit_song_specs
    ]
    song_credit_specs = [
        (42, "vocal", "ヰ世界情緒", 1), (42, "vocal", "春猿火", 2),
        (50, "vocal", "V.W.P", 1), (50, "lyricist", "カンザキイオリ", 1), (50, "composer", "カンザキイオリ", 1), (50, "arranger", "カンザキイオリ", 1),
        (58, "vocal", "ヰ世界情緒", 1), (58, "vocal", "花譜", 2), (58, "lyricist", "香椎モイミ", 1), (58, "composer", "香椎モイミ", 1), (58, "arranger", "香椎モイミ", 1),
        (77, "vocal", "ヰ世界情緒", 1), (77, "lyricist", "はるまきごはん", 1), (77, "composer", "はるまきごはん", 1), (77, "arranger", "はるまきごはん", 1),
        (80, "vocal", "ヰ世界情緒", 1), (80, "vocal", "幸祜", 2), (80, "lyricist", "柊マグネタイト", 1), (80, "composer", "柊マグネタイト", 1), (80, "arranger", "柊マグネタイト", 1),
        (102, "vocal", "V.W.P", 1), (102, "lyricist", "カンザキイオリ", 1), (102, "composer", "カンザキイオリ", 1), (102, "arranger", "宅見将典", 1),
        (126, "vocal", "ヰ世界情緒", 1), (325, "vocal", "ヰ世界情緒", 1),
        (164, "vocal", "ヰ世界情緒", 1),
        (357, "vocal", "V.W.P feat. V.I.P", 1), (357, "arranger", "安宅秀紀", 1),
        (367, "vocal", "日暮翠", 1), (367, "vocal", "日暮紅", 2),
        (377, "vocal", "ヰ世界情緒", 1), (377, "vocal", "星界", 2),
        (379, "vocal", "V.W.P", 1), (387, "vocal", "V.W.P", 1),
        (400, "vocal", "花譜", 1), (400, "vocal", "理芽", 2), (400, "vocal", "ヰ世界情緒", 3),
    ]
    participation_specs = {
        42: ["ヰ世界情緒", "春猿火"], 58: ["ヰ世界情緒", "花譜"],
        77: ["ヰ世界情緒"], 80: ["ヰ世界情緒", "幸祜"], 84: ["ヰ世界情緒"],
        126: ["ヰ世界情緒"], 164: ["ヰ世界情緒"], 325: ["ヰ世界情緒"],
        367: ["ヰ世界情緒", "宮崎恵里花"], 377: ["星界", "ヰ世界情緒"],
        400: ["花譜", "理芽", "ヰ世界情緒"],
    }
    relationship_specs = [("日暮翠", "voiced_by", "ヰ世界情緒"),
                          ("日暮紅", "voiced_by", "宮崎恵里花")]
    origin_specs = {
        42: "じん feat. IA「ワールド・コーリング」", 126: "稲葉曇 feat. 歌愛ユキ「ラグトレイン」",
        336: "米津玄師＋宇多田ヒカル「JANE DOE」", 367: "はるまきごはん feat. 初音ミク「ドッペルゲンガー」",
        377: "香椎モイミ feat. 星界「カレンの清掃」", 379: "AKB48「ヘビーローテーション」",
    }

    link_source_ids = {42: 33, 50: 182, 58: 41, 77: 56, 80: 71, 102: 198, 357: 229, 367: 264}
    source_specs: dict[str, dict[str, Any]] = {}
    source_key_by_song: dict[int, str] = {}
    for song_id, link_id in link_source_ids.items():
        link = links[link_id]
        key = f"song_{song_id}_video"
        source_key_by_song[song_id] = key
        source_specs[key] = {"url": link["url"], "title": link.get("title"),
                             "publisher": "KAMITSUBAKI official channel", "source_type": "official_youtube",
                             "published_at": link.get("published_date"),
                             "note": "verification batch 01b; reused existing navigation link"}
    source_key_by_song[164] = "song_164_video"
    source_specs["song_164_video"] = {
        "url": SOURCE_164, "title": "あわく心模様 ヰ世界情緒ソロver. from Anima II",
        "publisher": "ヰ世界情緒 -Isekaijoucho-", "source_type": "official_youtube",
        "published_at": "2025-07-10", "note": "verification batch 01b exact official video",
    }
    for song_id in (50, 102):
        key = f"song_{song_id}_digital"
        row = digital[song_id]
        source_specs[key] = {"url": row["official_url"], "title": row.get("title") or songs[song_id]["title"],
                             "publisher": "KAMITSUBAKI STUDIO", "source_type": "official_site",
                             "published_at": row.get("release_date"),
                             "note": "verification batch 01b; reused legacy digital release URL"}
    source_key_by_song[126] = "song_126_release"
    source_specs["song_126_release"] = {
        "url": "https://kamitsubaki.jp/discography/isekaijoucho/1891/",
        "title": "CANDY LIVE 2",
        "publisher": "KAMITSUBAKI STUDIO", "source_type": "official_site",
        "published_at": None, "note": "verification batch 01b explicit official URL",
    }
    source_key_by_song[379] = "song_379_video"
    source_specs["song_379_video"] = {
        "url": "https://www.youtube.com/watch?v=wH2NMAwuyqI",
        "title": "魔女達の夜会 official full archive",
        "publisher": "V.W.P", "source_type": "official_youtube",
        "published_at": None, "note": "verification batch 01b explicit official URL",
    }
    explicit_sources = {
        "song_42_candy_live": ("https://kamitsubaki.jp/news/2021/01/22/298/", "CANDY LIVE", "official_site"),
        "song_84_anima": ("https://kamitsubaki.jp/news/2022/05/14/1416/", "Anima", "official_site"),
        "anima_ii_product": ("https://findmestore.thinkr.jp/products/ktr-100-0168", "Anima II", "official_store"),
        "song_357_multilingual": ("https://www.youtube.com/watch?v=udipfU-amjo", "電脳 multilingual", "official_youtube"),
        "song_367_digital": ("https://www.tunecore.co.jp/artists/harumakigohan", "ドッペルゲンガー digital", "official_site"),
        "song_400_event": ("https://kamitsubaki.jp/event/year/2023/", "拡成前夜 event", "official_site"),
        "song_400_setlist": ("https://wikiwiki.jp/thinkr/2023.1229", "拡成前夜 exact setlist", "wiki"),
    }
    for key, (url, title, source_type) in explicit_sources.items():
        source_specs[key] = {
            "url": url, "title": title, "publisher": None, "source_type": source_type,
            "published_at": None, "note": "verification batch 01b user-supplied source URL",
        }
    source_key_by_song.update({84: "song_84_anima", 377: "anima_ii_product",
                               400: "song_400_setlist"})
    additional_source_keys_by_song = {
        42: ["song_42_candy_live"], 164: ["anima_ii_product"],
        357: ["song_357_multilingual"], 367: ["song_367_digital"],
        400: ["song_400_event"],
    }

    availability_specs = [
        (50, "youtube", "V.W.P", "vwp_official", "free", "full", "studio", "video", links[182]["url"], True, "song_50_video", "公式MV"),
        (50, "digital_streaming", "KAMITSUBAKI STUDIO", None, "paid", "full", "studio", "audio", digital[50]["official_url"], True, "song_50_digital", "公式Digital release"),
        (58, "youtube", "ヰ世界情緒", "isekai_official", "free", "full", "studio", "video", links[41]["url"], True, "song_58_video", "公式MV"),
        (77, "youtube", "ヰ世界情緒", "isekai_official", "free", "full", "studio", "video", links[56]["url"], True, "song_77_video", "公式MV"),
        (80, "youtube", "ヰ世界情緒", "isekai_official", "free", "full", "studio", "video", links[71]["url"], True, "song_80_video", "公式MV"),
        (102, "youtube", "V.W.P", "vwp_official", "free", "full", "studio", "video", links[198]["url"], True, "song_102_video", "公式MV"),
        (102, "digital_streaming", "KAMITSUBAKI STUDIO", None, "paid", "full", "studio", "audio", digital[102]["official_url"], True, "song_102_digital", "公式Digital release"),
        (126, "digital_streaming", "KAMITSUBAKI STUDIO", None, "paid", "full", "live", "audio", "https://kamitsubaki.jp/news/2022/12/11/1754/", True, "song_126_release", "CANDY LIVE 2 Streaming & Download"),
        (164, "youtube", "ヰ世界情緒", "isekai_official", "free", "full", "live", "video", SOURCE_164, True, "song_164_video", "公式Anima IIソロLIVE映像"),
        (325, "livestream_archive", "ヰ世界情緒", None, "free", "full", "live", "video", None, False, None, "6周年配信archiveは2026-01-08終了"),
        (357, "youtube", "V.W.P", "vwp_official", "free", "full", "live", "video", links[229]["url"], True, "song_357_video", "公式現象IV LIVE MV"),
        (357, "digital_streaming", "KAMITSUBAKI STUDIO", None, "paid", "full", "other", "audio", None, True, None, "公式Streaming & Download"),
        (367, "youtube", "KAMITSUBAKI official", "other_channel", "free", "full", "studio", "video", links[264]["url"], True, "song_367_video", "公式Character Covers MV"),
        (367, "digital_streaming", "KAMITSUBAKI STUDIO", None, "paid", "full", "studio", "audio", None, True, None, "2026-07-19 exact digital single"),
        (377, "physical_product", "Anima II", None, "paid", "full", "live", "physical", None, False, None, "Anima II track 19 historical physical release"),
        (379, "youtube", "V.W.P", "vwp_official", "free", "full", "live", "video", "https://www.youtube.com/watch?v=wH2NMAwuyqI", True, "song_379_video", "魔女達の夜会 official full archive"),
    ]
    song_check_fields = {
        42: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger"],
        50: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "discovery_category"],
        58: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "tie_up", "discovery_category"],
        77: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "discovery_category"],
        80: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "tie_up", "discovery_category"],
        84: ["artist_credit", "performance_context", "version_kind"],
        102: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "discovery_category"],
        126: ["artist_credit", "performance_context", "original_artist", "original_vocal", "discovery_category"],
        164: ["artist_credit", "performance_context", "version_kind", "discovery_category"],
        325: ["artist_credit", "performance_context", "version_kind", "original_artist", "original_vocal", "original_lyricist", "original_composer", "original_arranger"],
        357: ["artist_credit", "version_kind", "discovery_category"],
        367: ["artist_credit", "original_artist", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "discovery_category"],
        377: ["artist_credit", "performance_context", "original_artist", "original_vocal", "original_lyricist", "original_composer"],
        379: ["artist_credit", "performance_context", "original_artist", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "discovery_category"],
        387: ["artist_credit", "first_date", "first_source", "first_full_date", "first_full_source", "discovery_category"],
        400: ["artist_credit", "performance_context", "first_date", "first_source", "first_full_date", "first_full_source"],
    }
    # Missing entities are not inferred or created merely from a credit name.
    # Any structured assertion requiring one is skipped and reported.
    available_names = set(entities) | {row["canonical_name"] for row in new_entities}
    missing_entities = sorted({name for _group, _role, name, _order in group_credit_specs
                               if name not in available_names}
                              | {name for _song, _role, name, _order in song_credit_specs
                                 if name not in available_names}
                              | {name for names in participation_specs.values() for name in names
                                 if name not in available_names}
                              | {name for subject, _relation, object_name in relationship_specs
                                 for name in (subject, object_name) if name not in available_names})
    group_credit_specs = [spec for spec in group_credit_specs if spec[2] in available_names]
    song_credit_specs = [spec for spec in song_credit_specs if spec[2] in available_names]
    participation_specs = {
        song_id: names for song_id, names in participation_specs.items()
        if all(name in available_names for name in names)
    }
    relationship_specs = [spec for spec in relationship_specs
                          if spec[0] in available_names and spec[2] in available_names]

    # Structured assertions do not overwrite a current Human-confirmed value.
    structured_conflicts: list[dict[str, Any]] = []
    role_fields = {"artist": "work_artist_credit", "vocal": "work_vocal_credit",
                   "lyricist": "work_lyricist_credit", "composer": "work_composer_credit",
                   "arranger": "work_arranger_credit"}
    grouped_specs: dict[tuple[int, str], set[str]] = defaultdict(set)
    for group_id, role, name, _order in group_credit_specs:
        grouped_specs[(group_id, role)].add(name)
    blocked_group_roles: set[tuple[int, str]] = set()
    for (group_id, role), proposed in grouped_specs.items():
        field = role_fields[role]
        current = groups[group_id].get(field)
        if current_check(state["song_group_field_checks"], "song_group_id", group_id,
                         field, current, "human") and credit_tokens(current) != proposed:
            blocked_group_roles.add((group_id, role))
            structured_conflicts.append({"song_group_id": group_id, "role": role,
                                         "human_value": current,
                                         "proposed_credits": sorted(proposed)})
    group_credit_specs = [spec for spec in group_credit_specs
                          if (spec[0], spec[1]) not in blocked_group_roles]

    credits_by_id = {int(row["id"]): row for row in state["song_credits"]}
    human_credit_ids = {
        int(check["song_credit_id"]) for check in state["song_credit_checks"]
        if check["checker_type"] == "human"
        and int(check["song_credit_id"]) in credits_by_id
        and check.get("checked_value") == {
            "role": credits_by_id[int(check["song_credit_id"])]["role"],
            "credit_name": credits_by_id[int(check["song_credit_id"])]["credit_name"],
            "sort_order": int(credits_by_id[int(check["song_credit_id"])]["sort_order"]),
        }
    }
    safe_song_credit_specs = []
    blocked_song_vocals: set[int] = set()
    for spec in song_credit_specs:
        song_id, role, name, order = spec
        occupied = next((row for row in state["song_credits"]
                         if int(row["song_id"]) == song_id and row["role"] == role
                         and int(row["sort_order"]) == order and row["credit_name"] != name), None)
        if occupied is not None and int(occupied["id"]) in human_credit_ids:
            structured_conflicts.append({"song_id": song_id, "role": role,
                                         "sort_order": order,
                                         "human_value": occupied["credit_name"],
                                         "proposed_credit": name})
            if role == "vocal":
                blocked_song_vocals.add(song_id)
        else:
            safe_song_credit_specs.append(spec)
    song_credit_specs = safe_song_credit_specs
    participation_specs = {song_id: names for song_id, names in participation_specs.items()
                           if song_id not in blocked_song_vocals}

    group_check_fields = {group_id: ["work_provenance", *updates.keys()]
                          for group_id, updates in group_updates.items()}
    return {
        "new_entities": new_entities, "song_updates": song_updates, "group_updates": group_updates,
        "group_credit_specs": group_credit_specs, "song_credit_specs": song_credit_specs,
        "participation_specs": participation_specs, "relationship_specs": relationship_specs,
        "origin_specs": origin_specs, "source_specs": source_specs,
        "source_key_by_song": source_key_by_song,
        "additional_source_keys_by_song": additional_source_keys_by_song,
        "availability_specs": availability_specs,
        "song_check_fields": song_check_fields, "group_check_fields": group_check_fields,
        "conflicts": conflicts, "structured_conflicts": structured_conflicts,
        "missing_entities": missing_entities,
        "missing_sources": ["JANE DOE 6周年archive URL (song 325)"],
    }


def plan_summary(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "song_updates": plan["song_updates"], "group_updates": plan["group_updates"],
        "entities": len(plan["new_entities"]), "group_credit_specs": len(plan["group_credit_specs"]),
        "song_credit_specs": len(plan["song_credit_specs"]),
        "participation_specs": sum(len(values) for values in plan["participation_specs"].values()),
        "relationship_specs": len(plan["relationship_specs"]),
        "availability_specs": len(plan["availability_specs"]),
        "conflicts": plan["conflicts"], "structured_conflicts": plan["structured_conflicts"],
        "missing_entities": plan["missing_entities"], "missing_sources": plan["missing_sources"],
    }


def insert_many(api: RestClient, table: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not payloads:
        return []
    result = api.request(table, method="POST", payload=payloads, prefer="return=representation")
    if not isinstance(result, list) or len(result) != len(payloads):
        raise RuntimeError(f"{table}: insert read-back mismatch")
    return result


def patch_one(api: RestClient, table: str, row_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    result = api.request(table, method="PATCH", params=[("id", f"eq.{row_id}")],
                         payload=payload, prefer="return=representation")
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError(f"{table} #{row_id}: patch read-back mismatch")
    return result[0]


def delete_ids(api: RestClient, table: str, values: list[int]) -> None:
    for offset in range(0, len(values), 80):
        api.delete_ids(table, values[offset:offset + 80])


def snapshot(state: dict[str, list[dict[str, Any]]]) -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-ai-verification-batch-01b-{stamp}.json"
    document = {"created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
                "operation": CONFIRM,
                "counts": {table: len(rows) for table, rows in state.items()},
                "hashes": {table: canonical_hash(rows) for table, rows in state.items()},
                "tables": state}
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def apply_plan(api: RestClient, before: dict[str, list[dict[str, Any]]],
               plan: dict[str, Any]) -> dict[str, Any]:
    inserted: dict[str, list[int]] = defaultdict(list)
    patched: dict[str, list[int]] = defaultdict(list)
    try:
        entity_rows = insert_many(api, "entities", plan["new_entities"])
        inserted["entities"].extend(int(row["id"]) for row in entity_rows)
        entities = entity_index([*before["entities"], *entity_rows], before["entity_aliases"])

        for song_id, payload in plan["song_updates"].items():
            if payload:
                patch_one(api, "songs", song_id, payload)
                patched["songs"].append(song_id)
        for group_id, payload in plan["group_updates"].items():
            if payload:
                patch_one(api, "song_groups", group_id, payload)
                patched["song_groups"].append(group_id)

        existing_group_credits = list(before["song_group_credits"])
        group_credit_inserts: list[dict[str, Any]] = []
        for group_id, role, name, order in plan["group_credit_specs"]:
            exact = next((row for row in existing_group_credits
                          if int(row["song_group_id"]) == group_id and row["role"] == role
                          and row["credit_name"] == name), None)
            entity_id = int(entities[name]["id"]) if name in entities else None
            if exact is not None:
                if exact.get("entity_id") != entity_id:
                    patch_one(api, "song_group_credits", int(exact["id"]), {"entity_id": entity_id})
                    patched["song_group_credits"].append(int(exact["id"]))
                continue
            occupied = next((row for row in existing_group_credits
                             if int(row["song_group_id"]) == group_id and row["role"] == role
                             and int(row["sort_order"]) == order), None)
            if occupied is not None:
                if (group_id, role, order) != (80, "vocal", 1):
                    raise RuntimeError(f"group credit position conflict: {group_id}/{role}/{order}")
                patch_one(api, "song_group_credits", int(occupied["id"]),
                          {"credit_name": name, "entity_id": entity_id})
                patched["song_group_credits"].append(int(occupied["id"]))
                occupied.update({"credit_name": name, "entity_id": entity_id})
                continue
            group_credit_inserts.append({
                "song_group_id": group_id, "role": role, "credit_name": name,
                "entity_id": entity_id, "sort_order": order,
                "note": "human-confirmed verification batch 01b work credit",
            })
        created = insert_many(api, "song_group_credits", group_credit_inserts)
        inserted["song_group_credits"].extend(int(row["id"]) for row in created)

        existing_credit_keys = {(int(row["song_id"]), row["role"], row["credit_name"])
                                for row in before["song_credits"]}
        created_credit_rows = insert_many(api, "song_credits", [
            {"song_id": song_id, "role": role, "credit_name": name,
             "entity_id": int(entities[name]["id"]) if name in entities else None,
             "sort_order": order, "note": "human-confirmed verification batch 01b exact credit"}
            for song_id, role, name, order in plan["song_credit_specs"]
            if (song_id, role, name) not in existing_credit_keys
        ])
        inserted["song_credits"].extend(int(row["id"]) for row in created_credit_rows)
        all_credit_rows = [*before["song_credits"], *created_credit_rows]
        verified_credit_rows = [
            next(row for row in all_credit_rows
                 if int(row["song_id"]) == song_id and row["role"] == role
                 and row["credit_name"] == name)
            for song_id, role, name, _order in plan["song_credit_specs"]
        ]

        existing_parts = {(int(row["song_id"]), int(row["entity_id"]), row["participation_role"])
                          for row in before["song_participations"]}
        participation_rows = insert_many(api, "song_participations", [
            {"song_id": song_id, "entity_id": int(entities[name]["id"]),
             "participation_role": "vocal", "sort_order": order,
             "note": "human-confirmed verification batch 01b exact participation"}
            for song_id, names in plan["participation_specs"].items()
            for order, name in enumerate(names, start=1)
            if (song_id, int(entities[name]["id"]), "vocal") not in existing_parts
        ])
        inserted["song_participations"].extend(int(row["id"]) for row in participation_rows)

        existing_relationships = {(int(row["subject_entity_id"]), row["relationship_type"],
                                   int(row["object_entity_id"])) for row in before["entity_relationships"]}
        relationship_rows = insert_many(api, "entity_relationships", [
            {"subject_entity_id": int(entities[subject]["id"]), "relationship_type": relation,
             "object_entity_id": int(entities[object_name]["id"]),
             "note": "human-confirmed verification batch 01b character identity"}
            for subject, relation, object_name in plan["relationship_specs"]
            if (int(entities[subject]["id"]), relation, int(entities[object_name]["id"])) not in existing_relationships
        ])
        inserted["entity_relationships"].extend(int(row["id"]) for row in relationship_rows)

        existing_origin_groups = {int(row["song_group_id"]) for row in before["song_group_origins"]}
        origin_rows = insert_many(api, "song_group_origins", [
            {"song_group_id": group_id, "origin_kind": "external_preexisting",
             "origin_song_id": None, "origin_reference_text": text,
             "note": "human-confirmed verification batch 01b historical origin"}
            for group_id, text in plan["origin_specs"].items() if group_id not in existing_origin_groups
        ])
        inserted["song_group_origins"].extend(int(row["id"]) for row in origin_rows)

        sources = list(before["reference_sources"])
        source_ids: dict[str, int] = {}
        new_source_specs: list[tuple[str, dict[str, Any]]] = []
        for key, spec in plan["source_specs"].items():
            existing = equivalent_source(sources, spec["url"])
            if existing is not None:
                source_ids[key] = int(existing["id"])
            else:
                new_source_specs.append((key, spec))
        new_sources = insert_many(api, "reference_sources", [spec for _key, spec in new_source_specs])
        inserted["reference_sources"].extend(int(row["id"]) for row in new_sources)
        for (key, _spec), row in zip(new_source_specs, new_sources):
            source_ids[key] = int(row["id"])

        local_songs = {int(row["id"]): dict(row) for row in before["songs"]}
        local_groups = {int(row["id"]): dict(row) for row in before["song_groups"]}
        for song_id, payload in plan["song_updates"].items():
            local_songs[song_id].update(payload)
        for group_id, payload in plan["group_updates"].items():
            local_groups[group_id].update(payload)

        song_check_meta = [
            (song_id, field, local_songs[song_id].get(field))
            for song_id, fields in plan["song_check_fields"].items() for field in fields
            if not current_check(before["song_field_checks"], "song_id", song_id, field,
                                 local_songs[song_id].get(field), "ai")
        ]
        song_checks = insert_many(api, "song_field_checks", [
            {"song_id": song_id, "field_name": field, "checked_value": value,
             "checker_type": "ai", "evidence": [],
             "note": "batch 01b: human-confirmed research reconciled against current DB"}
            for song_id, field, value in song_check_meta
        ])
        inserted["song_field_checks"].extend(int(row["id"]) for row in song_checks)
        all_song_checks = [*before["song_field_checks"], *song_checks]
        existing_song_source_keys = {
            (int(row["song_field_check_id"]), int(row["reference_source_id"]))
            for row in before["song_field_check_sources"]
        }
        song_source_rows = []
        for song_id, fields in plan["song_check_fields"].items():
            source_keys = ([plan["source_key_by_song"][song_id]]
                           if song_id in plan["source_key_by_song"] else [])
            source_keys += plan["additional_source_keys_by_song"].get(song_id, [])
            if not source_keys:
                continue
            for field in fields:
                check = current_check(all_song_checks, "song_id", song_id, field,
                                      local_songs[song_id].get(field), "ai")
                for source_key in source_keys:
                    key = (int(check["id"]), source_ids[source_key]) if check else None
                    if check and key not in existing_song_source_keys:
                        song_source_rows.append({"song_field_check_id": int(check["id"]),
                                                 "reference_source_id": source_ids[source_key],
                                                 "evidence_note": "mapped source for batch 01b", "sort_order": 1})
                        existing_song_source_keys.add(key)
        relations = insert_many(api, "song_field_check_sources", song_source_rows)
        inserted["song_field_check_sources"].extend(int(row["id"]) for row in relations)

        group_check_meta = [
            (group_id, field, local_groups[group_id].get(field))
            for group_id, fields in plan["group_check_fields"].items() for field in fields
            if not current_check(before["song_group_field_checks"], "song_group_id", group_id,
                                 field, local_groups[group_id].get(field), "ai")
        ]
        group_checks = insert_many(api, "song_group_field_checks", [
            {"song_group_id": group_id, "field_name": field, "checked_value": value,
             "checker_type": "ai", "evidence": [],
             "note": "batch 01b: human-confirmed work metadata reconciled against current DB"}
            for group_id, field, value in group_check_meta
        ])
        inserted["song_group_field_checks"].extend(int(row["id"]) for row in group_checks)
        group_to_song = {42: 42, 50: 50, 58: 58, 77: 77, 80: 80, 102: 102,
                         126: 126, 336: 325, 367: 367, 377: 377, 379: 379,
                         387: 387, 101: 400}
        all_group_checks = [*before["song_group_field_checks"], *group_checks]
        existing_group_source_keys = {
            (int(row["song_group_field_check_id"]), int(row["reference_source_id"]))
            for row in before["song_group_field_check_sources"]
        }
        group_source_rows = []
        for group_id, fields in plan["group_check_fields"].items():
            song_id = group_to_song[group_id]
            source_keys = ([plan["source_key_by_song"][song_id]]
                           if song_id in plan["source_key_by_song"] else [])
            source_keys += plan["additional_source_keys_by_song"].get(song_id, [])
            if not source_keys:
                continue
            for field in fields:
                check = current_check(all_group_checks, "song_group_id", group_id, field,
                                      local_groups[group_id].get(field), "ai")
                for source_key in source_keys:
                    key = (int(check["id"]), source_ids[source_key]) if check else None
                    if check and key not in existing_group_source_keys:
                        group_source_rows.append({"song_group_field_check_id": int(check["id"]),
                                                  "reference_source_id": source_ids[source_key],
                                                  "evidence_note": "mapped source for batch 01b", "sort_order": 1})
                        existing_group_source_keys.add(key)
        relations = insert_many(api, "song_group_field_check_sources", group_source_rows)
        inserted["song_group_field_check_sources"].extend(int(row["id"]) for row in relations)

        existing_credit_ai = {
            int(row["song_credit_id"]): row for row in before["song_credit_checks"]
            if row["checker_type"] == "ai"
        }
        credit_rows_needing_check = [row for row in verified_credit_rows
                                     if int(row["id"]) not in existing_credit_ai]
        credit_check_rows = insert_many(api, "song_credit_checks", [
            {"song_credit_id": int(credit["id"]),
             "checked_value": {"role": credit["role"], "credit_name": credit["credit_name"],
                               "sort_order": int(credit["sort_order"])},
             "checker_type": "ai", "evidence": [],
             "note": "batch 01b: human-confirmed exact-version credit"}
            for credit in credit_rows_needing_check
        ])
        inserted["song_credit_checks"].extend(int(row["id"]) for row in credit_check_rows)
        credit_source_rows = []
        all_credit_checks = [*before["song_credit_checks"], *credit_check_rows]
        check_by_credit = {int(row["song_credit_id"]): row for row in all_credit_checks
                           if row["checker_type"] == "ai"}
        existing_credit_source_keys = {
            (int(row["song_credit_check_id"]), int(row["reference_source_id"]))
            for row in before["song_credit_check_sources"]
        }
        for credit in verified_credit_rows:
            check = check_by_credit[int(credit["id"])]
            song_id = int(credit["song_id"])
            source_keys = ([plan["source_key_by_song"][song_id]]
                           if song_id in plan["source_key_by_song"] else [])
            source_keys += plan["additional_source_keys_by_song"].get(song_id, [])
            for source_key in source_keys:
                key = (int(check["id"]), source_ids[source_key])
                if key not in existing_credit_source_keys:
                    credit_source_rows.append({"song_credit_check_id": int(check["id"]),
                                               "reference_source_id": source_ids[source_key],
                                               "evidence_note": "mapped source for batch 01b", "sort_order": 1})
                    existing_credit_source_keys.add(key)
        relations = insert_many(api, "song_credit_check_sources", credit_source_rows)
        inserted["song_credit_check_sources"].extend(int(row["id"]) for row in relations)

        existing_availability_keys = {
            (int(row["song_id"]), row.get("access_url"), row.get("platform"),
             row.get("access_type"), row.get("completeness"),
             row.get("content_type"), row.get("media_type"))
            for row in before["song_availabilities"]
        }
        availability_specs = [
            spec for spec in plan["availability_specs"]
            if (spec[0], spec[8], spec[1], spec[4], spec[5], spec[6], spec[7])
            not in existing_availability_keys
        ]
        availability_rows = insert_many(api, "song_availabilities", [
            {"song_id": song_id, "platform": platform, "provider": provider,
             "provider_scope": scope, "access_type": access, "completeness": completeness,
             "content_type": content, "media_type": media, "access_url": url,
             "is_current": current, "note": note}
            for song_id, platform, provider, scope, access, completeness, content, media,
            url, current, _source_key, note in availability_specs
        ])
        inserted["song_availabilities"].extend(int(row["id"]) for row in availability_rows)
        availability_source_rows = [
            {"song_availability_id": int(row["id"]), "reference_source_id": source_ids[source_key],
             "evidence_note": "official source for exact-version availability", "sort_order": 1}
            for row, spec in zip(availability_rows, availability_specs)
            for source_key in [spec[10]] if source_key is not None
        ]
        relations = insert_many(api, "song_availability_sources", availability_source_rows)
        inserted["song_availability_sources"].extend(int(row["id"]) for row in relations)
        return {"inserted": dict(inserted), "patched": dict(patched)}
    except Exception as error:
        rollback(api, before, inserted, patched)
        raise RuntimeError(f"batch 01b failed ({error}); compensating rollback completed") from None


def rollback(api: RestClient, before: dict[str, list[dict[str, Any]]],
             inserted: dict[str, list[int]], patched: dict[str, list[int]]) -> None:
    for table in (
        "song_availability_sources", "song_availabilities",
        "song_credit_check_sources", "song_credit_checks",
        "song_group_field_check_sources", "song_group_field_checks",
        "song_field_check_sources", "song_field_checks",
        "song_participations", "song_credits", "song_group_origins",
        "entity_relationships", "song_group_credits", "reference_sources",
    ):
        delete_ids(api, table, inserted.get(table, []))
    old = {table: {int(row["id"]): row for row in before[table]}
           for table in ("songs", "song_groups", "song_group_credits")}
    for row_id in patched.get("songs", []):
        row = old["songs"][row_id]
        fields = {
            "performance_context", "discovery_category", "original_artist",
            "original_artist_status", "original_vocal", "original_vocal_status",
            "original_lyricist", "original_lyricist_status", "original_composer",
            "original_composer_status", "original_arranger", "original_arranger_status",
        }
        patch_one(api, "songs", row_id, {field: row.get(field) for field in fields})
    for row_id in patched.get("song_groups", []):
        row = old["song_groups"][row_id]
        fields = {"work_artist_credit", "work_vocal_credit", "work_lyricist_credit",
                  "work_composer_credit", "work_arranger_credit"}
        patch_one(api, "song_groups", row_id, {field: row.get(field) for field in fields})
    for row_id in patched.get("song_group_credits", []):
        row = old["song_group_credits"][row_id]
        patch_one(api, "song_group_credits", row_id,
                  {field: row.get(field) for field in ("credit_name", "entity_id")})
    delete_ids(api, "entities", inserted.get("entities", []))


def relation_label(original: set[str], version: set[str]) -> str:
    if original == version:
        return "same"
    if original < version:
        return "added"
    if version < original:
        return "reduced"
    if original.isdisjoint(version):
        return "replaced"
    return "mixed"


def resolved_names(state: dict[str, list[dict[str, Any]]], entity_id: int) -> set[str]:
    names = {int(row["id"]): str(row["canonical_name"]) for row in state["entities"]}
    relationships: dict[tuple[int, str], set[int]] = defaultdict(set)
    for row in state["entity_relationships"]:
        relationships[(int(row["subject_entity_id"]), str(row["relationship_type"]))].add(
            int(row["object_entity_id"]))
    voiced = relationships[(entity_id, "voiced_by")]
    members = relationships[(entity_id, "member")]
    targets = voiced or members or {entity_id}
    return {names[value] for value in targets}


def work_vocals(state: dict[str, list[dict[str, Any]]], group_id: int) -> set[str]:
    result: set[str] = set()
    for row in state["song_group_credits"]:
        if int(row["song_group_id"]) == group_id and row["role"] == "vocal" \
                and row.get("entity_id") is not None:
            result.update(resolved_names(state, int(row["entity_id"])))
    return result


def exact_vocals(state: dict[str, list[dict[str, Any]]], song_id: int) -> set[str]:
    parts = [row for row in state["song_participations"]
             if int(row["song_id"]) == song_id and row["participation_role"] == "vocal"]
    if parts:
        return {name for row in parts for name in resolved_names(state, int(row["entity_id"]))}
    return {name for row in state["song_credits"]
            if int(row["song_id"]) == song_id and row["role"] == "vocal"
            and row.get("entity_id") is not None
            for name in resolved_names(state, int(row["entity_id"]))}


def unchanged_existing(before: list[dict[str, Any]], after: list[dict[str, Any]], table: str) -> None:
    new = {int(row["id"]): row for row in after}
    for row in before:
        if new.get(int(row["id"])) != row:
            raise RuntimeError(f"existing {table} row changed: {row['id']}")


def validate(before: dict[str, list[dict[str, Any]]], after: dict[str, list[dict[str, Any]]],
             plan: dict[str, Any], result: dict[str, Any]) -> dict[str, Any]:
    before_songs = {int(row["id"]): row for row in before["songs"]}
    after_songs = {int(row["id"]): row for row in after["songs"]}
    before_groups = {int(row["id"]): row for row in before["song_groups"]}
    after_groups = {int(row["id"]): row for row in after["song_groups"]}
    if set(after_songs) != set(TARGET_IDS) or set(before_songs) != set(after_songs):
        raise RuntimeError("target song inventory changed")
    if set(before_groups) != set(after_groups):
        raise RuntimeError("target group inventory changed")
    for song_id, fields in plan["song_updates"].items():
        if any(after_songs[song_id].get(field) != value for field, value in fields.items()):
            raise RuntimeError(f"song update mismatch: {song_id}")
    for group_id, fields in plan["group_updates"].items():
        if any(after_groups[group_id].get(field) != value for field, value in fields.items()):
            raise RuntimeError(f"group update mismatch: {group_id}")
    for table in ("song_field_checks", "song_group_field_checks", "song_credit_checks",
                  "song_field_check_sources", "song_group_field_check_sources",
                  "song_credit_check_sources", "song_availability_sources"):
        unchanged_existing(before[table], after[table], table)

    # Every field actually reconciled in this run must now have a current AI check.
    for song_id, fields in plan["song_check_fields"].items():
        for field in fields:
            if not current_check(after["song_field_checks"], "song_id", song_id, field,
                                 after_songs[song_id].get(field), "ai"):
                raise RuntimeError(f"current song AI check missing: {song_id}/{field}")
    for group_id, fields in plan["group_check_fields"].items():
        for field in fields:
            if not current_check(after["song_group_field_checks"], "song_group_id", group_id,
                                 field, after_groups[group_id].get(field), "ai"):
                raise RuntimeError(f"current group AI check missing: {group_id}/{field}")

    for table, owner, keys in (
        ("song_group_credits", "song_group_id", ("role", "sort_order")),
        ("song_credits", "song_id", ("role", "sort_order")),
        ("song_participations", "song_id", ("entity_id", "participation_role")),
    ):
        seen: set[tuple[Any, ...]] = set()
        for row in after[table]:
            key = (row[owner], *(row[column] for column in keys))
            if key in seen:
                raise RuntimeError(f"duplicate structured row in {table}: {key}")
            seen.add(key)

    expected_relations = {
        42: "replaced", 58: "same", 77: "same", 80: "same", 84: "reduced",
        126: "replaced", 164: "reduced", 325: "replaced", 367: "replaced",
        377: "added", 379: "replaced", 400: "reduced",
    }
    relations: dict[str, str] = {}
    for song_id, expected in expected_relations.items():
        group_id = int(after_songs[song_id]["song_group_id"])
        work = work_vocals(after, group_id)
        exact = exact_vocals(after, song_id)
        if not work or not exact:
            relations[str(song_id)] = "skipped_missing_entity"
            continue
        actual = relation_label(work, exact)
        if actual != expected:
            raise RuntimeError(f"vocal relation mismatch: {song_id} expected {expected}, got {actual}")
        relations[str(song_id)] = actual

    entity_types = {str(row["canonical_name"]): row["entity_type"] for row in after["entities"]}
    for name in ("IA", "歌愛ユキ", "初音ミク", "星界"):
        if name in entity_types and entity_types[name] != "voicebank":
            raise RuntimeError(f"voicebank identity lost: {name}")
    exact_367 = {(row["credit_name"], row["role"]) for row in after["song_credits"]
                 if int(row["song_id"]) == 367}
    if not set(plan["missing_entities"]).intersection({"日暮翠", "日暮紅"}) \
            and not {("日暮翠", "vocal"), ("日暮紅", "vocal")} <= exact_367:
        raise RuntimeError("song 367 official character credits missing")

    target_availability = [row for row in after["song_availabilities"]
                           if int(row["song_id"]) in TARGET_IDS]
    if len(target_availability) != (len(before["song_availabilities"])
                                    + len(result["inserted"].get("song_availabilities", []))):
        raise RuntimeError("availability count mismatch")
    for song_id in (325, 377):
        if not any(int(row["song_id"]) == song_id and row["is_current"] is False
                   for row in target_availability):
            raise RuntimeError(f"historical availability missing: {song_id}")
    if any(int(row["song_id"]) == 387 for row in target_availability):
        raise RuntimeError("expired song 387 route was incorrectly added")

    urls = [str(row["url"]) for row in after["reference_sources"]]
    if len(urls) != len(set(urls)):
        raise RuntimeError("reference source URL duplicate")
    for conflict in plan["conflicts"]:
        if "song_id" in conflict:
            value = after_songs[int(conflict["song_id"])].get(conflict["field"])
        else:
            value = after_groups[int(conflict["song_group_id"])].get(conflict["field"])
        if value != conflict["human_value"]:
            raise RuntimeError(f"Human conflict overwritten: {conflict}")

    inserted = result["inserted"]
    return {
        "song_checks_added": len(inserted.get("song_field_checks", [])),
        "group_checks_added": len(inserted.get("song_group_field_checks", [])),
        "credit_checks_added": len(inserted.get("song_credit_checks", [])),
        "sources_added": len(inserted.get("reference_sources", [])),
        "source_relations_added": sum(len(inserted.get(table, [])) for table in (
            "song_field_check_sources", "song_group_field_check_sources",
            "song_credit_check_sources", "song_availability_sources")),
        "entities_added": len(inserted.get("entities", [])),
        "group_credits_added": len(inserted.get("song_group_credits", [])),
        "song_credits_added": len(inserted.get("song_credits", [])),
        "participations_added": len(inserted.get("song_participations", [])),
        "relationships_added": len(inserted.get("entity_relationships", [])),
        "origins_added": len(inserted.get("song_group_origins", [])),
        "availabilities_added": len(inserted.get("song_availabilities", [])),
        "vocal_relations": relations,
        "conflicts": plan["conflicts"], "missing_sources": plan["missing_sources"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--compact", action="store_true")
    parser.add_argument("--tail", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()
    api = service_client()
    state = fetch_state(api)
    plan = build_plan(state)
    if not args.apply and not (args.compact or args.tail):
        print(json.dumps({"mode": "dry-run", "plan": plan_summary(plan)}, ensure_ascii=False, indent=2))
        return
    if args.apply:
        if args.confirm != CONFIRM:
            raise SystemExit(f"--apply requires --confirm {CONFIRM}")
        path = snapshot(state)
        print(f"snapshot: {path}", flush=True)
        result = apply_plan(api, state, plan)
        try:
            validation = validate(state, fetch_state(api), plan, result)
        except Exception as error:
            rollback(api, state, defaultdict(list, result["inserted"]),
                     defaultdict(list, result["patched"]))
            raise RuntimeError(f"validation failed ({error}); compensating rollback completed") from None
        print(json.dumps({"mode": "applied", "snapshot": str(path),
                          "validation": validation}, ensure_ascii=False, indent=2))
        return
    report = compact_summary(state) if (args.compact or args.tail) else summary(state)
    if args.tail:
        tail_ids = {325, 357, 367, 377, 379, 387, 400}
        tail_groups = {int(row["song_group_id"]) for row in state["songs"] if int(row["id"]) in tail_ids}
        report = {
            "songs": [row for row in report["songs"] if int(row["id"]) in tail_ids],
            "group_credits": [row for row in report["group_credits"] if int(row["song_group_id"]) in tail_groups],
            "song_credits": [row for row in report["song_credits"] if int(row["song_id"]) in tail_ids],
            "participations": [row for row in report["participations"] if int(row["song_id"]) in tail_ids],
            "origins": [row for row in report["origins"] if int(row["song_group_id"]) in tail_groups],
            "links": [row for row in report["links"] if int(row["target_id"]) in tail_ids],
            "availabilities": [row for row in report["availabilities"] if int(row["song_id"]) in tail_ids],
            "digital_releases": [row for row in report["digital_releases"] if int(row["song_id"]) in tail_ids],
            "release_items": [row for row in report["release_items"] if int(row.get("song_id") or 0) in tail_ids],
        }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
