"""Guarded production backfill for the additive song work/version model.

The default mode is read-only. Writes require both ``--apply`` and the exact
confirmation token. A complete JSON snapshot is written under private-data
before the first mutation. If application or validation fails, only changes
made by this run are compensated from that snapshot.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Final
from zoneinfo import ZoneInfo


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

from apply_live_song_setlist_ready import RestClient, anon_client, service_client  # noqa: E402


CONFIRM: Final = "SONG_MODEL_BACKFILL_001"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-model"

WORK_MAP: Final = {
    "original_artist": ("original_artist_status", "work_artist_credit"),
    "original_vocal": ("original_vocal_status", "work_vocal_credit"),
    "original_lyricist": ("original_lyricist_status", "work_lyricist_credit"),
    "original_composer": ("original_composer_status", "work_composer_credit"),
    "original_arranger": ("original_arranger_status", "work_arranger_credit"),
}
WORK_TARGET_FIELDS: Final = tuple(target for _, target in WORK_MAP.values())
CONFLICT_GROUPS: Final = {49, 50, 51, 58, 59, 68, 87, 161, 203, 277, 309, 336}
PILOT_SONG_IDS: Final = {46, 68, 94, 132, 158, 190, 200, 221, 286, 373}

SNAPSHOT_TABLES: Final = (
    "songs",
    "song_groups",
    "song_field_checks",
    "song_field_check_sources",
    "reference_sources",
    "song_credits",
    "song_group_field_checks",
    "song_credit_checks",
    "song_group_field_check_sources",
    "song_credit_check_sources",
    "song_availabilities",
    "song_availability_sources",
    "releases",
    "links",
    "song_digital_releases",
    "live_performances",
    "live_setlist_entries",
    "live_setlist_entry_songs",
    "live_performance_sources",
    "live_performance_links",
)

IMMUTABLE_TABLES: Final = (
    "reference_sources",
    "song_availabilities",
    "song_availability_sources",
    "releases",
    "links",
    "song_digital_releases",
    "live_performances",
    "live_setlist_entries",
    "live_setlist_entry_songs",
    "live_performance_sources",
    "live_performance_links",
)

PRIVATE_TABLES: Final = (
    "song_credits",
    "song_group_field_checks",
    "song_credit_checks",
    "song_group_field_check_sources",
    "song_credit_check_sources",
    "song_field_checks",
    "song_field_check_sources",
    "reference_sources",
    "song_availabilities",
    "song_availability_sources",
)


def select_all(api: RestClient, table: str) -> list[dict[str, Any]]:
    # Supabase/PostgREST may cap a response at 1,000 rows even when a larger
    # limit is requested. Validation must page explicitly; otherwise a table
    # growing from 1,000 to 1,003 rows makes the three newest rows invisible.
    rows: list[dict[str, Any]] = []
    page_size = 1000
    offset = 0
    while True:
        result = api.request(
            table,
            params=[
                ("select", "*"),
                ("order", "id.asc"),
                ("limit", str(page_size)),
                ("offset", str(offset)),
            ],
        )
        if not isinstance(result, list) or not all(isinstance(row, dict) for row in result):
            raise RuntimeError(f"{table}: SELECT did not return rows")
        rows.extend(result)
        if len(result) < page_size:
            return rows
        offset += page_size


def canonical_hash(rows: list[dict[str, Any]]) -> str:
    encoded = json.dumps(
        sorted(rows, key=lambda row: json.dumps(row, ensure_ascii=False, sort_keys=True)),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def value_key(value: Any) -> str:
    return json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def snapshot_file() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    candidate = SNAPSHOT_ROOT / f"before-song-model-backfill-{stamp}.json"
    counter = 1
    while candidate.exists():
        candidate = SNAPSHOT_ROOT / f"before-song-model-backfill-{stamp}-{counter}.json"
        counter += 1
    return candidate


def write_snapshot(path: Path, tables: dict[str, list[dict[str, Any]]]) -> None:
    document = {
        "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "operation": CONFIRM,
        "counts": {table: len(rows) for table, rows in tables.items()},
        "hashes": {table: canonical_hash(rows) for table, rows in tables.items()},
        "tables": tables,
    }
    with path.open("x", encoding="utf-8") as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    state: dict[str, list[dict[str, Any]]] = {}
    for table in SNAPSHOT_TABLES:
        state[table] = select_all(api, table)
    return state


def song_members(state: dict[str, list[dict[str, Any]]]) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for song in state["songs"]:
        group_id = song.get("song_group_id")
        if isinstance(group_id, int):
            result[group_id].append(song)
    for members in result.values():
        members.sort(key=lambda row: int(row["id"]))
    return result


def unique_base(members: list[dict[str, Any]]) -> dict[str, Any] | None:
    candidates = [
        song for song in members
        if song.get("is_primary_version") is True and song.get("version_type") == "standard"
    ]
    return candidates[0] if len(members) > 1 and len(candidates) == 1 else None


def normalize_work(field: str, value: Any) -> Any:
    return None if field == "original_artist" and value == "-" else value


def current_checks(
    state: dict[str, list[dict[str, Any]]],
) -> dict[tuple[int, str, str, str], list[dict[str, Any]]]:
    result: dict[tuple[int, str, str, str], list[dict[str, Any]]] = defaultdict(list)
    for check in state["song_field_checks"]:
        key = (
            int(check["song_id"]),
            str(check["field_name"]),
            str(check["checker_type"]),
            value_key(check.get("checked_value")),
        )
        result[key].append(check)
    for checks in result.values():
        checks.sort(key=lambda row: (str(row.get("checked_at") or ""), int(row["id"])), reverse=True)
    return result


def relation_map(state: dict[str, list[dict[str, Any]]]) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for relation in state["song_field_check_sources"]:
        result[int(relation["song_field_check_id"])].append(relation)
    for relations in result.values():
        relations.sort(key=lambda row: (row.get("sort_order") is None, row.get("sort_order") or 0, int(row["id"])))
    return result


def provenance_plan(members_by_group: dict[int, list[dict[str, Any]]]) -> tuple[dict[int, str], list[dict[str, Any]]]:
    safe: dict[int, str] = {}
    unresolved: list[dict[str, Any]] = []
    for group_id, members in sorted(members_by_group.items()):
        types = {song.get("song_type") for song in members}
        base = unique_base(members)
        decision: str | None = None
        if len(types) == 1 and next(iter(types)) in {"original", "cover"}:
            decision = str(next(iter(types)))
        else:
            roots = {value for value in types if value in {"original", "cover"}}
            if len(roots) == 1 and "collaboration" not in types:
                decision = str(next(iter(roots)))
            elif base and base.get("song_type") in {"original", "cover"}:
                base_type = str(base["song_type"])
                if types.issubset({base_type, "variant", "collaboration"}) and not (
                    "variant" in types and "collaboration" in types
                ):
                    decision = base_type
        if decision:
            safe[group_id] = decision
        else:
            unresolved.append({
                "song_group_id": group_id,
                "title": members[0].get("title"),
                "song_ids": [int(song["id"]) for song in members],
                "legacy_types": sorted(str(value) for value in types),
            })
    return safe, unresolved


def work_credit_plan(
    state: dict[str, list[dict[str, Any]]],
    members_by_group: dict[int, list[dict[str, Any]]],
) -> tuple[dict[int, dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    checks = current_checks(state)
    sources = relation_map(state)
    updates: dict[int, dict[str, Any]] = {}
    verifications: list[dict[str, Any]] = []
    skipped: list[dict[str, Any]] = []
    for group_id, members in sorted(members_by_group.items()):
        normalized = {
            field: {value_key(normalize_work(field, song.get(field))) for song in members}
            for field in WORK_MAP
        }
        conflicts = [field for field, values in normalized.items() if len(values) > 1]
        if conflicts:
            if group_id not in CONFLICT_GROUPS:
                raise RuntimeError(f"unexpected work-credit conflict group: {group_id}")
            skipped.append({"song_group_id": group_id, "fields": conflicts})
            continue
        source_song = unique_base(members) or (members[0] if len(members) == 1 else None)
        if not source_song:
            continue
        payload: dict[str, Any] = {}
        for legacy_field, (status_field, target_field) in WORK_MAP.items():
            if source_song.get(status_field) != "confirmed":
                continue
            key = (
                int(source_song["id"]), legacy_field, "human", value_key(source_song.get(legacy_field))
            )
            roots = checks.get(key, [])
            if not roots:
                continue
            root = roots[0]
            target_value = normalize_work(legacy_field, source_song.get(legacy_field))
            payload[target_field] = target_value
            verifications.append({
                "song_group_id": group_id,
                "field_name": target_field,
                "checked_value": target_value,
                "checker_type": "human",
                "evidence": root.get("evidence") or [],
                "note": (
                    f"Legacy songs.{legacy_field} human check #{root['id']}からwork fieldへ移行"
                    + ("（'-' sentinelはSQL NULLへ正規化）" if legacy_field == "original_artist" and source_song.get(legacy_field) == "-" else "")
                ),
                "source_relations": sources.get(int(root["id"]), []),
            })
        if payload:
            updates[group_id] = payload
    return updates, verifications, skipped


def version_plan(
    state: dict[str, list[dict[str, Any]]],
) -> tuple[dict[int, dict[str, Any]], list[dict[str, Any]]]:
    availability_by_song: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for row in state["song_availabilities"]:
        availability_by_song[int(row["song_id"])].append(row)
    updates: dict[int, dict[str, Any]] = {}
    availability_flags: list[dict[str, Any]] = []
    for song in state["songs"]:
        song_id = int(song["id"])
        payload: dict[str, Any] = {}
        version_type = str(song.get("version_type") or "")
        named = f"{song.get('title') or ''} {song.get('version_name') or ''}".casefold()
        kind: str | None = None
        if "rearranged" in named:
            kind = "rearranged"
        elif "multilingual" in named:
            kind = "multilingual"
        elif version_type in {"standard", "acoustic", "solo"}:
            kind = version_type
        if kind:
            payload["version_kind"] = kind

        context: str | None = None
        if version_type == "live":
            context = "live"
        else:
            content_types = {
                str(row["content_type"]) for row in availability_by_song.get(song_id, [])
                if row.get("content_type") in {"studio", "live"}
            }
            if len(content_types) == 1:
                context = next(iter(content_types))
        if context:
            payload["performance_context"] = context
        if payload:
            updates[song_id] = payload

    endings = ("sold out", "販売終了", "配信終了", "公開終了", "取り扱い終了")
    for row in state["song_availabilities"]:
        if int(row["song_id"]) not in PILOT_SONG_IDS or row.get("is_current") is not True:
            continue
        searchable = f"{row.get('note') or ''} {row.get('access_url') or ''}".casefold()
        if any(marker in searchable for marker in endings):
            availability_flags.append({
                "availability_id": int(row["id"]),
                "song_id": int(row["song_id"]),
                "reason": "current row itself contains an ended-access marker",
            })
    return updates, availability_flags


def exact_credit_plan(
    state: dict[str, list[dict[str, Any]]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    songs = {int(row["id"]): row for row in state["songs"]}
    checks = current_checks(state)
    relations = relation_map(state)
    sources = {int(row["id"]): row for row in state["reference_sources"]}
    credits: list[dict[str, Any]] = []
    held: list[dict[str, Any]] = [{"song_id": 47, "reason": "legacy vocal differs from actual singer composition; independent source required"}]

    legacy_candidates = (
        (27, "original_vocal", "original_vocal_status", "vocal"),
        (84, "original_vocal", "original_vocal_status", "vocal"),
        (86, "original_vocal", "original_vocal_status", "vocal"),
        (92, "original_vocal", "original_vocal_status", "vocal"),
        (164, "original_vocal", "original_vocal_status", "vocal"),
        (353, "original_arranger", "original_arranger_status", "arranger"),
    )
    for song_id, legacy_field, status_field, role in legacy_candidates:
        song = songs[song_id]
        value = song.get(legacy_field)
        key = (song_id, legacy_field, "human", value_key(value))
        roots = checks.get(key, [])
        if song.get(status_field) != "confirmed" or value is None or not roots:
            held.append({"song_id": song_id, "field": legacy_field, "reason": "no confirmed current human root"})
            continue
        root = roots[0]
        credits.append({
            "song_id": song_id,
            "role": role,
            "credit_name": value,
            "sort_order": 1,
            "note": f"Legacy {legacy_field}のversion差から移行",
            "checker_type": "human",
            "check_evidence": root.get("evidence") or [],
            "check_note": f"Legacy songs.{legacy_field} human check #{root['id']}をexact version creditへ移行",
            "source_relations": relations.get(int(root["id"]), []),
        })

    breathe_source = next(
        (
            source for source in sources.values()
            if source.get("url") == "https://kamitsubaki.jp/discography/harusaruhi/8863/"
        ),
        None,
    )
    if not breathe_source:
        held.append({"song_id": 286, "reason": "official BREATHE(Rearranged ver.) reference source is missing"})
    else:
        for role, name, order in (
            ("vocal", "ヰ世界情緒", 1),
            ("vocal", "春猿火", 2),
            ("arranger", "朝比奈健人", 1),
        ):
            credits.append({
                "song_id": 286,
                "role": role,
                "credit_name": name,
                "sort_order": order,
                "note": "BREATHE(Rearranged ver.)公式credit",
                "checker_type": "ai",
                "check_evidence": [],
                "check_note": "KAMITSUBAKI公式discographyでexact version creditを確認",
                "source_relations": [{
                    "reference_source_id": int(breathe_source["id"]),
                    "locator": None,
                    "evidence_note": "BREATHE(Rearranged ver.)公式credit",
                    "sort_order": 1,
                }],
            })
    return credits, held


def build_plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    if len(state["songs"]) != 405:
        raise RuntimeError(f"expected 405 songs, found {len(state['songs'])}")
    if any(state[table] for table in (
        "song_credits", "song_group_field_checks", "song_credit_checks",
        "song_group_field_check_sources", "song_credit_check_sources",
    )):
        raise RuntimeError("new song-model tables are not empty; refusing a non-idempotent first backfill")
    groups = {int(row["id"]): row for row in state["song_groups"]}
    songs = {int(row["id"]): row for row in state["songs"]}
    required_group_columns = {"work_provenance", *WORK_TARGET_FIELDS, "base_song_id"}
    required_song_columns = {"performance_context", "version_kind"}
    if not required_group_columns.issubset(groups[next(iter(groups))]):
        raise RuntimeError("song_groups migration columns are incomplete")
    if not required_song_columns.issubset(songs[next(iter(songs))]):
        raise RuntimeError("songs migration columns are incomplete")
    if any(groups[group_id].get(field) is not None for group_id in groups for field in required_group_columns):
        raise RuntimeError("song_groups new-model columns already contain data")
    if any(songs[song_id].get(field) is not None for song_id in songs for field in required_song_columns):
        raise RuntimeError("songs version-model columns already contain data")

    members = song_members(state)
    provenance, unresolved = provenance_plan(members)
    if len(provenance) != 352 or len(unresolved) != 15:
        raise RuntimeError(f"provenance candidate drift: safe={len(provenance)}, unresolved={len(unresolved)}")
    bases = {
        group_id: int(base["id"])
        for group_id, rows in members.items()
        if (base := unique_base(rows)) is not None
    }
    if len(bases) != 27:
        raise RuntimeError(f"base candidate drift: {len(bases)}")
    work_updates, work_checks, credit_conflicts = work_credit_plan(state, members)
    if {row["song_group_id"] for row in credit_conflicts} != CONFLICT_GROUPS:
        raise RuntimeError("work-credit conflict group set drifted")
    versions, availability_flags = version_plan(state)
    exact_credits, held_credits = exact_credit_plan(state)

    # Human-confirmed pending fixes. The current date is retained; only its
    # legacy certainty status changes. New append-only checks record both facts.
    if songs[68].get("first_date") != "2021-10-07":
        raise RuntimeError("song 68 first_date no longer matches the human-confirmed value")
    if songs[158].get("tie_up") == "『狂気山脈 ネイキッド・ピーク』パイロット主題歌" and songs[68].get("first_status") == "confirmed":
        raise RuntimeError("pending fixes appear already applied; refusing duplicate first backfill")
    source_by_url = {str(row["url"]): row for row in state["reference_sources"]}
    source_158 = source_by_url.get("https://www.youtube.com/watch?v=595p1A2GQho")
    source_68 = source_by_url.get("https://kamitsubaki.jp/discography/v-w-p/976/")
    if not source_158 or not source_68:
        raise RuntimeError("pending-fix official sources are missing")
    pending_checks = [
        {
            "song_id": 158,
            "field_name": "tie_up",
            "checked_value": "『狂気山脈 ネイキッド・ピーク』パイロット主題歌",
            "checker_type": "human",
            "evidence": [],
            "note": "人間確定：公式表現へ修正",
            "reference_source_id": int(source_158["id"]),
        },
        {
            "song_id": 68,
            "field_name": "first_date",
            "checked_value": "2021-10-07",
            "checker_type": "human",
            "evidence": [],
            "note": "人間確定：24時超え深夜放送は翌暦日を採用",
            "reference_source_id": int(source_68["id"]),
        },
        {
            "song_id": 68,
            "field_name": "first_status",
            "checked_value": "confirmed",
            "checker_type": "human",
            "evidence": [],
            "note": "人間確定済みfirst_dateのstatus更新",
            "reference_source_id": int(source_68["id"]),
        },
    ]
    return {
        "provenance": provenance,
        "unresolved": unresolved,
        "bases": bases,
        "work_updates": work_updates,
        "work_checks": work_checks,
        "work_credit_conflicts": credit_conflicts,
        "versions": versions,
        "availability_flags": availability_flags,
        "exact_credits": exact_credits,
        "held_credits": held_credits,
        "pending_checks": pending_checks,
    }


def patch_one(api: RestClient, table: str, row_id: int, payload: dict[str, Any]) -> None:
    result = api.request(
        table,
        method="PATCH",
        params=[("id", f"eq.{row_id}")],
        payload=payload,
        prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1 or int(result[0]["id"]) != row_id:
        raise RuntimeError(f"{table} #{row_id}: PATCH read-back mismatch")


def insert_one(api: RestClient, table: str, payload: dict[str, Any]) -> dict[str, Any]:
    row = api.insert_one(table, payload)
    return {str(key): value for key, value in row.items()}


def insert_many(api: RestClient, table: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not payloads:
        return []
    result = api.request(
        table,
        method="POST",
        payload=payloads,
        prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != len(payloads) or not all(isinstance(row, dict) for row in result):
        raise RuntimeError(f"{table}: batch INSERT read-back mismatch")
    return result


def delete_ids(api: RestClient, table: str, ids: list[int]) -> None:
    for offset in range(0, len(ids), 80):
        api.delete_ids(table, ids[offset:offset + 80])


def apply_plan(
    api: RestClient,
    state: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
) -> dict[str, list[int]]:
    inserted: dict[str, list[int]] = defaultdict(list)
    changed_groups: set[int] = set()
    changed_songs: set[int] = set()

    try:
        provenance_groups: dict[str, list[int]] = defaultdict(list)
        for group_id, value in plan["provenance"].items():
            provenance_groups[value].append(group_id)
        for value, ids in provenance_groups.items():
            for offset in range(0, len(ids), 80):
                batch = ids[offset:offset + 80]
                api.patch_ids("song_groups", batch, {"work_provenance": value})
                changed_groups.update(batch)
        print(f"work_provenance: {len(plan['provenance'])}", flush=True)

        for group_id, base_song_id in plan["bases"].items():
            patch_one(api, "song_groups", group_id, {"base_song_id": base_song_id})
            changed_groups.add(group_id)
        print(f"base_song_id: {len(plan['bases'])}", flush=True)

        for index, (group_id, payload) in enumerate(plan["work_updates"].items(), start=1):
            patch_one(api, "song_groups", group_id, payload)
            changed_groups.add(group_id)
            if index % 50 == 0:
                print(f"work credits: {index}/{len(plan['work_updates'])}", flush=True)

        pending_group_relations: list[dict[str, Any]] = []
        for offset in range(0, len(plan["work_checks"]), 100):
            verification_batch = plan["work_checks"][offset:offset + 100]
            payload_batch = [
                {
                    key: verification[key]
                    for key in ("song_group_id", "field_name", "checked_value", "checker_type", "evidence", "note")
                }
                for verification in verification_batch
            ]
            created_batch = insert_many(api, "song_group_field_checks", payload_batch)
            inserted["song_group_field_checks"].extend(int(row["id"]) for row in created_batch)
            created_by_key = {
                (int(row["song_group_id"]), str(row["field_name"]), value_key(row.get("checked_value"))): row
                for row in created_batch
            }
            for verification in verification_batch:
                key = (
                    int(verification["song_group_id"]),
                    str(verification["field_name"]),
                    value_key(verification.get("checked_value")),
                )
                row = created_by_key.get(key)
                if row is None:
                    raise RuntimeError(f"song_group_field_checks: missing batch row {key}")
                check_id = int(row["id"])
                for relation in verification["source_relations"]:
                    pending_group_relations.append({
                        "song_group_field_check_id": check_id,
                        "reference_source_id": int(relation["reference_source_id"]),
                        "locator": relation.get("locator"),
                        "evidence_note": relation.get("evidence_note"),
                        "sort_order": relation.get("sort_order"),
                    })
        for offset in range(0, len(pending_group_relations), 100):
            created_batch = insert_many(
                api,
                "song_group_field_check_sources",
                pending_group_relations[offset:offset + 100],
            )
            inserted["song_group_field_check_sources"].extend(int(row["id"]) for row in created_batch)
        print(f"work checks: {len(plan['work_checks'])}", flush=True)

        version_groups: dict[str, list[int]] = defaultdict(list)
        for song_id, payload in plan["versions"].items():
            version_groups[value_key(payload)].append(song_id)
        for payload_key, ids in version_groups.items():
            payload = json.loads(payload_key)
            for offset in range(0, len(ids), 80):
                batch = ids[offset:offset + 80]
                api.patch_ids("songs", batch, payload)
                changed_songs.update(batch)
        print(f"version fields: {len(plan['versions'])}", flush=True)

        for credit in plan["exact_credits"]:
            created = insert_one(api, "song_credits", {
                key: credit[key] for key in ("song_id", "role", "credit_name", "sort_order", "note")
            })
            credit_id = int(created["id"])
            inserted["song_credits"].append(credit_id)
            snapshot = {
                "role": credit["role"],
                "credit_name": credit["credit_name"],
                "sort_order": credit["sort_order"],
            }
            checked = insert_one(api, "song_credit_checks", {
                "song_credit_id": credit_id,
                "checked_value": snapshot,
                "checker_type": credit["checker_type"],
                "evidence": credit["check_evidence"],
                "note": credit["check_note"],
            })
            check_id = int(checked["id"])
            inserted["song_credit_checks"].append(check_id)
            for relation in credit["source_relations"]:
                linked = insert_one(api, "song_credit_check_sources", {
                    "song_credit_check_id": check_id,
                    "reference_source_id": int(relation["reference_source_id"]),
                    "locator": relation.get("locator"),
                    "evidence_note": relation.get("evidence_note"),
                    "sort_order": relation.get("sort_order"),
                })
                inserted["song_credit_check_sources"].append(int(linked["id"]))
        print(f"exact credits: {len(plan['exact_credits'])}", flush=True)

        patch_one(api, "songs", 158, {
            "tie_up": "『狂気山脈 ネイキッド・ピーク』パイロット主題歌",
            "tie_up_status": "confirmed",
        })
        changed_songs.add(158)
        patch_one(api, "songs", 68, {"first_status": "confirmed"})
        changed_songs.add(68)
        for item in plan["pending_checks"]:
            created = insert_one(api, "song_field_checks", {
                key: item[key]
                for key in ("song_id", "field_name", "checked_value", "checker_type", "evidence", "note")
            })
            check_id = int(created["id"])
            inserted["song_field_checks"].append(check_id)
            linked = insert_one(api, "song_field_check_sources", {
                "song_field_check_id": check_id,
                "reference_source_id": item["reference_source_id"],
                "sort_order": 1,
                "evidence_note": item["note"],
            })
            inserted["song_field_check_sources"].append(int(linked["id"]))
        print("pending fixes: songs 68, 158", flush=True)
        inserted["changed_group_ids"] = sorted(changed_groups)
        inserted["changed_song_ids"] = sorted(changed_songs)
        return inserted
    except Exception:
        rollback(api, state, inserted, changed_groups, changed_songs)
        raise RuntimeError("backfill failed; compensating rollback completed") from None


def rollback(
    api: RestClient,
    state: dict[str, list[dict[str, Any]]],
    inserted: dict[str, list[int]],
    changed_groups: set[int],
    changed_songs: set[int],
) -> None:
    # Parent deletes cascade to their relation/check children. Explicit relation
    # deletes make cleanup safe even if a parent insertion was not the last step.
    for table in (
        "song_credit_check_sources", "song_group_field_check_sources",
        "song_field_check_sources", "song_credit_checks",
        "song_group_field_checks", "song_credits", "song_field_checks",
    ):
        delete_ids(api, table, inserted.get(table, []))
    group_before = {int(row["id"]): row for row in state["song_groups"]}
    for group_id in sorted(changed_groups):
        row = group_before[group_id]
        patch_one(api, "song_groups", group_id, {
            "work_provenance": row.get("work_provenance"),
            "work_artist_credit": row.get("work_artist_credit"),
            "work_vocal_credit": row.get("work_vocal_credit"),
            "work_lyricist_credit": row.get("work_lyricist_credit"),
            "work_composer_credit": row.get("work_composer_credit"),
            "work_arranger_credit": row.get("work_arranger_credit"),
            "base_song_id": row.get("base_song_id"),
        })
    songs_before = {int(row["id"]): row for row in state["songs"]}
    for song_id in sorted(changed_songs):
        row = songs_before[song_id]
        payload = {
            "performance_context": row.get("performance_context"),
            "version_kind": row.get("version_kind"),
        }
        if song_id == 158:
            payload.update({"tie_up": row.get("tie_up"), "tie_up_status": row.get("tie_up_status")})
        if song_id == 68:
            payload["first_status"] = row.get("first_status")
        patch_one(api, "songs", song_id, payload)


def validate_anon() -> dict[str, str]:
    api = anon_client()
    results: dict[str, str] = {}
    for table in PRIVATE_TABLES:
        try:
            rows = api.request(table, params=[("select", "id"), ("limit", "1")])
        except RuntimeError:
            results[table] = "denied"
            continue
        if rows != []:
            raise RuntimeError(f"anon can read management-only table {table}")
        results[table] = "empty_by_rls"
    return results


def validate(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
    inserted: dict[str, list[int]],
) -> dict[str, Any]:
    after = fetch_state(api)
    if len(after["songs"]) != 405 or len(after["song_groups"]) != len(before["song_groups"]):
        raise RuntimeError("song or song_group count changed")
    for table in IMMUTABLE_TABLES:
        if canonical_hash(after[table]) != canonical_hash(before[table]):
            raise RuntimeError(f"immutable table changed: {table}")

    before_checks = {int(row["id"]): row for row in before["song_field_checks"]}
    after_checks = {int(row["id"]): row for row in after["song_field_checks"]}
    if any(after_checks.get(check_id) != row for check_id, row in before_checks.items()):
        raise RuntimeError("existing song_field_checks history changed")
    actual_new_check_ids = set(after_checks) - set(before_checks)
    expected_new_check_ids = set(inserted["song_field_checks"])
    if actual_new_check_ids != expected_new_check_ids:
        raise RuntimeError(
            "unexpected song_field_checks rows were added: "
            f"expected={sorted(expected_new_check_ids)}, actual={sorted(actual_new_check_ids)}"
        )

    before_song_sources = {int(row["id"]): row for row in before["song_field_check_sources"]}
    after_song_sources = {int(row["id"]): row for row in after["song_field_check_sources"]}
    if any(after_song_sources.get(row_id) != row for row_id, row in before_song_sources.items()):
        raise RuntimeError("existing song_field_check_sources history changed")
    if set(after_song_sources) - set(before_song_sources) != set(inserted["song_field_check_sources"]):
        raise RuntimeError("unexpected song_field_check_sources rows were added")

    groups = {int(row["id"]): row for row in after["song_groups"]}
    songs = {int(row["id"]): row for row in after["songs"]}
    nonnull_provenance = {group_id for group_id, row in groups.items() if row.get("work_provenance") is not None}
    if nonnull_provenance != set(plan["provenance"]):
        raise RuntimeError("work_provenance was set outside the safe candidate set")
    for group_id, value in plan["provenance"].items():
        if groups[group_id].get("work_provenance") != value:
            raise RuntimeError(f"work_provenance mismatch for group {group_id}")
    for group_id, base_song_id in plan["bases"].items():
        base = songs[base_song_id]
        if not (
            groups[group_id].get("base_song_id") == base_song_id
            and base.get("song_group_id") == group_id
            and base.get("is_primary_version") is True
            and base.get("version_type") == "standard"
        ):
            raise RuntimeError(f"unsafe base_song_id for group {group_id}")
    if {group_id for group_id, row in groups.items() if row.get("base_song_id") is not None} != set(plan["bases"]):
        raise RuntimeError("base_song_id exists outside the 27 safe candidates")
    for group_id in CONFLICT_GROUPS:
        if any(groups[group_id].get(field) is not None for field in WORK_TARGET_FIELDS):
            raise RuntimeError(f"work-credit conflict group was populated: {group_id}")
    if any(row.get("work_artist_credit") == "-" for row in groups.values()):
        raise RuntimeError("legacy '-' sentinel leaked into work_artist_credit")
    for group_id, payload in plan["work_updates"].items():
        if any(groups[group_id].get(field) != value for field, value in payload.items()):
            raise RuntimeError(f"work-credit read-back mismatch: {group_id}")

    for song_id, payload in plan["versions"].items():
        if any(songs[song_id].get(field) != value for field, value in payload.items()):
            raise RuntimeError(f"version-field read-back mismatch: {song_id}")
    if songs[158].get("tie_up") != "『狂気山脈 ネイキッド・ピーク』パイロット主題歌":
        raise RuntimeError("song 158 tie_up mismatch")
    if songs[158].get("tie_up_status") != "confirmed" or songs[68].get("first_status") != "confirmed":
        raise RuntimeError("pending-fix status mismatch")
    if songs[68].get("first_date") != "2021-10-07":
        raise RuntimeError("song 68 first_date changed")

    credits = after["song_credits"]
    keys_order = [(row["song_id"], row["role"], row["sort_order"]) for row in credits]
    keys_name = [(row["song_id"], row["role"], row["credit_name"]) for row in credits]
    if len(keys_order) != len(set(keys_order)) or len(keys_name) != len(set(keys_name)):
        raise RuntimeError("duplicate song_credits detected")
    if len(credits) != len(plan["exact_credits"]):
        raise RuntimeError("song_credit count mismatch")
    if any(row["role"] not in {"vocal", "arranger"} for row in credits):
        raise RuntimeError("work credits were copied indiscriminately into exact credits")

    group_checks = after["song_group_field_checks"]
    if len(group_checks) != len(plan["work_checks"]):
        raise RuntimeError("song_group_field_checks count mismatch")
    group_current = {
        (int(row["song_group_id"]), str(row["field_name"]), value_key(row.get("checked_value")))
        for row in group_checks
    }
    for group_id, payload in plan["work_updates"].items():
        for field, value in payload.items():
            if (group_id, field, value_key(value)) not in group_current:
                raise RuntimeError(f"missing current work-field check: {group_id}/{field}")

    # All five new model/history tables were empty at preflight. Every final
    # row therefore must be explicitly tracked by this run.
    for table in (
        "song_credits", "song_group_field_checks", "song_credit_checks",
        "song_group_field_check_sources", "song_credit_check_sources",
    ):
        actual_ids = {int(row["id"]) for row in after[table]}
        if actual_ids != set(inserted[table]):
            raise RuntimeError(f"unexpected final rows in {table}")
    credits_by_id = {int(row["id"]): row for row in after["song_credits"]}
    for check in after["song_credit_checks"]:
        credit = credits_by_id[int(check["song_credit_id"])]
        expected_snapshot = {
            "role": credit["role"],
            "credit_name": credit["credit_name"],
            "sort_order": credit["sort_order"],
        }
        if check.get("checked_value") != expected_snapshot:
            raise RuntimeError(f"stale song_credit_check #{check['id']}")

    old_groups = {int(row["id"]): row for row in before["song_groups"]}
    allowed_group_fields = {"work_provenance", "base_song_id", *WORK_TARGET_FIELDS}
    for group_id, row in groups.items():
        for field, old_value in old_groups[group_id].items():
            if field not in allowed_group_fields and row.get(field) != old_value:
                raise RuntimeError(f"unexpected legacy song_group field change: {group_id}/{field}")

    old_songs = {int(row["id"]): row for row in before["songs"]}
    allowed_new_fields = {"performance_context", "version_kind"}
    for song_id, row in songs.items():
        old = old_songs[song_id]
        for field, old_value in old.items():
            if field in allowed_new_fields:
                continue
            if song_id == 158 and field in {"tie_up", "tie_up_status"}:
                continue
            if song_id == 68 and field == "first_status":
                continue
            if row.get(field) != old_value:
                raise RuntimeError(f"unexpected legacy song field change: {song_id}/{field}")

    anon = validate_anon()
    return {
        "songs": len(after["songs"]),
        "song_groups": len(after["song_groups"]),
        "existing_song_field_checks_preserved": len(before_checks),
        "new_song_field_checks": len(inserted["song_field_checks"]),
        "rls": anon,
        "service_role": "SELECT/INSERT/UPDATE exercised; grants include DELETE in applied migration",
    }


def summary(plan: dict[str, Any]) -> dict[str, Any]:
    work_nonnull = sum(value is not None for payload in plan["work_updates"].values() for value in payload.values())
    work_null = sum(value is None for payload in plan["work_updates"].values() for value in payload.values())
    version_fields = sum(len(payload) for payload in plan["versions"].values())
    return {
        "work_provenance_groups": len(plan["provenance"]),
        "unresolved_groups": plan["unresolved"],
        "base_song_groups": len(plan["bases"]),
        "work_credit_groups": len(plan["work_updates"]),
        "work_credit_nonnull_fields": work_nonnull,
        "work_credit_verified_null_fields": work_null,
        "work_credit_checks": len(plan["work_checks"]),
        "work_credit_conflicts": plan["work_credit_conflicts"],
        "version_songs": len(plan["versions"]),
        "version_fields": version_fields,
        "exact_credits": [
            {key: row[key] for key in ("song_id", "role", "credit_name", "sort_order")}
            for row in plan["exact_credits"]
        ],
        "held_exact_credits": plan["held_credits"],
        "availability_flags": plan["availability_flags"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    parser.add_argument("--validate-rls", action="store_true")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        api = service_client()
        state = fetch_state(api)
        plan = build_plan(state)
        report = {"mode": "read-only", "plan": summary(plan)}
        if args.validate_rls:
            report["rls"] = validate_anon()
        if not args.apply:
            print(json.dumps(report, ensure_ascii=False, indent=2))
            return 0
        if args.confirm != CONFIRM:
            print(f"write refused: require --apply --confirm {CONFIRM}", file=sys.stderr)
            return 2
        path = snapshot_file()
        write_snapshot(path, state)
        print(f"snapshot: {path}", flush=True)
        inserted = apply_plan(api, state, plan)
        try:
            validation = validate(api, state, plan, inserted)
        except Exception as error:
            rollback(
                api,
                state,
                inserted,
                set(inserted["changed_group_ids"]),
                set(inserted["changed_song_ids"]),
            )
            raise RuntimeError(
                f"validation failed ({error}); compensating rollback completed"
            ) from None
        report = {
            "mode": "applied",
            "snapshot": str(path),
            "plan": summary(plan),
            "inserted": {key: len(value) for key, value in inserted.items() if not key.startswith("changed_")},
            "validation": validation,
            "rollback": False,
        }
        print(json.dumps(report, ensure_ascii=False, indent=2))
        return 0
    except (KeyError, OSError, RuntimeError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
