"""Guarded production backfill for entities, credits, participation, and origin.

Default execution is read-only. Writes require ``--apply`` and the exact
confirmation token. A complete JSON snapshot is saved before the first write;
any apply or validation failure compensates only this run's changes.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import Counter, defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Final
from zoneinfo import ZoneInfo


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

import dry_run_entity_participation_model as dry  # noqa: E402
from apply_live_song_setlist_ready import RestClient, anon_client, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402


CONFIRM: Final = "ENTITY_PARTICIPATION_BACKFILL_001"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-model"

SNAPSHOT_TABLES: Final = (
    "entities", "entity_aliases", "entity_relationships",
    "song_groups", "song_group_credits", "songs", "song_credits",
    "song_participations", "song_group_origins",
    "song_field_checks", "song_field_check_sources",
    "song_group_field_checks", "song_group_field_check_sources",
    "song_credit_checks", "song_credit_check_sources", "reference_sources",
    "song_availabilities", "song_availability_sources",
    "releases", "links", "song_digital_releases",
    "live_performances", "live_setlist_entries", "live_setlist_entry_songs",
    "live_performance_sources", "live_performance_links",
)

IMMUTABLE_TABLES: Final = (
    "songs", "song_field_checks", "song_field_check_sources",
    "song_group_field_checks", "song_group_field_check_sources",
    "reference_sources", "song_availabilities", "song_availability_sources",
    "releases", "links", "song_digital_releases",
    "live_performances", "live_setlist_entries", "live_setlist_entry_songs",
    "live_performance_sources", "live_performance_links",
)

PRIVATE_TABLES: Final = (
    "entities", "entity_aliases", "entity_relationships",
    "song_group_credits", "song_credits", "song_participations",
    "song_group_origins", "song_credit_checks", "song_credit_check_sources",
)

WORK_CREDIT_FIELDS: Final = (
    ("artist", "work_artist_credit"),
    ("vocal", "work_vocal_credit"),
    ("lyricist", "work_lyricist_credit"),
    ("composer", "work_composer_credit"),
    ("arranger", "work_arranger_credit"),
)

SPECIAL_WORK_VOCALS: Final = (
    {"song_group_id": 68, "role": "vocal", "credit_name": "V.W.P", "sort_order": 1,
     "note": "human-confirmed underlying work vocal for 輪廻"},
    {"song_group_id": 87, "role": "vocal", "credit_name": "森先化歩", "sort_order": 1,
     "note": "human-confirmed character credit for あわく心模様"},
    {"song_group_id": 87, "role": "vocal", "credit_name": "夜河世界", "sort_order": 2,
     "note": "human-confirmed character credit for あわく心模様"},
    {"song_group_id": 277, "role": "vocal", "credit_name": "ヰ世界情緒", "sort_order": 1,
     "note": "human-confirmed underlying work vocal for BREATHE"},
)

ID47_CREDITS: Final = (
    {"song_id": 47, "role": "vocal", "credit_name": "花譜", "sort_order": 1},
    {"song_id": 47, "role": "vocal", "credit_name": "春猿火", "sort_order": 2},
    {"song_id": 47, "role": "vocal", "credit_name": "ヰ世界情緒", "sort_order": 3},
)


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in SNAPSHOT_TABLES}


def snapshot_path() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    candidate = SNAPSHOT_ROOT / f"before-entity-participation-backfill-{stamp}.json"
    sequence = 1
    while candidate.exists():
        candidate = SNAPSHOT_ROOT / f"before-entity-participation-backfill-{stamp}-{sequence}.json"
        sequence += 1
    return candidate


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


def insert_many(api: RestClient, table: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not payloads:
        return []
    result = api.request(table, method="POST", payload=payloads, prefer="return=representation")
    if not isinstance(result, list) or len(result) != len(payloads) or not all(isinstance(row, dict) for row in result):
        raise RuntimeError(f"{table}: batch INSERT read-back mismatch")
    return result


def insert_chunked(
    api: RestClient,
    table: str,
    payloads: list[dict[str, Any]],
    inserted: dict[str, list[int]],
    size: int = 100,
) -> list[dict[str, Any]]:
    result: list[dict[str, Any]] = []
    for offset in range(0, len(payloads), size):
        batch = insert_many(api, table, payloads[offset:offset + size])
        inserted[table].extend(int(row["id"]) for row in batch)
        result.extend(batch)
    return result


def patch_one(api: RestClient, table: str, row_id: int, payload: dict[str, Any]) -> None:
    result = api.request(
        table, method="PATCH", params=[("id", f"eq.{row_id}")],
        payload=payload, prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1 or int(result[0]["id"]) != row_id:
        raise RuntimeError(f"{table} #{row_id}: PATCH read-back mismatch")


def delete_ids(api: RestClient, table: str, ids: list[int]) -> None:
    for offset in range(0, len(ids), 80):
        api.delete_ids(table, ids[offset:offset + 80])


def build_plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    if len(state["songs"]) != 405 or len(state["song_groups"]) != 386:
        raise RuntimeError("production song inventory drifted")
    for table in (
        "entities", "entity_aliases", "entity_relationships",
        "song_group_credits", "song_participations", "song_group_origins",
    ):
        if state[table]:
            raise RuntimeError(f"{table} is not empty; refusing first backfill")
    if any(row.get("metadata_reference_song_id") is not None for row in state["song_groups"]):
        raise RuntimeError("metadata_reference_song_id already contains data")
    if len(state["song_credits"]) != 9 or any(row.get("entity_id") is not None for row in state["song_credits"]):
        raise RuntimeError("existing song_credits are not in the expected preflight state")

    entities = [
        {"canonical_name": name, "entity_type": entity_type, "note": "reviewed seed entity backfill"}
        for name, entity_type in dry.SEED_ENTITIES.items()
    ]
    group_credit_payloads: list[dict[str, Any]] = []
    for group in state["song_groups"]:
        for role, field in WORK_CREDIT_FIELDS:
            value = group.get(field)
            if value is not None:
                group_credit_payloads.append({
                    "song_group_id": int(group["id"]), "role": role,
                    "credit_name": value, "sort_order": 1,
                    "note": f"backfilled from song_groups.{field}",
                })
    if len(group_credit_payloads) != 1142:
        raise RuntimeError(f"work-credit raw row drift: {len(group_credit_payloads)}")
    group_credit_payloads.extend(dict(row) for row in SPECIAL_WORK_VOCALS)

    existing_credit_resolution = [
        row for row in state["song_credits"] if row.get("credit_name") in dry.SEED_ENTITIES
    ]
    if len(existing_credit_resolution) != 6:
        raise RuntimeError(f"song-credit resolution drift: {len(existing_credit_resolution)}")

    groups_by_id = {int(row["id"]): row for row in state["song_groups"]}
    songs_by_id = {int(row["id"]): row for row in state["songs"]}
    members = dry.members_by_group(state["songs"])
    metadata_references: dict[int, int] = {}
    origins: list[dict[str, Any]] = []
    assessment: list[dict[str, Any]] = []
    for group in state["song_groups"]:
        base_id = group.get("base_song_id")
        if base_id is None:
            continue
        base = songs_by_id[int(base_id)]
        category, reason, origin_candidate = dry.classify_base(group, base, members[int(group["id"])])
        group_id = int(group["id"])
        assessment.append({"song_group_id": group_id, "title": group["title"], "category": category})
        if category != "E":
            metadata_references[group_id] = int(base_id)
        if category == "A":
            origins.append({
                "song_group_id": group_id, "origin_kind": "internal_song",
                "origin_song_id": int(base_id), "origin_reference_text": None,
                "note": reason,
            })
        elif category == "C":
            origins.append({
                "song_group_id": group_id, "origin_kind": "external_preexisting",
                "origin_song_id": None, "origin_reference_text": group["title"],
                "note": reason,
            })
        elif category == "D":
            if origin_candidate is None:
                raise RuntimeError(f"category D group has no origin candidate: {group_id}")
            origins.append({
                "song_group_id": group_id, "origin_kind": "internal_song",
                "origin_song_id": int(origin_candidate), "origin_reference_text": None,
                "note": reason,
            })
    if Counter(row["category"] for row in assessment) != Counter({"A": 15, "B": 6, "C": 3, "D": 2, "E": 1}):
        raise RuntimeError("base reassessment drifted")
    if len(metadata_references) != 26 or len(origins) != 20:
        raise RuntimeError("origin/reference plan count drifted")
    if any(
        row["origin_kind"] == "internal_song"
        and songs_by_id[int(row["origin_song_id"])]["song_group_id"] != row["song_group_id"]
        for row in origins
    ):
        raise RuntimeError("internal origin escaped its song_group")
    if any(
        row["origin_kind"] == "internal_song"
        for row in origins if groups_by_id[int(row["song_group_id"])].get("work_provenance") == "cover"
    ):
        raise RuntimeError("external work received an internal origin")

    return {
        "entities": entities,
        "group_credits": group_credit_payloads,
        "existing_credit_resolution_ids": [int(row["id"]) for row in existing_credit_resolution],
        "metadata_references": metadata_references,
        "origins": origins,
        "base_assessment": assessment,
    }


def summary(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "entities": len(plan["entities"]),
        "aliases": 0,
        "relationships": 7,
        "song_group_credits": len(plan["group_credits"]),
        "existing_song_credit_entity_links": len(plan["existing_credit_resolution_ids"]),
        "new_id47_song_credits": 3,
        "song_participations": 8,
        "metadata_references": len(plan["metadata_references"]),
        "origins": len(plan["origins"]),
        "origin_categories": dict(sorted(Counter(row["category"] for row in plan["base_assessment"]).items())),
    }


def apply_plan(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
) -> dict[str, list[int]]:
    inserted: dict[str, list[int]] = defaultdict(list)
    changed_credit_ids: list[int] = []
    changed_group_ids: list[int] = []
    try:
        entity_rows = insert_chunked(api, "entities", plan["entities"], inserted)
        entity_ids = {str(row["canonical_name"]): int(row["id"]) for row in entity_rows}
        if set(entity_ids) != set(dry.SEED_ENTITIES):
            raise RuntimeError("entity insert mapping mismatch")

        relationships = [
            {
                "subject_entity_id": entity_ids[row["subject"]],
                "relationship_type": row["relationship_type"],
                "object_entity_id": entity_ids[row["object"]],
                "sort_order": row.get("sort_order"),
                "note": "reviewed normal membership/identity relationship",
            }
            for row in [*dry.MEMBERSHIP_CANDIDATES, *dry.CHARACTER_RELATIONSHIP_CANDIDATES]
        ]
        insert_chunked(api, "entity_relationships", relationships, inserted)

        group_credits = [
            {
                **payload,
                "entity_id": entity_ids.get(str(payload["credit_name"])),
            }
            for payload in plan["group_credits"]
        ]
        insert_chunked(api, "song_group_credits", group_credits, inserted)

        existing_by_id = {int(row["id"]): row for row in before["song_credits"]}
        for credit_id in plan["existing_credit_resolution_ids"]:
            patch_one(
                api, "song_credits", credit_id,
                {"entity_id": entity_ids[str(existing_by_id[credit_id]["credit_name"])]},
            )
            changed_credit_ids.append(credit_id)

        id47_payloads = [
            {
                **payload,
                "entity_id": entity_ids[str(payload["credit_name"])],
                "note": "human-confirmed 不可解弐Q2 exact vocal participation",
            }
            for payload in ID47_CREDITS
        ]
        id47_rows = insert_chunked(api, "song_credits", id47_payloads, inserted)
        for credit in id47_rows:
            check = insert_chunked(api, "song_credit_checks", [{
                "song_credit_id": int(credit["id"]),
                "checked_value": {
                    "role": credit["role"], "credit_name": credit["credit_name"],
                    "sort_order": credit["sort_order"],
                },
                "checker_type": "human", "evidence": [],
                "note": "人間確認済み：不可解弐Q2の祭壇は花譜・春猿火・ヰ世界情緒の3名歌唱",
            }], inserted)
            if len(check) != 1:
                raise RuntimeError("id47 credit check insert mismatch")

        current_credits = [*before["song_credits"], *id47_rows]
        participation_credit_ids = {
            26, 27, 29, 31, 32, *(int(row["id"]) for row in id47_rows)
        }
        participation_payloads = [
            {
                "song_id": int(row["song_id"]),
                "entity_id": entity_ids[str(row["credit_name"])],
                "participation_role": "vocal",
                "sort_order": int(row["sort_order"]),
                "note": (
                    "human-confirmed 不可解弐Q2 exact participation"
                    if int(row["song_id"]) == 47 else
                    "derived only from reviewed individual exact-version vocal credit"
                ),
            }
            for row in current_credits if int(row["id"]) in participation_credit_ids
        ]
        if len(participation_payloads) != 8:
            raise RuntimeError("actual participation plan drifted")
        insert_chunked(api, "song_participations", participation_payloads, inserted)

        for group_id, song_id in plan["metadata_references"].items():
            patch_one(api, "song_groups", group_id, {"metadata_reference_song_id": song_id})
            changed_group_ids.append(group_id)
        insert_chunked(api, "song_group_origins", plan["origins"], inserted)

        inserted["changed_credit_ids"] = changed_credit_ids
        inserted["changed_group_ids"] = changed_group_ids
        inserted["entity_id_values"] = list(entity_ids.values())
        return inserted
    except Exception as error:
        rollback(api, before, inserted, changed_credit_ids, changed_group_ids)
        raise RuntimeError(f"backfill failed ({error}); compensating rollback completed") from None


def rollback(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    inserted: dict[str, list[int]],
    changed_credit_ids: list[int],
    changed_group_ids: list[int],
) -> None:
    for table in (
        "song_credit_check_sources", "song_credit_checks", "song_participations",
        "song_credits", "song_group_origins", "song_group_credits",
        "entity_relationships", "entity_aliases",
    ):
        delete_ids(api, table, inserted.get(table, []))
    credits_before = {int(row["id"]): row for row in before["song_credits"]}
    for credit_id in changed_credit_ids:
        patch_one(api, "song_credits", credit_id, {"entity_id": credits_before[credit_id].get("entity_id")})
    groups_before = {int(row["id"]): row for row in before["song_groups"]}
    for group_id in changed_group_ids:
        patch_one(
            api, "song_groups", group_id,
            {"metadata_reference_song_id": groups_before[group_id].get("metadata_reference_song_id")},
        )
    delete_ids(api, "entities", inserted.get("entities", []))


def entity_name_map(state: dict[str, list[dict[str, Any]]]) -> dict[int, str]:
    return {int(row["id"]): str(row["canonical_name"]) for row in state["entities"]}


def identity_set(
    entity_ids: set[int],
    relationships: list[dict[str, Any]],
    names: dict[int, str],
    *,
    expand_groups: bool,
) -> set[str]:
    outgoing: dict[tuple[int, str], set[int]] = defaultdict(set)
    for row in relationships:
        outgoing[(int(row["subject_entity_id"]), str(row["relationship_type"]))].add(int(row["object_entity_id"]))
    result: set[str] = set()
    for entity_id in entity_ids:
        voiced = outgoing.get((entity_id, "voiced_by"), set())
        members = outgoing.get((entity_id, "member"), set()) if expand_groups else set()
        resolved = voiced or members or {entity_id}
        result.update(names[value] for value in resolved)
    return result


def relation_label(original: set[str], version: set[str]) -> str:
    if not original or not version:
        return "unknown"
    if original == version:
        return "same"
    if original < version:
        return "added"
    if version < original:
        return "reduced"
    if original.isdisjoint(version):
        return "replaced"
    return "mixed"


def validate_vocal_relations(after: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    names = entity_name_map(after)
    ids_by_name = {name: entity_id for entity_id, name in names.items()}
    group_vocals: dict[int, set[int]] = defaultdict(set)
    for row in after["song_group_credits"]:
        if row.get("role") == "vocal" and row.get("entity_id") is not None:
            group_vocals[int(row["song_group_id"])].add(int(row["entity_id"]))
    song_vocals: dict[int, set[int]] = defaultdict(set)
    for row in after["song_participations"]:
        if row.get("participation_role") == "vocal":
            song_vocals[int(row["song_id"])].add(int(row["entity_id"]))

    breathe_o = identity_set(group_vocals[277], after["entity_relationships"], names, expand_groups=True)
    breathe_v = identity_set(song_vocals[286], after["entity_relationships"], names, expand_groups=False)
    rinne_o = identity_set(group_vocals[68], after["entity_relationships"], names, expand_groups=True)
    rinne_v = identity_set(song_vocals[86], after["entity_relationships"], names, expand_groups=False)
    awakukokoro_o = identity_set(group_vocals[87], after["entity_relationships"], names, expand_groups=True)
    awakukokoro_v = identity_set(song_vocals[164], after["entity_relationships"], names, expand_groups=False)
    id47 = identity_set(song_vocals[47], after["entity_relationships"], names, expand_groups=False)
    star_fixture = relation_label({"星界"}, {"星界", "ヰ世界情緒"})
    result = {
        "BREATHE_Rearranged": relation_label(breathe_o, breathe_v),
        "星界_duet_fixture": star_fixture,
        "輪廻_solo": relation_label(rinne_o, rinne_v),
        "あわく心模様_solo": relation_label(awakukokoro_o, awakukokoro_v),
        "あわく心模様_work_identity": sorted(awakukokoro_o),
        "id47_祭壇_participants": sorted(id47),
    }
    if result["BREATHE_Rearranged"] != "added" or star_fixture != "added" or result["輪廻_solo"] != "reduced":
        raise RuntimeError(f"vocal relation derivation mismatch: {result}")
    if result["あわく心模様_work_identity"] != ["ヰ世界情緒", "花譜"]:
        raise RuntimeError("character voiced_by identity resolution mismatch")
    if id47 != {"花譜", "春猿火", "ヰ世界情緒"}:
        raise RuntimeError("id47 exact participant set mismatch")
    if any(name not in ids_by_name for name in id47):
        raise RuntimeError("id47 participant entity is unresolved")
    return result


def validate_anon() -> dict[str, str]:
    api = anon_client()
    result: dict[str, str] = {}
    for table in PRIVATE_TABLES:
        try:
            rows = api.request(table, params=[("select", "id"), ("limit", "1")])
        except RuntimeError:
            result[table] = "denied"
            continue
        if rows != []:
            raise RuntimeError(f"anon can read management-only table {table}")
        result[table] = "empty_by_rls"
    return result


def validate(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
    inserted: dict[str, list[int]],
) -> dict[str, Any]:
    after = fetch_state(api)
    if len(after["songs"]) != 405 or len(after["song_groups"]) != 386:
        raise RuntimeError("song inventory changed")
    for table in IMMUTABLE_TABLES:
        if canonical_hash(after[table]) != canonical_hash(before[table]):
            raise RuntimeError(f"immutable table changed: {table}")

    if len(after["entities"]) != 15 or len({row["canonical_name"] for row in after["entities"]}) != 15:
        raise RuntimeError("entity count/uniqueness mismatch")
    if after["entity_aliases"]:
        raise RuntimeError("unexpected aliases were inserted")
    names = entity_name_map(after)
    if set(names.values()) != set(dry.SEED_ENTITIES):
        raise RuntimeError("ambiguous or unexpected entity was inserted")

    relationships = after["entity_relationships"]
    if len(relationships) != 7:
        raise RuntimeError("relationship count mismatch")
    membership = [row for row in relationships if row["relationship_type"] == "member"]
    voiced = [row for row in relationships if row["relationship_type"] == "voiced_by"]
    if len(membership) != 5 or len(voiced) != 2:
        raise RuntimeError("membership/voiced_by count mismatch")
    if any(names[int(row["subject_entity_id"])] in {"星界", "狐子", "裏命"} for row in relationships):
        raise RuntimeError("voicebank was automatically expanded")

    if len(after["song_group_credits"]) != len(plan["group_credits"]):
        raise RuntimeError("song_group_credits count mismatch")
    original_groups = {int(row["id"]): row for row in before["song_groups"]}
    expected_raw = {
        (int(group["id"]), role, 1, str(group[field]))
        for group in before["song_groups"]
        for role, field in WORK_CREDIT_FIELDS
        if group.get(field) is not None
    }
    actual_raw = {
        (int(row["song_group_id"]), str(row["role"]), int(row["sort_order"]), str(row["credit_name"]))
        for row in after["song_group_credits"]
        if not str(row.get("note") or "").startswith("human-confirmed")
    }
    if expected_raw != actual_raw:
        raise RuntimeError("song_group_credits raw text was not preserved")
    resolved_group_credits = sum(row.get("entity_id") is not None for row in after["song_group_credits"])
    if resolved_group_credits != 120:
        raise RuntimeError(f"resolved group-credit count mismatch: {resolved_group_credits}")

    before_credits = {int(row["id"]): row for row in before["song_credits"]}
    after_credits = {int(row["id"]): row for row in after["song_credits"]}
    if len(after_credits) != 12:
        raise RuntimeError("song_credits final count mismatch")
    for credit_id, row in before_credits.items():
        actual = after_credits[credit_id]
        for field, value in row.items():
            if field != "entity_id" and actual.get(field) != value:
                raise RuntimeError(f"song_credit raw/history field changed: {credit_id}/{field}")
    if sum(row.get("entity_id") is not None for row in before_credits.values()) != 0:
        raise RuntimeError("preflight credit snapshot unexpectedly resolved")
    if sum(after_credits[credit_id].get("entity_id") is not None for credit_id in before_credits) != 6:
        raise RuntimeError("existing song_credit entity resolution mismatch")

    participations = after["song_participations"]
    if len(participations) != 8:
        raise RuntimeError("actual participation count mismatch")
    allowed_participation_songs = {47, 84, 86, 164, 286}
    if {int(row["song_id"]) for row in participations} != allowed_participation_songs:
        raise RuntimeError("membership-derived participation was inserted")

    groups_after = {int(row["id"]): row for row in after["song_groups"]}
    for group_id, row in groups_after.items():
        before_row = original_groups[group_id]
        for field, value in before_row.items():
            if field != "metadata_reference_song_id" and row.get(field) != value:
                raise RuntimeError(f"legacy song_group field changed: {group_id}/{field}")
    actual_refs = {
        group_id: int(row["metadata_reference_song_id"])
        for group_id, row in groups_after.items() if row.get("metadata_reference_song_id") is not None
    }
    if actual_refs != plan["metadata_references"]:
        raise RuntimeError("metadata reference backfill mismatch")
    origins = after["song_group_origins"]
    if len(origins) != 20:
        raise RuntimeError("origin count mismatch")
    for origin in origins:
        group = groups_after[int(origin["song_group_id"])]
        if origin["origin_kind"] == "internal_song":
            song = next(row for row in after["songs"] if int(row["id"]) == int(origin["origin_song_id"]))
            if song["song_group_id"] != group["id"] or group.get("work_provenance") == "cover":
                raise RuntimeError("invalid internal origin assertion")
        elif origin["origin_kind"] != "external_preexisting":
            raise RuntimeError("unexpected origin kind")

    old_credit_checks = {int(row["id"]): row for row in before["song_credit_checks"]}
    new_credit_checks = {int(row["id"]): row for row in after["song_credit_checks"]}
    if any(new_credit_checks.get(row_id) != row for row_id, row in old_credit_checks.items()):
        raise RuntimeError("existing song_credit_checks changed")
    if set(new_credit_checks) - set(old_credit_checks) != set(inserted["song_credit_checks"]):
        raise RuntimeError("unexpected song_credit_checks were inserted")
    if after["song_credit_check_sources"] != before["song_credit_check_sources"]:
        raise RuntimeError("song_credit_check_sources changed without a source")

    vocal_relations = validate_vocal_relations(after)
    rls = validate_anon()
    return {
        "songs": len(after["songs"]), "song_groups": len(after["song_groups"]),
        "entities": len(after["entities"]), "aliases": len(after["entity_aliases"]),
        "relationships": len(relationships), "group_credits": len(after["song_group_credits"]),
        "resolved_group_credits": resolved_group_credits,
        "song_credits": len(after["song_credits"]), "participations": len(participations),
        "metadata_references": len(actual_refs), "origins": len(origins),
        "vocal_relations": vocal_relations, "rls": rls,
        "service_role": "SELECT/INSERT/UPDATE exercised; applied migrations grant DELETE",
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        api = service_client()
        before = fetch_state(api)
        plan = build_plan(before)
        if not args.apply:
            print(json.dumps({"mode": "read-only", "plan": summary(plan)}, ensure_ascii=False, indent=2))
            return 0
        if args.confirm != CONFIRM:
            print(f"write refused: require --apply --confirm {CONFIRM}", file=sys.stderr)
            return 2
        path = snapshot_path()
        write_snapshot(path, before)
        print(f"snapshot: {path}", flush=True)
        inserted = apply_plan(api, before, plan)
        try:
            validation = validate(api, before, plan, inserted)
        except Exception as error:
            rollback(
                api, before, inserted,
                inserted.get("changed_credit_ids", []), inserted.get("changed_group_ids", []),
            )
            raise RuntimeError(f"validation failed ({error}); compensating rollback completed") from None
        print(json.dumps({
            "mode": "applied", "snapshot": str(path), "plan": summary(plan),
            "inserted": {key: len(value) for key, value in inserted.items() if not key.startswith("changed_") and key != "entity_id_values"},
            "validation": validation, "rollback": False,
        }, ensure_ascii=False, indent=2))
        return 0
    except (KeyError, OSError, RuntimeError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
