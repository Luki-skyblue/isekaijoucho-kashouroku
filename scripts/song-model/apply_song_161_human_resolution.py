"""Resolve the human-confirmed historical-original conflict for song 161.

Default execution is read-only. Writes require ``--apply`` and the exact
confirmation token. Song 353 is inspected only and is never modified.
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
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402


CONFIRM: Final = "SONG_161_HUMAN_RESOLUTION"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "song-verification"
TABLES: Final = (
    "songs", "song_groups", "song_field_checks", "song_credits",
    "song_credit_checks", "song_group_credits", "song_participations", "entities",
)


def fetch(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in TABLES}


def patch_song(api: RestClient, payload: dict[str, Any]) -> None:
    result = api.request(
        "songs", method="PATCH", params=[("id", "eq.161")],
        payload=payload, prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1 or int(result[0]["id"]) != 161:
        raise RuntimeError("song 161 patch read-back mismatch")


def insert_checks(api: RestClient, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    result = api.request(
        "song_field_checks", method="POST", payload=payloads,
        prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != len(payloads):
        raise RuntimeError("song 161 Human check insert read-back mismatch")
    return result


def inspect(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {int(row["id"]): row for row in state["songs"]}
    song161 = songs[161]
    human_161 = [
        row for row in state["song_field_checks"]
        if int(row["song_id"]) == 161
        and row["field_name"] in {"original_artist", "original_vocal"}
        and row["checker_type"] == "human"
    ]
    current_161 = [
        row for row in human_161
        if row.get("checked_value") == song161.get(row["field_name"])
    ]
    credits353 = {
        int(row["id"]): row for row in state["song_credits"]
        if int(row["song_id"]) == 353 and row["role"] == "arranger"
    }
    current_human_353 = [
        row for row in state["song_credit_checks"]
        if int(row["song_credit_id"]) in credits353
        and row["checker_type"] == "human"
        and row.get("checked_value") == {
            "role": credits353[int(row["song_credit_id"])]["role"],
            "credit_name": credits353[int(row["song_credit_id"])]["credit_name"],
            "sort_order": int(credits353[int(row["song_credit_id"])]["sort_order"]),
        }
    ]
    groups = {int(row["id"]): row for row in state["song_groups"]}
    entities = {int(row["id"]): row for row in state["entities"]}
    work_vocals = [
        entities[int(row["entity_id"])]["canonical_name"]
        for row in state["song_group_credits"]
        if int(row["song_group_id"]) == int(song161["song_group_id"])
        and row["role"] == "vocal" and row.get("entity_id") is not None
    ]
    participants = [
        entities[int(row["entity_id"])]["canonical_name"]
        for row in sorted(state["song_participations"], key=lambda value: int(value["sort_order"]))
        if int(row["song_id"]) == 161 and row["participation_role"] == "vocal"
    ]
    return {
        "song161": song161,
        "human_history_161": human_161,
        "current_human_161": current_161,
        "current_human_arranger_353": current_human_353,
        "group161": groups[int(song161["song_group_id"])],
        "work_vocals_161": work_vocals,
        "participants_161": participants,
    }


def inspect_161_after(api: RestClient, arranger_353: list[dict[str, Any]]) -> dict[str, Any]:
    def rows(table: str, params: list[tuple[str, str]]) -> list[dict[str, Any]]:
        result = api.request(table, params=params)
        if not isinstance(result, list):
            raise RuntimeError(f"{table}: focused read failed")
        return result

    song = rows("songs", [("id", "eq.161")])[0]
    group = rows("song_groups", [("id", f"eq.{song['song_group_id']}")])[0]
    checks = rows("song_field_checks", [("song_id", "eq.161"), ("checker_type", "eq.human")])
    credits = rows("song_group_credits", [("song_group_id", f"eq.{song['song_group_id']}"),
                                           ("role", "eq.vocal")])
    participations = rows("song_participations", [("song_id", "eq.161"),
                                                   ("participation_role", "eq.vocal")])
    entities = {int(row["id"]): row for row in select_all(api, "entities")}
    return {
        "song161": song,
        "current_human_161": [row for row in checks
                              if row["field_name"] in {"original_artist", "original_vocal"}
                              and row.get("checked_value") == song.get(row["field_name"])],
        "group161": group,
        "work_vocals_161": [entities[int(row["entity_id"])]["canonical_name"]
                            for row in credits if row.get("entity_id") is not None],
        "participants_161": [entities[int(row["entity_id"])]["canonical_name"]
                             for row in sorted(participations, key=lambda value: int(value["sort_order"]))],
        "current_human_arranger_353": arranger_353,
    }


def snapshot(state: dict[str, list[dict[str, Any]]]) -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-song-161-human-resolution-{stamp}.json"
    document = {
        "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "operation": CONFIRM,
        "counts": {table: len(rows) for table, rows in state.items()},
        "hashes": {table: canonical_hash(rows) for table, rows in state.items()},
        "tables": state,
    }
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def validate(report: dict[str, Any], inserted_ids: set[int]) -> None:
    song = report["song161"]
    if song["original_artist"] != "花譜" or song["original_vocal"] != "花譜":
        raise RuntimeError("song 161 original values mismatch")
    current = report["current_human_161"]
    if {(row["field_name"], row["checked_value"]) for row in current} != {
        ("original_artist", "花譜"), ("original_vocal", "花譜"),
    }:
        raise RuntimeError("song 161 current Human checks mismatch")
    if not inserted_ids.issubset({int(row["id"]) for row in current}):
        raise RuntimeError("new Human checks are not current")
    if report["group161"]["work_vocal_credit"] != "花譜" or report["work_vocals_161"] != ["花譜"]:
        raise RuntimeError("song 161 structured work vocal mismatch")
    expected = {"花譜", "理芽", "春猿火", "ヰ世界情緒", "幸祜"}
    if set(report["participants_161"]) != expected:
        raise RuntimeError("song 161 exact participants mismatch")
    if not ({"花譜"} < set(report["participants_161"])):
        raise RuntimeError("song 161 vocal relation is not added")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()
    api = service_client()
    before = fetch(api)
    report = inspect(before)
    output = {
        "song161_current": {
            "original_artist": report["song161"]["original_artist"],
            "original_vocal": report["song161"]["original_vocal"],
            "human_checks": report["current_human_161"],
        },
        "song353_current_human_arranger": report["current_human_arranger_353"],
    }
    if not args.apply:
        print(json.dumps({"mode": "read-only", **output}, ensure_ascii=False, indent=2))
        return
    if args.confirm != CONFIRM:
        raise SystemExit(f"--apply requires --confirm {CONFIRM}")
    path = snapshot(before)
    old_values = {"original_artist": report["song161"]["original_artist"],
                  "original_vocal": report["song161"]["original_vocal"]}
    inserted: list[dict[str, Any]] = []
    try:
        patch_song(api, {"original_artist": "花譜", "original_vocal": "花譜"})
        inserted = insert_checks(api, [
            {"song_id": 161, "field_name": field, "checked_value": "花譜",
             "checker_type": "human", "evidence": [],
             "note": "人間確定：historical originalは花譜『魔女』、original/work vocalは花譜"}
            for field in ("original_artist", "original_vocal")
        ])
        after = inspect_161_after(api, report["current_human_arranger_353"])
        validate(after, {int(row["id"]) for row in inserted})
    except Exception:
        if inserted:
            api.delete_ids("song_field_checks", [int(row["id"]) for row in inserted])
        patch_song(api, old_values)
        raise
    print(json.dumps({"mode": "applied", "snapshot": str(path),
                      "old": old_values, "new": {"original_artist": "花譜", "original_vocal": "花譜"},
                      "song353_current_human_arranger": after["current_human_arranger_353"]},
                     ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
