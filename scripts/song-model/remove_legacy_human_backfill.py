"""Remove only the two audited legacy Human-check backfill runs.

The command is read-only unless ``--apply`` and the exact confirmation token
are supplied. It snapshots every deletion target and restores deleted rows if
post-delete validation fails.
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


CONFIRM: Final = "REMOVE_LEGACY_HUMAN_BACKFILL"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "verification"
NOTE_CONFIRMED: Final = (
    "song_field_checks導入前のconfirmed既存値をhuman確認済みとして初期化; "
    "confirmed-human-backfill-01dea3cb6fe64318a89c8d8b35cf7d3d"
)
NOTE_ARTIST: Final = (
    "song_field_checks導入前のconfirmed artist_creditをhuman確認済みとして初期化; "
    "artist-discovery-checks-a04554d38d1d44bf9ece61c8ed42e8a3"
)
CONFIRMED_TIMESTAMPS: Final = frozenset({
    "2026-08-31T03:12:56.557128+00:00",
    "2026-08-31T03:12:56.991814+00:00",
    "2026-08-31T03:12:57.484724+00:00",
    "2026-08-31T03:12:57.920563+00:00",
    "2026-08-31T03:12:58.244319+00:00",
    "2026-08-31T03:12:59.001711+00:00",
    "2026-08-31T03:12:59.360606+00:00",
    "2026-08-31T03:12:59.807586+00:00",
    "2026-08-31T03:13:00.119172+00:00",
    "2026-08-31T03:13:00.437894+00:00",
    "2026-08-31T03:13:00.761342+00:00",
    "2026-08-31T03:13:01.073098+00:00",
    "2026-08-31T03:13:01.344267+00:00",
    "2026-08-31T03:13:01.632927+00:00",
})
ARTIST_TIMESTAMP: Final = "2026-08-31T04:00:51.904815+00:00"
CONFIRMED_FIELDS: Final = frozenset({
    "first_date", "first_source", "first_full_date", "first_full_source",
    "tie_up", "album_text", "original_artist", "original_vocal",
    "original_lyricist", "original_composer", "original_arranger",
})
TARGET_FIELDS: Final = frozenset({
    "title", "song_type", "artist_credit", "discovery_category",
    "first_date", "first_source", "first_full_date", "first_full_source",
    "tie_up", "original_artist", "original_vocal", "original_lyricist",
    "original_composer", "original_arranger",
})
EXPLICIT_HUMAN_IDS: Final = frozenset({3499, 4663, 4664, 4665, 4995, 4996, 4997})


def is_confirmed_target(row: dict[str, Any]) -> bool:
    return (
        row.get("checker_type") == "human"
        and row.get("note") == NOTE_CONFIRMED
        and row.get("evidence") == []
        and row.get("checked_at") in CONFIRMED_TIMESTAMPS
        and row.get("field_name") in CONFIRMED_FIELDS
        and 76 <= int(row["id"]) <= 3498
    )


def is_artist_target(row: dict[str, Any]) -> bool:
    return (
        row.get("checker_type") == "human"
        and row.get("note") == NOTE_ARTIST
        and row.get("evidence") == []
        and row.get("checked_at") == ARTIST_TIMESTAMP
        and row.get("field_name") == "artist_credit"
        and 3502 <= int(row["id"]) <= 3782
    )


def targets(checks: list[dict[str, Any]]) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    confirmed = [row for row in checks if is_confirmed_target(row)]
    artist = [row for row in checks if is_artist_target(row)]
    if len(confirmed) != 3423 or len(artist) != 279:
        raise RuntimeError(
            f"preflight target mismatch: confirmed={len(confirmed)}, artist={len(artist)}"
        )
    if set(map(lambda row: int(row["id"]), confirmed)) & set(map(lambda row: int(row["id"]), artist)):
        raise RuntimeError("target runs overlap")
    return confirmed, artist


def write_snapshot(rows: list[dict[str, Any]]) -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"legacy-human-backfill-{stamp}.json"
    fields = (
        "id", "song_id", "field_name", "checked_value", "checker_type",
        "note", "evidence", "checked_at",
    )
    document = {
        "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "operation": CONFIRM,
        "count": len(rows),
        "rows": [{field: row.get(field) for field in fields} for row in rows],
    }
    path.write_text(json.dumps(document, ensure_ascii=False, indent=2) + "\n", encoding="utf-8")
    return path


def insert_batches(api: RestClient, table: str, rows: list[dict[str, Any]]) -> None:
    for offset in range(0, len(rows), 80):
        batch = rows[offset:offset + 80]
        result = api.request(table, method="POST", payload=batch, prefer="return=representation")
        if not isinstance(result, list) or len(result) != len(batch):
            raise RuntimeError(f"rollback insert failed at offset {offset}")


def current_human_field_values(
    songs: list[dict[str, Any]], checks: list[dict[str, Any]],
) -> int:
    songs_by_id = {int(row["id"]): row for row in songs}
    return len({
        (int(row["song_id"]), row["field_name"])
        for row in checks
        if row.get("checker_type") == "human"
        and row.get("field_name") in TARGET_FIELDS
        and row.get("checked_value") == songs_by_id[int(row["song_id"])].get(row["field_name"])
    })


def validate(
    before_checks: list[dict[str, Any]],
    after_checks: list[dict[str, Any]],
    before_songs: list[dict[str, Any]],
    after_songs: list[dict[str, Any]],
) -> dict[str, Any]:
    confirmed_after = [row for row in after_checks if row.get("note") == NOTE_CONFIRMED and row.get("checker_type") == "human"]
    artist_after = [row for row in after_checks if row.get("note") == NOTE_ARTIST and row.get("checker_type") == "human"]
    if confirmed_after or artist_after:
        raise RuntimeError("legacy Human backfill rows remain")

    human = [row for row in after_checks if row.get("checker_type") == "human"]
    ai_before = [row for row in before_checks if row.get("checker_type") == "ai"]
    ai_after = [row for row in after_checks if row.get("checker_type") == "ai"]
    if len(human) != 7:
        raise RuntimeError(f"unexpected Human check count: {len(human)}")
    if len(ai_before) != len(ai_after) or canonical_hash(ai_before) != canonical_hash(ai_after):
        raise RuntimeError("AI check history changed")
    if not EXPLICIT_HUMAN_IDS.issubset({int(row["id"]) for row in human}):
        raise RuntimeError("explicit Human checks were not preserved")
    if canonical_hash(before_songs) != canonical_hash(after_songs):
        raise RuntimeError("songs or status columns changed")

    target_human = [row for row in human if row.get("field_name") in TARGET_FIELDS]
    if len(target_human) != 6:
        raise RuntimeError(f"unexpected target-field Human check count: {len(target_human)}")
    if current_human_field_values(after_songs, after_checks) != 6:
        raise RuntimeError("unexpected current Human field-value count")

    songs_by_id = {int(row["id"]): row for row in after_songs}
    required_current = {(158, "tie_up"), (353, "original_arranger")}
    current_pairs = {
        (int(row["song_id"]), row["field_name"])
        for row in human
        if row.get("checked_value") == songs_by_id[int(row["song_id"])].get(row["field_name"])
    }
    if not required_current.issubset(current_pairs):
        raise RuntimeError("required current Human checks are missing")
    if any(int(row["song_id"]) == 68 and row["field_name"] == "first_source" for row in human):
        raise RuntimeError("song 68 first_source unexpectedly has a Human check")

    return {
        "human_checks": len(human),
        "target_field_human_checks": len(target_human),
        "current_human_field_values": current_human_field_values(after_songs, after_checks),
        "ai_checks_before": len(ai_before),
        "ai_checks_after": len(ai_after),
        "explicit_human_checks_preserved": len(EXPLICIT_HUMAN_IDS),
        "legacy_backfill_notes_remaining": 0,
        "song_158_tie_up_current_human": (158, "tie_up") in current_pairs,
        "song_353_original_arranger_current_human": (353, "original_arranger") in current_pairs,
        "song_68_first_source_human": False,
        "songs_unchanged": True,
    }


def main() -> None:
    parser = argparse.ArgumentParser()
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()

    api = service_client()
    before_checks = select_all(api, "song_field_checks")
    before_songs = select_all(api, "songs")
    confirmed, artist = targets(before_checks)
    deletion_rows = sorted([*confirmed, *artist], key=lambda row: int(row["id"]))
    preflight = {"confirmed": len(confirmed), "artist_credit": len(artist), "total": len(deletion_rows)}
    if not args.apply:
        print(json.dumps({"mode": "read-only", "preflight": preflight}, ensure_ascii=False, indent=2))
        return
    if args.confirm != CONFIRM:
        raise SystemExit(f"--confirm {CONFIRM} is required")

    target_ids = {int(row["id"]) for row in deletion_rows}
    source_relations = [
        row for row in select_all(api, "song_field_check_sources")
        if int(row["song_field_check_id"]) in target_ids
    ]
    if source_relations:
        raise RuntimeError(f"deletion targets unexpectedly have source relations: {len(source_relations)}")

    snapshot_path = write_snapshot(deletion_rows)
    try:
        for offset in range(0, len(deletion_rows), 80):
            api.delete_ids("song_field_checks", [int(row["id"]) for row in deletion_rows[offset:offset + 80]])
        after_checks = select_all(api, "song_field_checks")
        after_songs = select_all(api, "songs")
        result = validate(before_checks, after_checks, before_songs, after_songs)
    except Exception:
        remaining_ids = {int(row["id"]) for row in select_all(api, "song_field_checks")}
        missing = [row for row in deletion_rows if int(row["id"]) not in remaining_ids]
        insert_batches(api, "song_field_checks", missing)
        raise

    print(json.dumps({"snapshot": str(snapshot_path), "preflight": preflight, "validation": result}, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
