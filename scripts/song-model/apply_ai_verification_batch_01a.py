"""Guarded production backfill for AI-verification batch 01a.

Default execution is read-only. Writes require ``--apply`` and the exact
confirmation token. A complete pre-write snapshot is saved, and failures
compensate only changes made by this run.
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
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402


CONFIRM: Final = "AI_VERIFICATION_BATCH_01A"
TARGET_IDS: Final = (21, 27, 54, 87, 116, 161, 353, 391)
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-verification"
TABLES: Final = (
    "songs", "song_groups", "entities", "entity_relationships",
    "song_group_credits", "song_group_origins", "song_credits",
    "song_participations", "song_field_checks", "song_field_check_sources",
    "song_group_field_checks", "song_group_field_check_sources",
    "song_credit_checks", "song_credit_check_sources", "reference_sources",
    "links", "release_groups", "releases", "release_components",
    "release_items", "release_sources", "song_availabilities",
    "song_availability_sources", "song_digital_releases",
)


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in TABLES}


def fetch_tables(api: RestClient, tables: tuple[str, ...]) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in tables}


def snapshot_path() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-ai-verification-batch-01a-{stamp}.json"
    sequence = 1
    while path.exists():
        path = SNAPSHOT_ROOT / f"before-ai-verification-batch-01a-{stamp}-{sequence}.json"
        sequence += 1
    return path


def write_snapshot(path: Path, state: dict[str, list[dict[str, Any]]]) -> None:
    document = {
        "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "operation": CONFIRM,
        "counts": {table: len(rows) for table, rows in state.items()},
        "hashes": {table: canonical_hash(rows) for table, rows in state.items()},
        "tables": state,
    }
    with path.open("x", encoding="utf-8") as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def insert_many(api: RestClient, table: str, rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not rows:
        return []
    result = api.request(table, method="POST", payload=rows, prefer="return=representation")
    if not isinstance(result, list) or len(result) != len(rows):
        raise RuntimeError(f"{table}: insert read-back mismatch")
    return result


def patch_one(api: RestClient, table: str, row_id: int, payload: dict[str, Any]) -> None:
    result = api.request(
        table, method="PATCH", params=[("id", f"eq.{row_id}")],
        payload=payload, prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1 or int(result[0]["id"]) != row_id:
        raise RuntimeError(f"{table} #{row_id}: patch read-back mismatch")


def delete_ids(api: RestClient, table: str, ids: list[int]) -> None:
    for offset in range(0, len(ids), 80):
        api.delete_ids(table, ids[offset:offset + 80])


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
    for source in sources:
        if source["url"] == url or (key is not None and youtube_key(str(source["url"])) == key):
            return source
    return None


def current_check(rows: list[dict[str, Any]], owner_key: str, owner_id: int,
                  field: str, value: Any, checker: str) -> dict[str, Any] | None:
    return next((row for row in rows if int(row[owner_key]) == owner_id
                 and row["field_name"] == field and row.get("checked_value") == value
                 and row["checker_type"] == checker), None)


def credit_snapshot(row: dict[str, Any]) -> dict[str, Any]:
    return {"role": row["role"], "credit_name": row["credit_name"],
            "sort_order": int(row["sort_order"])}


def release_by_id(state: dict[str, list[dict[str, Any]]], release_id: int) -> dict[str, Any]:
    return next(row for row in state["releases"] if int(row["id"]) == release_id)


def link_by_song(state: dict[str, list[dict[str, Any]]], song_id: int) -> dict[str, Any]:
    return next(row for row in state["links"] if row.get("target_type") == "song"
                and int(row["target_id"]) == song_id)


def build_plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {int(row["id"]): row for row in state["songs"]}
    groups = {int(row["id"]): row for row in state["song_groups"]}
    expected_groups = {21: 21, 27: 49, 54: 309, 87: 87, 116: 116, 161: 161, 353: 68, 391: 117}
    if any(int(songs[sid]["song_group_id"]) != gid for sid, gid in expected_groups.items()):
        raise RuntimeError("target song-group mapping drifted")
    links = {sid: link_by_song(state, sid) for sid in (21, 116, 353)}
    release154 = release_by_id(state, 154)
    components = {int(row["id"]): row for row in state["release_components"]}
    if release154["official_url"] != "https://findmestore.thinkr.jp/products/ktr-100-0184":
        raise RuntimeError("現象II product source drifted")
    if not any(int(row["id"]) == 24 and row["url"] == release154["official_url"]
               for row in state["reference_sources"]):
        raise RuntimeError("現象II reference source #24 drifted")
    if {components[111]["medium"], components[112]["medium"]} != {"blu_ray", "cd"}:
        raise RuntimeError("現象II components drifted")
    if any(int(row.get("song_id") or 0) == 391 for row in state["release_items"]):
        raise RuntimeError("song 391 release items already exist")
    if any(int(row["song_id"]) in TARGET_IDS for row in state["song_participations"]):
        raise RuntimeError("target participation rows unexpectedly already exist")

    source_specs = [
        {"url": links[sid]["url"], "title": links[sid].get("title"),
         "publisher": "ヰ世界情緒 -Isekaijoucho-" if sid in {21, 116} else "V.W.P -Virtual Witch Phenomenon-",
         "source_type": "official_youtube", "published_at": links[sid].get("published_date"),
         "note": "AI verification batch 01a; reused existing navigation link"}
        for sid in (21, 116, 353)
    ]
    for release_id in (31, 10):
        release = release_by_id(state, release_id)
        source_specs.append({
            "url": release["official_url"], "title": release["title"],
            "publisher": "KAMITSUBAKI STUDIO", "source_type": "official_site",
            "published_at": release.get("release_date"),
            "note": "AI verification batch 01a; reused existing release URL",
        })

    existing_entities = {str(row["canonical_name"]) for row in state["entities"]}
    entity_specs = {"somunia": "artist", "samayuzame": "artist", "MIMI": "artist", "水野あつ": "artist"}
    new_entities = [{"canonical_name": name, "entity_type": kind,
                     "note": "human-confirmed batch 01a credit/entity resolution"}
                    for name, kind in entity_specs.items() if name not in existing_entities]
    group_updates = {
        87: {"work_vocal_credit": "森先化歩 & 夜河世界", "work_lyricist_credit": "MIMI",
             "work_composer_credit": "MIMI", "work_arranger_credit": "MIMI"},
        116: {"work_provenance": "cover"},
        161: {"work_provenance": "cover", "work_vocal_credit": "花譜"},
    }
    song_updates = {353: {"first_status": "confirmed", "first_full_status": "confirmed"}}
    for song_id, updates in song_updates.items():
        for field, value in updates.items():
            if any(int(row["song_id"]) == song_id and row["field_name"] == field
                   and row["checker_type"] == "human" and row.get("checked_value") == songs[song_id].get(field)
                   for row in state["song_field_checks"]) and songs[song_id].get(field) != value:
                raise RuntimeError(f"Human current conflict: songs #{song_id}.{field}")
    for group_id, updates in group_updates.items():
        for field, value in updates.items():
            if any(int(row["song_group_id"]) == group_id and row["field_name"] == field
                   and row["checker_type"] == "human" and row.get("checked_value") == groups[group_id].get(field)
                   for row in state["song_group_field_checks"]) and groups[group_id].get(field) != value:
                raise RuntimeError(f"Human current conflict: song_groups #{group_id}.{field}")

    group_credit_specs = [
        (87, "vocal", "森先化歩", 1), (87, "vocal", "夜河世界", 2),
        (87, "lyricist", "MIMI", 1), (87, "composer", "MIMI", 1), (87, "arranger", "MIMI", 1),
        (161, "vocal", "花譜", 1),
    ]
    song_credit_specs = [
        (21, "vocal", "somunia", 1), (21, "vocal", "ヰ世界情緒", 2),
        (21, "lyricist", "samayuzame", 1), (21, "composer", "samayuzame", 1), (21, "arranger", "samayuzame", 1),
        (54, "vocal", "幸祜", 1), (54, "vocal", "ヰ世界情緒", 2),
        (87, "vocal", "森先化歩", 1), (87, "vocal", "夜河世界", 2),
        (87, "lyricist", "MIMI", 1), (87, "composer", "MIMI", 1), (87, "arranger", "MIMI", 1),
        (116, "vocal", "星界", 1), (116, "vocal", "ヰ世界情緒", 2),
        (116, "lyricist", "水野あつ", 1), (116, "composer", "水野あつ", 1), (116, "arranger", "水野あつ", 1),
        (161, "vocal", "V.W.P", 1), (353, "vocal", "V.W.P", 1),
        (391, "vocal", "V.W.P with 狐子", 1),
    ]
    existing_credit_keys = {(int(r["song_id"]), r["role"], r["credit_name"]) for r in state["song_credits"]}
    song_credit_specs = [spec for spec in song_credit_specs if spec[:3] not in existing_credit_keys]
    participation_specs = {
        21: ["somunia", "ヰ世界情緒"], 27: ["花譜", "理芽", "春猿火", "ヰ世界情緒"],
        54: ["幸祜", "ヰ世界情緒"], 87: ["花譜", "ヰ世界情緒"],
        116: ["星界", "ヰ世界情緒"], 161: ["花譜", "理芽", "春猿火", "ヰ世界情緒", "幸祜"],
        353: ["V.W.P"], 391: ["花譜", "理芽", "春猿火", "ヰ世界情緒", "狐子"],
    }
    song_check_fields = {
        21: ["artist_credit", "discovery_category", "original_vocal", "original_lyricist", "original_composer", "original_arranger"],
        27: ["artist_credit", "first_date", "first_source", "first_full_date", "first_full_source", "original_vocal", "version_name"],
        54: ["artist_credit", "first_date", "first_source", "first_full_date", "first_full_source", "performance_context", "discovery_category"],
        87: ["artist_credit", "original_vocal", "original_lyricist", "original_composer", "original_arranger"],
        116: ["artist_credit", "first_date", "first_source", "first_full_date", "first_full_source", "original_artist", "original_vocal", "original_lyricist", "original_composer", "original_arranger", "discovery_category"],
        161: ["artist_credit", "discovery_category"],
        353: ["artist_credit", "first_date", "first_source", "first_full_date", "first_full_source", "version_kind", "tie_up", "discovery_category"],
        391: ["artist_credit", "first_date", "first_source", "first_full_date", "first_full_source", "performance_context", "discovery_category"],
    }
    group_check_fields = {
        21: ["work_provenance", "work_vocal_credit", "work_lyricist_credit", "work_composer_credit", "work_arranger_credit"],
        87: ["work_provenance", *group_updates[87]],
        116: ["work_provenance", "work_artist_credit", "work_vocal_credit", "work_lyricist_credit", "work_composer_credit", "work_arranger_credit"],
        161: ["work_provenance", "work_vocal_credit"],
    }
    availability_specs = [
        (21, "youtube", "ヰ世界情緒 -Isekaijoucho-", "isekai_official", "free", "full", "studio", "video", links[21]["url"], True, "公式リリックMVで現在無料フル視聴可能"),
        (54, "physical_product", "ARARE LIVE CD", None, "paid", "full", "live", "physical", None, False, "公式ARARE LIVE CD DISC2 track 21。商品はsold outのためhistorical availability"),
        (116, "youtube", "ヰ世界情緒 -Isekaijoucho-", "isekai_official", "free", "full", "studio", "video", links[116]["url"], True, "公式リリックMVで現在無料フル視聴可能"),
        (353, "youtube", "V.W.P -Virtual Witch Phenomenon-", "vwp_official", "free", "full", "studio", "video", links[353]["url"], True, "公式MVで現在無料フル視聴可能"),
        (391, "physical_product", "FINDME STORE", None, "paid", "full", "live", "physical", release154["official_url"], False, "現象II（再）Blu-ray。sold outのためhistorical availability"),
        (391, "physical_product", "FINDME STORE", None, "paid", "full", "live", "physical", release154["official_url"], False, "現象II（再）LIVE CD。sold outのためhistorical availability"),
    ]
    return {
        "new_entities": new_entities, "source_specs": source_specs,
        "group_updates": group_updates, "song_updates": song_updates,
        "group_credit_specs": group_credit_specs, "song_credit_specs": song_credit_specs,
        "participation_specs": participation_specs, "song_check_fields": song_check_fields,
        "group_check_fields": group_check_fields,
        "add_origin_116": not any(int(row["song_group_id"]) == 116 for row in state["song_group_origins"]),
        "availability_specs": availability_specs,
        "conflicts": [
            {"song_id": 161, "field": "original_artist / original_vocal",
             "human_value": "- / V.W.P", "research_value": "花譜 / 花譜"},
            {"song_id": 353, "field": "song_credits.arranger",
             "human_value": "カンザキイオリ & 及川創介", "research_value": "及川創介"},
        ],
        "needs_human": [
            {"song_id": 54, "field": "release item/source",
             "reason": "ARARE LIVE unified release and reusable official source are absent; no release was inferred"},
        ],
    }


def plan_summary(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "target_songs": list(TARGET_IDS), "song_field_updates": plan["song_updates"],
        "group_field_updates": plan["group_updates"], "entities": len(plan["new_entities"]),
        "group_credits": len(plan["group_credit_specs"]), "song_credits": len(plan["song_credit_specs"]),
        "participations": sum(map(len, plan["participation_specs"].values())),
        "release_items": 2, "availabilities": len(plan["availability_specs"]),
        "potential_new_sources": len(plan["source_specs"]), "conflicts": plan["conflicts"],
        "needs_human": plan["needs_human"],
    }


def apply_plan(api: RestClient, before: dict[str, list[dict[str, Any]]],
               plan: dict[str, Any]) -> dict[str, Any]:
    inserted: dict[str, list[int]] = defaultdict(list)
    patched: dict[str, list[int]] = defaultdict(list)
    try:
        print("apply: entities", flush=True)
        entity_rows = insert_many(api, "entities", plan["new_entities"])
        inserted["entities"].extend(int(row["id"]) for row in entity_rows)
        entities = {str(row["canonical_name"]): row for row in [*before["entities"], *entity_rows]}

        print("apply: sources", flush=True)
        sources = list(before["reference_sources"])
        source_for_url: dict[str, int] = {}
        for spec in plan["source_specs"]:
            existing = equivalent_source(sources, spec["url"])
            if existing is None:
                existing = insert_many(api, "reference_sources", [spec])[0]
                inserted["reference_sources"].append(int(existing["id"]))
                sources.append(existing)
            source_for_url[spec["url"]] = int(existing["id"])

        print("apply: song/group fields", flush=True)
        for group_id, payload in plan["group_updates"].items():
            patch_one(api, "song_groups", group_id, payload)
            patched["song_groups"].append(group_id)
        for song_id, payload in plan["song_updates"].items():
            patch_one(api, "songs", song_id, payload)
            patched["songs"].append(song_id)

        print("apply: credits and participations", flush=True)
        existing_group_credit_keys = {
            (int(row["song_group_id"]), row["role"], row["credit_name"])
            for row in before["song_group_credits"]
        }
        group_credit_rows = [
            {"song_group_id": group_id, "role": role, "credit_name": name,
             "entity_id": int(entities[name]["id"]), "sort_order": order,
             "note": "human-confirmed batch 01a work credit"}
            for group_id, role, name, order in plan["group_credit_specs"]
            if (group_id, role, name) not in existing_group_credit_keys
        ]
        created = insert_many(api, "song_group_credits", group_credit_rows)
        inserted["song_group_credits"].extend(int(row["id"]) for row in created)

        for row in before["song_group_credits"]:
            name = str(row["credit_name"])
            should_resolve = (
                int(row["song_group_id"]) == 21 and name == "samayuzame"
            ) or (
                int(row["song_group_id"]) == 116 and name == "水野あつ"
            )
            if should_resolve and row.get("entity_id") is None:
                patch_one(api, "song_group_credits", int(row["id"]),
                          {"entity_id": int(entities[name]["id"])})
                patched["song_group_credits"].append(int(row["id"]))

        credit_rows = insert_many(api, "song_credits", [
            {"song_id": sid, "role": role, "credit_name": name,
             "entity_id": int(entities[name]["id"]) if name in entities else None,
             "sort_order": order, "note": "human-confirmed batch 01a exact-version credit"}
            for sid, role, name, order in plan["song_credit_specs"]
        ])
        inserted["song_credits"].extend(int(row["id"]) for row in credit_rows)

        participation_rows = insert_many(api, "song_participations", [
            {"song_id": sid, "entity_id": int(entities[name]["id"]),
             "participation_role": "vocal", "sort_order": order,
             "note": "human-confirmed batch 01a actual exact-version participation"}
            for sid, names in plan["participation_specs"].items()
            for order, name in enumerate(names, start=1)
        ])
        inserted["song_participations"].extend(int(row["id"]) for row in participation_rows)

        if plan["add_origin_116"]:
            origin = insert_many(api, "song_group_origins", [{
                "song_group_id": 116, "origin_kind": "external_preexisting",
                "origin_song_id": None, "origin_reference_text": "水野あつ feat. 星界「回想」",
                "note": "human-confirmed batch 01a historical origin",
            }])[0]
            inserted["song_group_origins"].append(int(origin["id"]))

        print("apply: batched checks", flush=True)
        songs = {int(row["id"]): dict(row) for row in before["songs"]}
        groups = {int(row["id"]): dict(row) for row in before["song_groups"]}
        for song_id, updates in plan["song_updates"].items():
            songs[song_id].update(updates)
        for group_id, updates in plan["group_updates"].items():
            groups[group_id].update(updates)
        source_by_song = {
            21: source_for_url[link_by_song(before, 21)["url"]],
            116: source_for_url[link_by_song(before, 116)["url"]],
            353: source_for_url[link_by_song(before, 353)["url"]],
            161: source_for_url[release_by_id(before, 10)["official_url"]],
            391: 24,
        }

        song_check_meta = [
            (song_id, field, songs[song_id].get(field))
            for song_id, fields in plan["song_check_fields"].items() for field in fields
            if not current_check(before["song_field_checks"], "song_id", song_id,
                                 field, songs[song_id].get(field), "ai")
        ]
        song_checks = insert_many(api, "song_field_checks", [
            {"song_id": song_id, "field_name": field, "checked_value": value,
             "checker_type": "ai", "evidence": [],
             "note": "batch 01a: human-confirmed research reconciled against current DB"}
            for song_id, field, value in song_check_meta
        ])
        inserted["song_field_checks"].extend(int(row["id"]) for row in song_checks)
        song_source_rows = [
            {"song_field_check_id": int(check["id"]),
             "reference_source_id": source_by_song[song_id],
             "evidence_note": "existing official source reused for batch 01a", "sort_order": 1}
            for check, (song_id, _field, _value) in zip(song_checks, song_check_meta)
            if song_id in source_by_song
        ]
        relations = insert_many(api, "song_field_check_sources", song_source_rows)
        inserted["song_field_check_sources"].extend(int(row["id"]) for row in relations)

        group_source_song = {21: 21, 116: 116, 161: 161}
        group_check_meta = [
            (group_id, field, groups[group_id].get(field))
            for group_id, fields in plan["group_check_fields"].items() for field in fields
            if not current_check(before["song_group_field_checks"], "song_group_id",
                                 group_id, field, groups[group_id].get(field), "ai")
        ]
        group_checks = insert_many(api, "song_group_field_checks", [
            {"song_group_id": group_id, "field_name": field, "checked_value": value,
             "checker_type": "ai", "evidence": [],
             "note": "batch 01a: human-confirmed work metadata reconciled against current DB"}
            for group_id, field, value in group_check_meta
        ])
        inserted["song_group_field_checks"].extend(int(row["id"]) for row in group_checks)
        group_source_rows = [
            {"song_group_field_check_id": int(check["id"]),
             "reference_source_id": source_by_song[group_source_song[group_id]],
             "evidence_note": "existing official source reused for batch 01a", "sort_order": 1}
            for check, (group_id, _field, _value) in zip(group_checks, group_check_meta)
            if group_id in group_source_song
        ]
        relations = insert_many(api, "song_group_field_check_sources", group_source_rows)
        inserted["song_group_field_check_sources"].extend(int(row["id"]) for row in relations)

        existing_id27 = [row for row in before["song_credits"] if int(row["song_id"]) == 27]
        checked_credits = [
            credit for credit in [*credit_rows, *existing_id27]
            if not any(int(row["song_credit_id"]) == int(credit["id"])
                       and row["checker_type"] == "ai"
                       and row["checked_value"] == credit_snapshot(credit)
                       for row in before["song_credit_checks"])
        ]
        credit_checks = insert_many(api, "song_credit_checks", [
            {"song_credit_id": int(credit["id"]), "checked_value": credit_snapshot(credit),
             "checker_type": "ai", "evidence": [],
             "note": "batch 01a: human-confirmed exact-version credit"}
            for credit in checked_credits
        ])
        inserted["song_credit_checks"].extend(int(row["id"]) for row in credit_checks)
        credit_source_rows = [
            {"song_credit_check_id": int(check["id"]),
             "reference_source_id": source_by_song[int(credit["song_id"])],
             "evidence_note": "existing official source reused for batch 01a", "sort_order": 1}
            for check, credit in zip(credit_checks, checked_credits)
            if int(credit["song_id"]) in source_by_song
        ]
        relations = insert_many(api, "song_credit_check_sources", credit_source_rows)
        inserted["song_credit_check_sources"].extend(int(row["id"]) for row in relations)

        print("apply: releases and availability", flush=True)
        release_rows = insert_many(api, "release_items", [
            {"release_id": 154, "release_group_id": 133,
             "release_component_id": component_id, "song_id": 391,
             "track_number": None, "sort_order": 4, "track_title": "再会",
             "track_artist": "V.W.P with 狐子",
             "notes": "official 現象II（再）Blu-ray / LIVE CD track 4"}
            for component_id in (111, 112)
        ])
        inserted["release_items"].extend(int(row["id"]) for row in release_rows)

        availability_rows = insert_many(api, "song_availabilities", [
            {"song_id": sid, "platform": platform, "provider": provider,
             "provider_scope": scope, "access_type": access,
             "completeness": completeness, "content_type": content,
             "media_type": media, "access_url": url, "is_current": current_flag,
             "note": note}
            for sid, platform, provider, scope, access, completeness, content,
            media, url, current_flag, note in plan["availability_specs"]
        ])
        inserted["song_availabilities"].extend(int(row["id"]) for row in availability_rows)
        relations = insert_many(api, "song_availability_sources", [
            {"song_availability_id": int(row["id"]),
             "reference_source_id": source_by_song[int(row["song_id"])],
             "evidence_note": "official source for exact-version availability", "sort_order": 1}
            for row in availability_rows if int(row["song_id"]) in source_by_song
        ])
        inserted["song_availability_sources"].extend(int(row["id"]) for row in relations)

        release_source_payloads = []
        for release_id in (31, 10):
            source_id = source_for_url[release_by_id(before, release_id)["official_url"]]
            if not any(int(row["release_id"]) == release_id and int(row["reference_source_id"]) == source_id
                       for row in before["release_sources"]):
                release_source_payloads.append({
                    "release_id": release_id, "reference_source_id": source_id,
                    "evidence_note": "existing official release page reused", "sort_order": 1})
        relations = insert_many(api, "release_sources", release_source_payloads)
        inserted["release_sources"].extend(int(row["id"]) for row in relations)
        print("apply: complete", flush=True)
        return {"inserted": dict(inserted), "patched": dict(patched)}
    except Exception as error:
        print(f"apply error before rollback: {error!r}", file=sys.stderr, flush=True)
        rollback(api, before, inserted, patched)
        raise RuntimeError(f"batch apply failed ({error}); compensating rollback completed") from None


def rollback(api: RestClient, before: dict[str, list[dict[str, Any]]],
             inserted: dict[str, list[int]], patched: dict[str, list[int]]) -> None:
    for table in (
        "song_availability_sources", "song_availabilities", "release_items",
        "release_sources", "song_credit_check_sources", "song_credit_checks",
        "song_group_field_check_sources", "song_group_field_checks",
        "song_field_check_sources", "song_field_checks", "song_participations",
        "song_credits", "song_group_origins", "song_group_credits",
        "reference_sources",
    ):
        delete_ids(api, table, inserted.get(table, []))
    old_rows = {table: {int(row["id"]): row for row in before[table]}
                for table in ("songs", "song_groups", "song_group_credits")}
    for row_id in patched.get("songs", []):
        old = old_rows["songs"][row_id]
        patch_one(api, "songs", row_id, {
            "original_artist": old.get("original_artist"),
            "original_vocal": old.get("original_vocal"),
            "first_status": old.get("first_status"),
            "first_full_status": old.get("first_full_status"),
        })
    for row_id in patched.get("song_groups", []):
        old = old_rows["song_groups"][row_id]
        patch_one(api, "song_groups", row_id, {
            "work_provenance": old.get("work_provenance"),
            "work_vocal_credit": old.get("work_vocal_credit"),
            "work_lyricist_credit": old.get("work_lyricist_credit"),
            "work_composer_credit": old.get("work_composer_credit"),
            "work_arranger_credit": old.get("work_arranger_credit"),
        })
    for row_id in patched.get("song_group_credits", []):
        patch_one(api, "song_group_credits", row_id,
                  {"entity_id": old_rows["song_group_credits"][row_id].get("entity_id")})
    delete_ids(api, "entities", inserted.get("entities", []))


def recover_snapshot(api: RestClient, path: Path) -> dict[str, Any]:
    document = json.loads(path.read_text(encoding="utf-8"))
    before = document["tables"]
    tables = ("songs", "song_groups", "entities", "reference_sources",
              "song_group_credits", "song_group_origins", "song_credits",
              "song_participations")
    current = {table: select_all(api, table) for table in tables}
    inserted: dict[str, list[int]] = {}
    for table in tables[2:]:
        old_ids = {int(row["id"]) for row in before[table]}
        inserted[table] = [int(row["id"]) for row in current[table] if int(row["id"]) not in old_ids]
    for table in ("song_participations", "song_credits", "song_group_origins", "song_group_credits"):
        delete_ids(api, table, inserted[table])
    old_credit = {int(row["id"]): row for row in before["song_group_credits"]}
    changed_credit_ids = [int(row["id"]) for row in current["song_group_credits"]
                          if int(row["id"]) in old_credit and row != old_credit[int(row["id"])]]
    if changed_credit_ids:
        api.request("song_group_credits", method="PATCH",
                    params=[("id", f"in.({','.join(map(str, changed_credit_ids))})")],
                    payload={"entity_id": None}, prefer="return=minimal")
    old_groups = {int(row["id"]): row for row in before["song_groups"]}
    for group_id in (87, 116, 161):
        old = old_groups[group_id]
        patch_one(api, "song_groups", group_id, {
            "work_provenance": old.get("work_provenance"),
            "work_vocal_credit": old.get("work_vocal_credit"),
            "work_lyricist_credit": old.get("work_lyricist_credit"),
            "work_composer_credit": old.get("work_composer_credit"),
            "work_arranger_credit": old.get("work_arranger_credit"),
        })
    old_songs = {int(row["id"]): row for row in before["songs"]}
    patch_one(api, "songs", 353, {
        "first_status": old_songs[353].get("first_status"),
        "first_full_status": old_songs[353].get("first_full_status"),
    })
    delete_ids(api, "reference_sources", inserted["reference_sources"])
    delete_ids(api, "entities", inserted["entities"])
    return {"recovered_from": str(path), "deleted": inserted,
            "restored_group_credits": changed_credit_ids}


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


def resolved_group_vocals(state: dict[str, list[dict[str, Any]]], group_id: int) -> set[str]:
    names = {int(row["id"]): str(row["canonical_name"]) for row in state["entities"]}
    members: dict[int, set[int]] = defaultdict(set)
    voiced: dict[int, set[int]] = defaultdict(set)
    for row in state["entity_relationships"]:
        relation = str(row["relationship_type"])
        if relation == "member":
            members[int(row["subject_entity_id"])].add(int(row["object_entity_id"]))
        elif relation == "voiced_by":
            voiced[int(row["subject_entity_id"])].add(int(row["object_entity_id"]))
    result: set[str] = set()
    for credit in state["song_group_credits"]:
        if int(credit["song_group_id"]) != group_id or credit["role"] != "vocal" \
                or credit.get("entity_id") is None:
            continue
        entity_id = int(credit["entity_id"])
        result.update(names[value] for value in (voiced[entity_id] or members[entity_id] or {entity_id}))
    return result


def validate(before: dict[str, list[dict[str, Any]]],
             after: dict[str, list[dict[str, Any]]], plan: dict[str, Any],
             result: dict[str, Any]) -> dict[str, Any]:
    before_songs = {int(row["id"]): row for row in before["songs"]}
    after_songs = {int(row["id"]): row for row in after["songs"]}
    before_groups = {int(row["id"]): row for row in before["song_groups"]}
    after_groups = {int(row["id"]): row for row in after["song_groups"]}
    if set(before_songs) != set(after_songs) or set(before_groups) != set(after_groups):
        raise RuntimeError("song/group inventory changed")
    for song_id in set(before_songs) - set(TARGET_IDS):
        if before_songs[song_id] != after_songs[song_id]:
            raise RuntimeError(f"non-target song changed: {song_id}")
    for song_id, updates in plan["song_updates"].items():
        if any(after_songs[song_id].get(field) != value for field, value in updates.items()):
            raise RuntimeError(f"song update mismatch: {song_id}")
    for group_id, updates in plan["group_updates"].items():
        if any(after_groups[group_id].get(field) != value for field, value in updates.items()):
            raise RuntimeError(f"group update mismatch: {group_id}")

    for table in ("song_field_checks", "song_group_field_checks", "song_credit_checks"):
        old = {int(row["id"]): row for row in before[table]}
        new = {int(row["id"]): row for row in after[table]}
        if any(new.get(row_id) != row for row_id, row in old.items()):
            raise RuntimeError(f"existing {table} history changed")

    names = {int(row["id"]): str(row["canonical_name"]) for row in after["entities"]}
    actual: dict[int, set[str]] = defaultdict(set)
    for row in after["song_participations"]:
        if int(row["song_id"]) in TARGET_IDS:
            actual[int(row["song_id"])].add(names[int(row["entity_id"])])
    expected_actual = {song_id: set(values) for song_id, values in plan["participation_specs"].items()}
    if actual != expected_actual:
        raise RuntimeError("exact participation mismatch")
    if relation_label(resolved_group_vocals(after, 116), actual[116]) != "added":
        raise RuntimeError("song 116 vocal relation is not added")
    if relation_label(resolved_group_vocals(after, 117), actual[391]) != "mixed":
        raise RuntimeError("song 391 vocal relation is not mixed")
    if not any(int(row["song_id"]) == 116 and names[int(row["entity_id"])] == "星界"
               and next(entity for entity in after["entities"] if int(entity["id"]) == int(row["entity_id"]))["entity_type"] == "voicebank"
               for row in after["song_participations"]):
        raise RuntimeError("星界 was not preserved as voicebank participation")
    if not any(int(row["song_id"]) == 391 and names[int(row["entity_id"])] == "狐子"
               and next(entity for entity in after["entities"] if int(entity["id"]) == int(row["entity_id"]))["entity_type"] == "voicebank"
               for row in after["song_participations"]):
        raise RuntimeError("狐子 was not preserved as voicebank participation")

    item_rows = [row for row in after["release_items"] if int(row.get("song_id") or 0) == 391]
    if {(int(row["release_component_id"]), int(row["sort_order"])) for row in item_rows} != {(111, 4), (112, 4)}:
        raise RuntimeError("song 391 release component items mismatch")
    availability = [row for row in after["song_availabilities"] if int(row["song_id"]) in TARGET_IDS]
    if len(availability) != 6:
        raise RuntimeError("target availability count mismatch")
    if not any(int(row["song_id"]) == 54 and row["is_current"] is False for row in availability):
        raise RuntimeError("song 54 historical availability missing")
    if not any(int(row["song_id"]) == 353 and row["is_current"] is True
               and row["access_type"] == "free" for row in availability):
        raise RuntimeError("song 353 current official availability missing")
    if any(int(row["song_id"]) in {54, 391} and row["is_current"] is True for row in availability):
        raise RuntimeError("sold-out physical availability marked current")
    credit30 = next(row for row in after["song_credits"] if int(row["id"]) == 30)
    if credit30["credit_name"] != "カンザキイオリ & 及川創介":
        raise RuntimeError("Human-confirmed credit #30 was overwritten")
    source_urls = [str(row["url"]) for row in after["reference_sources"]]
    if len(source_urls) != len(set(source_urls)):
        raise RuntimeError("reference source URL duplicate")
    inserted = result["inserted"]
    return {
        "song_ai_checks_added": len(inserted.get("song_field_checks", [])),
        "group_ai_checks_added": len(inserted.get("song_group_field_checks", [])),
        "credit_ai_checks_added": len(inserted.get("song_credit_checks", [])),
        "entities_added": len(inserted.get("entities", [])),
        "credits_added": len(inserted.get("song_credits", [])),
        "participations_added": len(inserted.get("song_participations", [])),
        "release_items_added": len(inserted.get("release_items", [])),
        "availabilities_added": len(inserted.get("song_availabilities", [])),
        "sources_added": len(inserted.get("reference_sources", [])),
        "source_relations_added": sum(len(inserted.get(table, [])) for table in (
            "song_field_check_sources", "song_group_field_check_sources",
            "song_credit_check_sources", "song_availability_sources", "release_sources")),
        "relations": {"116": "added", "391": "mixed"},
        "conflicts": plan["conflicts"], "needs_human": plan["needs_human"],
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    parser.add_argument("--recover-snapshot", type=Path)
    args = parser.parse_args()
    api = service_client()
    if args.recover_snapshot is not None:
        print(json.dumps(recover_snapshot(api, args.recover_snapshot), ensure_ascii=False, indent=2))
        return
    before = fetch_state(api)
    plan = build_plan(before)
    if not args.apply:
        print(json.dumps({"mode": "dry-run", "plan": plan_summary(plan)}, ensure_ascii=False, indent=2))
        return
    if args.confirm != CONFIRM:
        raise SystemExit(f"--apply requires --confirm {CONFIRM}")
    path = snapshot_path()
    write_snapshot(path, before)
    print(f"snapshot: {path}", flush=True)
    result = apply_plan(api, before, plan)
    try:
        validation = validate(before, fetch_tables(api, (
            "songs", "song_groups", "song_field_checks", "song_group_field_checks",
            "song_credit_checks", "entities", "entity_relationships",
            "song_group_credits", "song_credits", "song_participations",
            "release_items", "song_availabilities", "reference_sources",
        )), plan, result)
    except Exception as error:
        print(f"validation error before rollback: {error!r}", file=sys.stderr, flush=True)
        rollback(api, before, defaultdict(list, result["inserted"]),
                 defaultdict(list, result["patched"]))
        raise RuntimeError(f"validation failed ({error}); compensating rollback completed") from None
    print(json.dumps({"mode": "applied", "snapshot": str(path),
                      "validation": validation}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
