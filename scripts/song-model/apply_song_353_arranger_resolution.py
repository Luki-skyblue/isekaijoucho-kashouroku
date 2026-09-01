"""Resolve the human-confirmed exact arranger for song 353 only."""

from __future__ import annotations

import argparse
import json
import sys
from datetime import datetime
from pathlib import Path
from typing import Any, Final
from zoneinfo import ZoneInfo


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402


CONFIRM: Final = "SONG_353_ARRANGER_RESOLUTION"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-verification"


def rows(api: RestClient, table: str, params: list[tuple[str, str]]) -> list[dict[str, Any]]:
    result = api.request(table, params=params)
    if not isinstance(result, list):
        raise RuntimeError(f"{table}: focused read failed")
    return result


def inspect(api: RestClient) -> dict[str, Any]:
    song = rows(api, "songs", [("id", "eq.353")])[0]
    group = rows(api, "song_groups", [("id", f"eq.{song['song_group_id']}")])[0]
    credits = rows(api, "song_credits", [("song_id", "eq.353"), ("role", "eq.arranger")])
    if len(credits) != 1:
        raise RuntimeError(f"song 353 exact arranger row count drifted: {len(credits)}")
    credit = credits[0]
    checks = rows(api, "song_credit_checks", [("song_credit_id", f"eq.{credit['id']}")])
    entities = rows(api, "entities", [("canonical_name", "eq.及川創介")])
    sources = rows(api, "song_credit_check_sources", [
        ("song_credit_check_id", f"in.({','.join(str(row['id']) for row in checks)})")
    ]) if checks else []
    song_checks = rows(api, "song_field_checks", [("song_id", "eq.353"),
                                                    ("field_name", "eq.original_arranger")])
    group_checks = rows(api, "song_group_field_checks", [
        ("song_group_id", f"eq.{song['song_group_id']}"), ("field_name", "eq.work_arranger_credit")])
    group_credits = rows(api, "song_group_credits", [
        ("song_group_id", f"eq.{song['song_group_id']}"), ("role", "eq.arranger")])
    return {"song": song, "group": group, "credit": credit, "checks": checks,
            "entities": entities, "check_sources": sources,
            "song_arranger_checks": song_checks, "group_arranger_checks": group_checks,
            "group_arranger_credits": group_credits}


def snapshot(report: dict[str, Any]) -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-song-353-arranger-resolution-{stamp}.json"
    document = {
        "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "operation": CONFIRM,
        "hash": canonical_hash([report]),
        "report": report,
    }
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def patch_credit(api: RestClient, credit_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    result = api.request(
        "song_credits", method="PATCH", params=[("id", f"eq.{credit_id}")],
        payload=payload, prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError("song 353 arranger patch read-back mismatch")
    return result[0]


def patch_by_id(api: RestClient, table: str, row_id: int, payload: dict[str, Any]) -> dict[str, Any]:
    result = api.request(table, method="PATCH", params=[("id", f"eq.{row_id}")],
                         payload=payload, prefer="return=representation")
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError(f"{table} #{row_id}: patch read-back mismatch")
    return result[0]


def insert_one(api: RestClient, table: str, payload: dict[str, Any]) -> dict[str, Any]:
    result = api.request(table, method="POST", payload=payload, prefer="return=representation")
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError(f"{table}: insert read-back mismatch")
    return result[0]


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()
    api = service_client()
    before = inspect(api)
    current_snapshot = {
        "role": before["credit"]["role"],
        "credit_name": before["credit"]["credit_name"],
        "sort_order": int(before["credit"]["sort_order"]),
    }
    current_human = [row for row in before["checks"]
                     if row["checker_type"] == "human" and row["checked_value"] == current_snapshot]
    current_ai = [row for row in before["checks"]
                  if row["checker_type"] == "ai" and row["checked_value"] == current_snapshot]
    if not args.apply:
        print(json.dumps({"mode": "read-only", "credit": before["credit"],
                          "current_human": current_human, "current_ai": current_ai,
                          "oikawa_entity": before["entities"],
                          "legacy_original_arranger": before["song"]["original_arranger"],
                          "work_arranger_credit": before["group"]["work_arranger_credit"],
                          "work_arranger_rows": before["group_arranger_credits"]},
                         ensure_ascii=False, indent=2))
        return
    if args.confirm != CONFIRM:
        raise SystemExit(f"--apply requires --confirm {CONFIRM}")
    path = snapshot(before)
    entity_created: dict[str, Any] | None = None
    check_created: dict[str, Any] | None = None
    song_check_created: dict[str, Any] | None = None
    group_check_created: dict[str, Any] | None = None
    group_credit_created: dict[str, Any] | None = None
    old_credit = before["credit"]
    try:
        if len(before["entities"]) > 1:
            raise RuntimeError("及川創介entity is not unique")
        entity = before["entities"][0] if before["entities"] else None
        if entity is None:
            entity_created = insert_one(api, "entities", {
                "canonical_name": "及川創介", "entity_type": "artist",
                "note": "human-confirmed exact arranger resolution for song 353",
            })
            entity = entity_created
        updated = patch_credit(api, int(old_credit["id"]), {
            "credit_name": "及川創介", "entity_id": int(entity["id"]),
        })
        patch_by_id(api, "songs", 353, {"original_arranger": "カンザキイオリ"})
        patch_by_id(api, "song_groups", int(before["group"]["id"]),
                    {"work_arranger_credit": "カンザキイオリ"})
        if not before["group_arranger_credits"]:
            group_credit_created = insert_one(api, "song_group_credits", {
                "song_group_id": int(before["group"]["id"]), "role": "arranger",
                "credit_name": "カンザキイオリ", "entity_id": None, "sort_order": 1,
                "note": "human-confirmed work arranger separation for 輪廻",
            })
        new_snapshot = {"role": updated["role"], "credit_name": updated["credit_name"],
                        "sort_order": int(updated["sort_order"])}
        check_created = insert_one(api, "song_credit_checks", {
            "song_credit_id": int(updated["id"]), "checked_value": new_snapshot,
            "checker_type": "human", "evidence": [],
            "note": "人間確定：work arrangerはカンザキイオリ、acoustic ver. exact arrangerは及川創介",
        })
        song_check_created = insert_one(api, "song_field_checks", {
            "song_id": 353, "field_name": "original_arranger",
            "checked_value": "カンザキイオリ", "checker_type": "human", "evidence": [],
            "note": "人間確定：work/original『輪廻』arrangerはカンザキイオリ",
        })
        group_check_created = insert_one(api, "song_group_field_checks", {
            "song_group_id": int(before["group"]["id"]), "field_name": "work_arranger_credit",
            "checked_value": "カンザキイオリ", "checker_type": "human", "evidence": [],
            "note": "人間確定：work/original『輪廻』arrangerはカンザキイオリ",
        })
        after = inspect(api)
        if after["credit"]["credit_name"] != "及川創介" or int(after["credit"]["entity_id"]) != int(entity["id"]):
            raise RuntimeError("song 353 arranger/entity validation failed")
        expected = {"role": "arranger", "credit_name": "及川創介",
                    "sort_order": int(after["credit"]["sort_order"])}
        if not any(row["checker_type"] == "human" and row["checked_value"] == expected
                   for row in after["checks"]):
            raise RuntimeError("new current Human check missing")
        if not any(row["checker_type"] == "human" and row["checked_value"] == current_snapshot
                   for row in after["checks"]):
            raise RuntimeError("old Human history was lost")
        if after["song"]["original_arranger"] != "カンザキイオリ":
            raise RuntimeError("legacy original arranger separation failed")
        if after["group"]["work_arranger_credit"] != "カンザキイオリ":
            raise RuntimeError("work arranger separation failed")
        if len(after["group_arranger_credits"]) != 1 or after["group_arranger_credits"][0]["credit_name"] != "カンザキイオリ":
            raise RuntimeError("structured work arranger mismatch")
        if not any(row["checker_type"] == "human" and row["checked_value"] == "カンザキイオリ"
                   for row in after["song_arranger_checks"]):
            raise RuntimeError("current Human original_arranger check missing")
        if not any(row["checker_type"] == "human" and row["checked_value"] == "カンザキイオリ"
                   for row in after["group_arranger_checks"]):
            raise RuntimeError("current Human work arranger check missing")
    except Exception:
        if group_check_created is not None:
            api.delete_ids("song_group_field_checks", [int(group_check_created["id"])])
        if song_check_created is not None:
            api.delete_ids("song_field_checks", [int(song_check_created["id"])])
        if check_created is not None:
            api.delete_ids("song_credit_checks", [int(check_created["id"])])
        if group_credit_created is not None:
            api.delete_ids("song_group_credits", [int(group_credit_created["id"])])
        patch_credit(api, int(old_credit["id"]), {
            "credit_name": old_credit["credit_name"], "entity_id": old_credit.get("entity_id"),
        })
        patch_by_id(api, "songs", 353,
                    {"original_arranger": before["song"]["original_arranger"]})
        patch_by_id(api, "song_groups", int(before["group"]["id"]),
                    {"work_arranger_credit": before["group"]["work_arranger_credit"]})
        if entity_created is not None:
            api.delete_ids("entities", [int(entity_created["id"])])
        raise
    print(json.dumps({
        "mode": "applied", "snapshot": str(path),
        "old": current_snapshot, "new": expected,
        "entity": {"id": int(entity["id"]), "created": entity_created is not None},
        "existing_current_ai_support": any(
            row["checker_type"] == "ai" and row["checked_value"] == expected for row in before["checks"]),
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
