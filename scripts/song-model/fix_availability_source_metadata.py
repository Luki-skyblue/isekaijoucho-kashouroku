"""Correct the focused availability/provider metadata identified in audit.

Default execution is read-only. Production writes require ``--apply`` and the
exact confirmation token. The touched tables are snapshotted before writes,
and a failed validation restores only changes made by this run.
"""

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

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402


CONFIRM: Final = "AVAILABILITY_SOURCE_METADATA_FIX"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-verification"
SOURCE_PUBLISHERS: Final = {
    62: "V.W.P -Virtual Witch Phenomenon-",
    63: "ヰ世界情緒 -Isekaijoucho-",
    64: "ヰ世界情緒 -Isekaijoucho-",
    65: "ヰ世界情緒 -Isekaijoucho-",
    66: "V.W.P -Virtual Witch Phenomenon-",
    67: "V.W.P -Virtual Witch Phenomenon-",
    68: "はるまきごはん / Harumaki Gohan Official",
}
AV36_PROVIDER: Final = "はるまきごはん / Harumaki Gohan Official"
AV37_PROVIDER: Final = "はるまきごはん / スタジオごはん"
AV37_SOURCE_ID: Final = 77


def select(api: RestClient, table: str, params: list[tuple[str, str]] | None = None) -> list[dict[str, Any]]:
    result = api.request(table, params=[("select", "*"), *(params or [])])
    if not isinstance(result, list):
        raise RuntimeError(f"{table}: read failed")
    return result


def patch_one(api: RestClient, table: str, row_id: int, payload: dict[str, Any]) -> None:
    result = api.request(
        table,
        method="PATCH",
        params=[("id", f"eq.{row_id}")],
        payload=payload,
        prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1 or int(result[0]["id"]) != row_id:
        raise RuntimeError(f"{table} #{row_id}: patch failed")


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {
        "song_availabilities": select(api, "song_availabilities", [("order", "id.asc")]),
        "song_availability_sources": select(api, "song_availability_sources", [("order", "id.asc")]),
        "reference_sources": select(api, "reference_sources", [("order", "id.asc")]),
    }


def snapshot(state: dict[str, list[dict[str, Any]]]) -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-availability-source-metadata-fix-{stamp}.json"
    path.write_text(
        json.dumps(
            {
                "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
                "operation": CONFIRM,
                "tables": state,
            },
            ensure_ascii=False,
            indent=2,
        )
        + "\n",
        encoding="utf-8",
    )
    return path


def row_map(rows: list[dict[str, Any]]) -> dict[int, dict[str, Any]]:
    return {int(row["id"]): row for row in rows}


def restore(api: RestClient, before: dict[str, list[dict[str, Any]]], relation_id: int | None) -> None:
    if relation_id is not None:
        api.delete_ids("song_availability_sources", [relation_id])

    before_availability = row_map(before["song_availabilities"])
    current_availability = row_map(select(api, "song_availabilities"))
    if 35 not in current_availability:
        result = api.request(
            "song_availabilities",
            method="POST",
            payload=[before_availability[35]],
            prefer="return=representation",
        )
        if not isinstance(result, list) or len(result) != 1:
            raise RuntimeError("rollback failed to restore availability #35")

    for row_id in (36, 37):
        original = before_availability[row_id]
        patch_one(
            api,
            "song_availabilities",
            row_id,
            {key: value for key, value in original.items() if key != "id"},
        )

    before_sources = row_map(before["reference_sources"])
    for source_id in SOURCE_PUBLISHERS:
        patch_one(
            api,
            "reference_sources",
            source_id,
            {"publisher": before_sources[source_id].get("publisher")},
        )


def validate(
    before: dict[str, list[dict[str, Any]]],
    after: dict[str, list[dict[str, Any]]],
) -> dict[str, Any]:
    before_availability = row_map(before["song_availabilities"])
    after_availability = row_map(after["song_availabilities"])
    before_sources = row_map(before["reference_sources"])
    after_sources = row_map(after["reference_sources"])

    if set(before_availability) - {35} != set(after_availability):
        raise RuntimeError("unexpected availability inventory change")
    for row_id in set(before_availability) - {35, 36, 37}:
        if before_availability[row_id] != after_availability[row_id]:
            raise RuntimeError(f"unexpected availability change: {row_id}")
    if after_availability[36]["provider"] != AV36_PROVIDER:
        raise RuntimeError("availability #36 provider mismatch")
    if after_availability[36]["provider_scope"] != before_availability[36]["provider_scope"]:
        raise RuntimeError("availability #36 provider_scope changed")

    source_77 = after_sources[AV37_SOURCE_ID]
    if after_availability[37]["provider"] != AV37_PROVIDER:
        raise RuntimeError("availability #37 provider mismatch")
    if after_availability[37]["access_url"] != source_77["url"]:
        raise RuntimeError("availability #37 URL does not match source #77")

    for source_id, publisher in SOURCE_PUBLISHERS.items():
        if after_sources[source_id]["publisher"] != publisher:
            raise RuntimeError(f"source #{source_id} publisher mismatch")
        if after_sources[source_id]["url"] != before_sources[source_id]["url"]:
            raise RuntimeError(f"source #{source_id} URL changed")
    for source_id in set(before_sources) - set(SOURCE_PUBLISHERS):
        if before_sources[source_id] != after_sources[source_id]:
            raise RuntimeError(f"unexpected reference source change: {source_id}")

    relations = after["song_availability_sources"]
    relation_matches = [
        row
        for row in relations
        if int(row["song_availability_id"]) == 37
        and int(row["reference_source_id"]) == AV37_SOURCE_ID
    ]
    if len(relation_matches) != 1:
        raise RuntimeError("availability #37 source relation mismatch")

    sourced = {int(row["song_availability_id"]) for row in relations}
    unsupported_current = [
        int(row["id"])
        for row in after["song_availabilities"]
        if row["is_current"] is True
        and row.get("access_url") is None
        and int(row["id"]) not in sourced
    ]
    if unsupported_current:
        raise RuntimeError(f"unsupported current availability remains: {unsupported_current}")

    return {
        "availability_35_deleted": 35 not in after_availability,
        "song_357_availability_ids": sorted(
            int(row["id"]) for row in after["song_availabilities"] if int(row["song_id"]) == 357
        ),
        "song_367_availability_ids": sorted(
            int(row["id"]) for row in after["song_availabilities"] if int(row["song_id"]) == 367
        ),
        "source_publishers": {source_id: after_sources[source_id]["publisher"] for source_id in SOURCE_PUBLISHERS},
        "current_url_null_source_zero": len(unsupported_current),
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()

    api = service_client()
    before = fetch_state(api)
    if not args.apply:
        print(json.dumps({"mode": "read-only", "targets": [35, 36, 37, *SOURCE_PUBLISHERS]}, ensure_ascii=False))
        return
    if args.confirm != CONFIRM:
        raise SystemExit(f"--confirm {CONFIRM} is required")

    snapshot_path = snapshot(before)
    relation_id: int | None = None
    try:
        patch_one(api, "song_availabilities", 36, {"provider": AV36_PROVIDER})
        patch_one(
            api,
            "song_availabilities",
            37,
            {
                "provider": AV37_PROVIDER,
                "access_url": row_map(before["reference_sources"])[AV37_SOURCE_ID]["url"],
            },
        )
        for source_id, publisher in SOURCE_PUBLISHERS.items():
            patch_one(api, "reference_sources", source_id, {"publisher": publisher})

        existing_relation = [
            row
            for row in before["song_availability_sources"]
            if int(row["song_availability_id"]) == 37
            and int(row["reference_source_id"]) == AV37_SOURCE_ID
        ]
        if not existing_relation:
            result = api.request(
                "song_availability_sources",
                method="POST",
                payload=[{
                    "song_availability_id": 37,
                    "reference_source_id": AV37_SOURCE_ID,
                    "evidence_note": "existing user-supplied exact digital release source",
                    "sort_order": 1,
                }],
                prefer="return=representation",
            )
            if not isinstance(result, list) or len(result) != 1:
                raise RuntimeError("availability #37 source relation insert failed")
            relation_id = int(result[0]["id"])

        api.delete_ids("song_availabilities", [35])
        after = fetch_state(api)
        result = validate(before, after)
    except Exception:
        restore(api, before, relation_id)
        raise

    print(json.dumps({"snapshot": str(snapshot_path), "validation": result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
