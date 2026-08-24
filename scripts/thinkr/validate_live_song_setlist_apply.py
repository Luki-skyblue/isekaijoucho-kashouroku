"""Read-only validation for an applied live-song-resolution ready set."""

from __future__ import annotations

import json
import sys
from pathlib import Path

import apply_live_song_setlist_ready as apply_module
import dry_run_live_song_setlist_ready as dry


def validate(ready_dir: Path) -> dict[str, int]:
    groups, songs, setlists, _ = dry.validate_ready(ready_dir)
    service = apply_module.service_client()
    db_songs = service.select(
        "songs",
        "id,title,artist_credit,version_type,version_name,song_group_id,is_primary_version",
    )
    db_groups = service.select("song_groups", "id,title")
    db_entries = service.select(
        "live_setlist_entries",
        "id,live_performance_id,sort_order,setlist_no_raw,song_title_raw,artist_credit_raw,song_id,joucho_participation,note_raw,notes",
    )

    local_ids: dict[str, int] = {}
    for row in songs:
        existing_group = dry.optional_int(row["existing_song_group_id"])
        matches = []
        for current in db_songs:
            if (
                current.get("title") == row["title"]
                and apply_module.dry.artist_key(current.get("artist_credit"))
                == apply_module.dry.artist_key(row["artist_credit"])
                and current.get("version_type") == row["version_type"]
                and current.get("version_name") == apply_module.nullable(row["version_name"])
                and current.get("is_primary_version")
                == apply_module.optional_bool(row["is_primary_version"])
            ):
                if row["creation_kind"] == "NEW_VERSION" and current.get("song_group_id") == existing_group:
                    matches.append(current)
                elif row["creation_kind"] == "NEW_SONG" and current.get("song_group_id") == current.get("id"):
                    matches.append(current)
        if len(matches) != 1:
            raise RuntimeError(f"ready songを一意にread-backできません: {row['local_song_key']}")
        local_ids[row["local_song_key"]] = int(matches[0]["id"])

    created_group_ids = {
        local_ids[row["local_song_key"]]
        for row in songs
        if row["creation_kind"] == "NEW_SONG"
    }
    db_group_ids = {int(row["id"]) for row in db_groups}
    if len(created_group_ids) != 18 or not created_group_ids.issubset(db_group_ids):
        raise RuntimeError("18 new song_groupsのread-backが一致しません。")

    actual_by_id = {int(row["id"]): row for row in db_entries}
    if len(actual_by_id) != 499:
        raise RuntimeError("live setlistが499行ではありません。")
    special_count = 0
    for row in setlists:
        actual = actual_by_id.get(int(row["setlist_entry_id"]))
        if actual is None:
            raise RuntimeError("ready setlist rowがDBにありません。")
        song_id = dry.optional_int(row["target_existing_song_id"])
        if row["target_local_song_key"]:
            song_id = local_ids[row["target_local_song_key"]]
        expected = {
            "live_performance_id": int(row["expected_live_performance_id"]),
            "sort_order": int(row["expected_sort_order"]),
            "song_title_raw": row["expected_song_title_raw"],
            "artist_credit_raw": row["expected_artist_credit_raw"],
            "song_id": song_id,
            "joucho_participation": dry.optional_bool(row["target_joucho_participation"]),
            "notes": row["notes_append"] or None,
        }
        if any(actual.get(field) != value for field, value in expected.items()):
            raise RuntimeError(f"setlist readyとの不一致があります: {row['setlist_entry_id']}")
        if row["resolution_status"] == "SPECIAL_UNRESOLVED":
            special_count += 1
            if actual.get("joucho_participation") is not True or actual.get("song_id") is not None:
                raise RuntimeError("SPECIAL_UNRESOLVEDの最終状態が不正です。")

    existing_song_ids = {int(row["id"]) for row in db_songs}
    if any(row.get("song_id") is not None and int(row["song_id"]) not in existing_song_ids for row in db_entries):
        raise RuntimeError("setlistに存在しないsong_id参照があります。")
    aggregates = (
        sum(row.get("joucho_participation") is True for row in db_entries),
        sum(row.get("joucho_participation") is False for row in db_entries),
        sum(row.get("song_id") is not None for row in db_entries),
        sum(row.get("song_id") is None for row in db_entries),
        special_count,
    )
    if aggregates != (378, 121, 375, 124, 3):
        raise RuntimeError(f"service aggregateが不正です: {aggregates}")

    immutable_counts = {
        "live_performances": 29,
        "live_series": 8,
        "live_series_members": 22,
        "live_event_groups": 1,
    }
    for table, expected in immutable_counts.items():
        if len(service.select(table, "id")) != expected:
            raise RuntimeError(f"既存live relation件数が変化しています: {table}")

    anon = apply_module.anon_client()
    anon_entries = anon.select("live_setlist_entries", "id,song_id,joucho_participation")
    if len(anon_entries) != 499 or sum(row.get("song_id") is not None for row in anon_entries) != 375:
        raise RuntimeError("anon setlist read-backが不正です。")
    anon_song_ids = {int(row["id"]) for row in anon.select("songs", "id")}
    referenced = {int(row["song_id"]) for row in anon_entries if row.get("song_id") is not None}
    if not referenced.issubset(anon_song_ids):
        raise RuntimeError("anonから参照先songを取得できません。")

    return {
        "song_groups_created": 18,
        "songs_created": len(local_ids),
        "setlists_updated": len(db_entries),
        "participation_true": aggregates[0],
        "participation_false": aggregates[1],
        "song_id_set": aggregates[2],
        "song_id_null": aggregates[3],
        "special_unresolved": aggregates[4],
        "anon_setlists": len(anon_entries),
        "anon_linked_rows": sum(row.get("song_id") is not None for row in anon_entries),
    }


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    ready = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else apply_module.DEFAULT_READY.resolve()
    try:
        print(json.dumps(validate(ready), ensure_ascii=False, indent=2))
        print("read-only validation: PASS")
        return 0
    except (OSError, RuntimeError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"read-only validation failed: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
