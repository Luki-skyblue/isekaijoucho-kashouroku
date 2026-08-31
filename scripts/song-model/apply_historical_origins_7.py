"""Guarded backfill for seven human-confirmed historical origins.

Default execution is read-only. Writes require ``--apply`` and the exact
confirmation token. A complete JSON snapshot is saved before the first write;
apply or validation failure compensates only this run's changes.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Final
from zoneinfo import ZoneInfo


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

from apply_live_song_setlist_ready import RestClient, anon_client, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402


CONFIRM: Final = "HISTORICAL_ORIGINS_7"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-model"
BREATHE_SOURCE_URL: Final = "https://kamitsubaki.jp/discography/isekaijoucho/8045/"

# group_id: (title, metadata reference, origin kind, origin song, external label)
TARGETS: Final = {
    58: ("深淵", 58, "internal_song", 58, None),
    87: ("あわく心模様", 87, "internal_song", 87, None),
    117: ("再会", 117, "internal_song", 117, None),
    161: ("魔女", 161, "external_preexisting", None, "花譜オリジナル「魔女」"),
    171: ("飛翔", 171, "internal_song", 171, None),
    198: ("切札", 198, "internal_song", 198, None),
    277: ("BREATHE", 277, "internal_song", 277, None),
}

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
    "entities", "entity_aliases", "entity_relationships",
    "song_group_credits", "songs", "song_credits", "song_participations",
    "song_field_checks", "song_field_check_sources",
    "song_credit_checks", "song_credit_check_sources", "reference_sources",
    "song_availabilities", "song_availability_sources",
    "releases", "links", "song_digital_releases",
    "live_performances", "live_setlist_entries", "live_setlist_entry_songs",
    "live_performance_sources", "live_performance_links",
)


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in SNAPSHOT_TABLES}


def snapshot_path() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-historical-origins-7-{stamp}.json"
    sequence = 1
    while path.exists():
        path = SNAPSHOT_ROOT / f"before-historical-origins-7-{stamp}-{sequence}.json"
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


def insert_many(api: RestClient, table: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not payloads:
        return []
    result = api.request(table, method="POST", payload=payloads, prefer="return=representation")
    if not isinstance(result, list) or len(result) != len(payloads):
        raise RuntimeError(f"{table}: INSERT read-back mismatch")
    return result


def patch_group(api: RestClient, group_id: int, reference_song_id: int | None) -> None:
    result = api.request(
        "song_groups", method="PATCH", params=[("id", f"eq.{group_id}")],
        payload={"metadata_reference_song_id": reference_song_id},
        prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError(f"song_groups {group_id}: PATCH read-back mismatch")


def delete_ids(api: RestClient, table: str, ids: list[int]) -> None:
    for offset in range(0, len(ids), 80):
        api.delete_ids(table, ids[offset:offset + 80])


def build_plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    if len(state["songs"]) != 405 or len(state["song_groups"]) != 386:
        raise RuntimeError("production song inventory drifted")
    if len(state["song_group_origins"]) != 20:
        raise RuntimeError("pre-existing origin inventory drifted")

    groups = {int(row["id"]): row for row in state["song_groups"]}
    songs = {int(row["id"]): row for row in state["songs"]}
    existing_origins = {int(row["song_group_id"]): row for row in state["song_group_origins"]}
    target_checks = [
        row for row in state["song_group_field_checks"]
        if int(row["song_group_id"]) in TARGETS
        and row["field_name"] == "metadata_reference_song_id"
    ]
    if target_checks:
        raise RuntimeError("target metadata reference already has a verification check")

    updates: dict[int, int] = {}
    origins: list[dict[str, Any]] = []
    checks: list[dict[str, Any]] = []
    for group_id, (title, reference_id, kind, origin_id, external_label) in TARGETS.items():
        group = groups.get(group_id)
        reference = songs.get(reference_id)
        if group is None or group["title"] != title:
            raise RuntimeError(f"group {group_id}: identity drifted")
        if reference is None or int(reference["song_group_id"]) != group_id:
            raise RuntimeError(f"group {group_id}: reference escaped group")
        if reference.get("version_kind") != "standard" or not reference.get("is_primary_version"):
            raise RuntimeError(f"group {group_id}: reference is not primary standard")
        if group_id in existing_origins:
            raise RuntimeError(f"group {group_id}: origin already exists")
        if group.get("metadata_reference_song_id") not in {None, reference_id}:
            raise RuntimeError(f"group {group_id}: unexpected metadata reference")
        if group.get("metadata_reference_song_id") != reference_id:
            updates[group_id] = reference_id
        if kind == "internal_song":
            origin = songs.get(int(origin_id)) if origin_id is not None else None
            if origin is None or int(origin["song_group_id"]) != group_id:
                raise RuntimeError(f"group {group_id}: invalid internal origin")
        elif kind != "external_preexisting" or origin_id is not None or not external_label:
            raise RuntimeError(f"group {group_id}: invalid external origin")
        origins.append({
            "song_group_id": group_id,
            "origin_kind": kind,
            "origin_song_id": origin_id,
            "origin_reference_text": external_label,
            "note": "人間確認済み：work / version系統の歴史的起点（初披露・初公開とは別概念）",
        })
        checks.append({
            "song_group_id": group_id,
            "field_name": "metadata_reference_song_id",
            "checked_value": reference_id,
            "checker_type": "human",
            "evidence": [],
            "note": "人間確認済み：metadata比較・継承の基準version。historical originとは別概念",
        })

    source_matches = [row for row in state["reference_sources"] if row["url"] == BREATHE_SOURCE_URL]
    if len(source_matches) != 1:
        raise RuntimeError("BREATHE official reference source is not uniquely reusable")
    return {
        "updates": updates,
        "origins": origins,
        "checks": checks,
        "breathe_source_id": int(source_matches[0]["id"]),
    }


def summary(plan: dict[str, Any]) -> dict[str, Any]:
    return {
        "origin_inserts": len(plan["origins"]),
        "internal_origins": sum(row["origin_kind"] == "internal_song" for row in plan["origins"]),
        "external_origins": sum(row["origin_kind"] == "external_preexisting" for row in plan["origins"]),
        "metadata_reference_updates": len(plan["updates"]),
        "human_reference_checks": len(plan["checks"]),
        "new_reference_sources": 0,
        "reused_source_relations": 1,
    }


def rollback(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    inserted: dict[str, list[int]],
    changed_groups: list[int],
) -> None:
    delete_ids(api, "song_group_field_check_sources", inserted.get("song_group_field_check_sources", []))
    delete_ids(api, "song_group_field_checks", inserted.get("song_group_field_checks", []))
    delete_ids(api, "song_group_origins", inserted.get("song_group_origins", []))
    groups_before = {int(row["id"]): row for row in before["song_groups"]}
    for group_id in changed_groups:
        patch_group(api, group_id, groups_before[group_id].get("metadata_reference_song_id"))


def apply_plan(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
) -> tuple[dict[str, list[int]], list[int]]:
    inserted: dict[str, list[int]] = defaultdict(list)
    changed_groups: list[int] = []
    try:
        for group_id, reference_id in plan["updates"].items():
            patch_group(api, group_id, reference_id)
            changed_groups.append(group_id)
        origin_rows = insert_many(api, "song_group_origins", plan["origins"])
        inserted["song_group_origins"] = [int(row["id"]) for row in origin_rows]
        check_rows = insert_many(api, "song_group_field_checks", plan["checks"])
        inserted["song_group_field_checks"] = [int(row["id"]) for row in check_rows]
        breathe_check = next(row for row in check_rows if int(row["song_group_id"]) == 277)
        source_rows = insert_many(api, "song_group_field_check_sources", [{
            "song_group_field_check_id": int(breathe_check["id"]),
            "reference_source_id": plan["breathe_source_id"],
            "evidence_note": "公式BREATHEページにより通常版をmetadata referenceとして照合",
            "sort_order": 1,
        }])
        inserted["song_group_field_check_sources"] = [int(row["id"]) for row in source_rows]
        return inserted, changed_groups
    except Exception as error:
        rollback(api, before, inserted, changed_groups)
        raise RuntimeError(f"backfill failed ({error}); compensating rollback completed") from None


def identity_names(
    entity_ids: set[int],
    relationships: list[dict[str, Any]],
    entities: dict[int, str],
    *,
    expand_groups: bool,
) -> set[str]:
    outgoing: dict[tuple[int, str], set[int]] = defaultdict(set)
    for row in relationships:
        outgoing[(int(row["subject_entity_id"]), str(row["relationship_type"]))].add(
            int(row["object_entity_id"])
        )
    result: set[str] = set()
    for entity_id in entity_ids:
        voiced = outgoing.get((entity_id, "voiced_by"), set())
        members = outgoing.get((entity_id, "member"), set()) if expand_groups else set()
        resolved = voiced or members or {entity_id}
        result.update(entities[value] for value in resolved)
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


def vocal_relations(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    entities = {int(row["id"]): str(row["canonical_name"]) for row in state["entities"]}
    group_vocals: dict[int, set[int]] = defaultdict(set)
    for row in state["song_group_credits"]:
        if row["role"] == "vocal" and row.get("entity_id") is not None:
            group_vocals[int(row["song_group_id"])].add(int(row["entity_id"]))
    song_vocals: dict[int, set[int]] = defaultdict(set)
    for row in state["song_participations"]:
        if row["participation_role"] == "vocal":
            song_vocals[int(row["song_id"])].add(int(row["entity_id"]))

    awa_o = identity_names(group_vocals[87], state["entity_relationships"], entities, expand_groups=True)
    awa_v = identity_names(song_vocals[164], state["entity_relationships"], entities, expand_groups=False)
    breathe_o = identity_names(group_vocals[277], state["entity_relationships"], entities, expand_groups=True)
    breathe_v = identity_names(song_vocals[286], state["entity_relationships"], entities, expand_groups=False)
    result = {
        "深淵_solo": relation_label({"ヰ世界情緒", "花譜"}, {"ヰ世界情緒"}),
        "あわく心模様_solo": relation_label(awa_o, awa_v),
        "あわく心模様_origin_identity": sorted(awa_o),
        "BREATHE_Rearranged": relation_label(breathe_o, breathe_v),
        "魔女_VWP": "unknown",
    }
    if result["深淵_solo"] != "reduced":
        raise RuntimeError("深淵 vocal relation mismatch")
    if result["あわく心模様_solo"] != "reduced" or awa_o != {"花譜", "ヰ世界情緒"}:
        raise RuntimeError("あわく心模様 character identity mismatch")
    if result["BREATHE_Rearranged"] != "added":
        raise RuntimeError("BREATHE vocal relation mismatch")
    return result


def validate_anon() -> dict[str, str]:
    api = anon_client()
    result: dict[str, str] = {}
    for table in ("song_group_origins", "song_group_field_checks", "song_group_field_check_sources"):
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

    groups_before = {int(row["id"]): row for row in before["song_groups"]}
    groups_after = {int(row["id"]): row for row in after["song_groups"]}
    for group_id, group in groups_after.items():
        for field, value in groups_before[group_id].items():
            if field != "metadata_reference_song_id" and group.get(field) != value:
                raise RuntimeError(f"song_groups unexpected change: {group_id}/{field}")
    for group_id, (_, reference_id, _, _, _) in TARGETS.items():
        if int(groups_after[group_id]["metadata_reference_song_id"]) != reference_id:
            raise RuntimeError(f"group {group_id}: metadata reference mismatch")

    existing_origin_ids = {int(row["id"]) for row in before["song_group_origins"]}
    if len(after["song_group_origins"]) != 27:
        raise RuntimeError("origin count mismatch")
    if any(
        row not in after["song_group_origins"]
        for row in before["song_group_origins"]
    ):
        raise RuntimeError("pre-existing origin changed")
    new_origins = [row for row in after["song_group_origins"] if int(row["id"]) not in existing_origin_ids]
    if {int(row["song_group_id"]) for row in new_origins} != set(TARGETS):
        raise RuntimeError("target origin set mismatch")
    songs = {int(row["id"]): row for row in after["songs"]}
    for row in new_origins:
        group_id = int(row["song_group_id"])
        if row["origin_kind"] == "internal_song":
            if row.get("origin_song_id") is None:
                raise RuntimeError("internal origin is missing song_id")
            if int(songs[int(row["origin_song_id"])]["song_group_id"]) != group_id:
                raise RuntimeError("internal origin escaped group")
        elif group_id == 161:
            if row["origin_kind"] != "external_preexisting" or row.get("origin_song_id") is not None:
                raise RuntimeError("魔女 external origin shape mismatch")
        else:
            raise RuntimeError("unexpected external origin")

    old_checks = {int(row["id"]): row for row in before["song_group_field_checks"]}
    current_checks = {int(row["id"]): row for row in after["song_group_field_checks"]}
    if any(current_checks.get(row_id) != row for row_id, row in old_checks.items()):
        raise RuntimeError("pre-existing group check changed")
    new_checks = [row for row_id, row in current_checks.items() if row_id not in old_checks]
    if len(new_checks) != 7 or {int(row["song_group_id"]) for row in new_checks} != set(TARGETS):
        raise RuntimeError("metadata reference human check mismatch")
    if any(row["checker_type"] != "human" or row["field_name"] != "metadata_reference_song_id" for row in new_checks):
        raise RuntimeError("metadata reference check semantics mismatch")
    if set(current_checks) - set(old_checks) != set(inserted["song_group_field_checks"]):
        raise RuntimeError("unexpected group check inserted")

    old_relations = {int(row["id"]): row for row in before["song_group_field_check_sources"]}
    current_relations = {int(row["id"]): row for row in after["song_group_field_check_sources"]}
    if any(current_relations.get(row_id) != row for row_id, row in old_relations.items()):
        raise RuntimeError("pre-existing group check source changed")
    new_relations = [row for row_id, row in current_relations.items() if row_id not in old_relations]
    if len(new_relations) != 1 or int(new_relations[0]["reference_source_id"]) != plan["breathe_source_id"]:
        raise RuntimeError("BREATHE source relation mismatch")

    origins_by_group = {int(row["song_group_id"]): row for row in after["song_group_origins"]}
    legacy_mismatches = []
    for group_id, origin in origins_by_group.items():
        base_id = groups_after[group_id].get("base_song_id")
        if origin["origin_kind"] != "internal_song" or origin.get("origin_song_id") != base_id:
            legacy_mismatches.append({
                "song_group_id": group_id,
                "title": groups_after[group_id]["title"],
                "base_song_id": base_id,
                "origin_kind": origin["origin_kind"],
                "origin_song_id": origin.get("origin_song_id"),
            })
    legacy_mismatches.sort(key=lambda row: row["song_group_id"])
    return {
        "songs": len(after["songs"]),
        "song_groups": len(after["song_groups"]),
        "origins": len(after["song_group_origins"]),
        "new_origins": len(new_origins),
        "new_human_checks": len(new_checks),
        "new_source_relations": len(new_relations),
        "legacy_semantic_mismatches": legacy_mismatches,
        "vocal_relations": vocal_relations(after),
        "rls": validate_anon(),
        "service_role": "SELECT/INSERT/UPDATE exercised; migration grants DELETE",
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
        inserted, changed_groups = apply_plan(api, before, plan)
        try:
            validation = validate(api, before, plan, inserted)
        except Exception as error:
            rollback(api, before, inserted, changed_groups)
            raise RuntimeError(f"validation failed ({error}); compensating rollback completed") from None
        print(json.dumps({
            "mode": "applied",
            "snapshot": str(path),
            "plan": summary(plan),
            "inserted": {table: len(ids) for table, ids in inserted.items()},
            "validation": validation,
            "rollback": False,
        }, ensure_ascii=False, indent=2))
        return 0
    except (KeyError, OSError, RuntimeError, TypeError, ValueError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
