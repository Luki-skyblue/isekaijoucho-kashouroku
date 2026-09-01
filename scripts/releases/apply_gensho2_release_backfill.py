"""Guarded, scoped backfill for the V.W.P「現象II」Blu-ray / LIVE CD package.

Only the confirmed product/source and the one exact song already represented by
the two historical availability records are inserted. Unknown tracklists are
intentionally not inferred.
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

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402
from apply_release_model_backfill import delete_ids, insert_many  # noqa: E402


CONFIRM: Final = "GENSHO2_RELEASE_BACKFILL_001"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "releases"
SNAPSHOT_TABLES: Final = (
    "songs",
    "release_groups",
    "releases",
    "release_components",
    "release_items",
    "release_sources",
    "song_digital_releases",
    "song_availabilities",
    "song_availability_sources",
    "reference_sources",
    "links",
)

TITLE: Final = "V.W.P「現象II」Blu-ray / LIVE CD"
OFFICIAL_URL: Final = "https://findmestore.thinkr.jp/products/ktr-100-0184"
SOURCE_ID: Final = 24
SONG_ID: Final = 200
AVAILABILITY_IDS: Final = (12, 13)
COMPONENTS: Final = (
    ("blu_ray", "Blu-ray", 1),
    ("cd", "LIVE CD", 2),
)


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in SNAPSHOT_TABLES}


def snapshot_path() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-gensho2-release-backfill-{stamp}.json"
    sequence = 1
    while path.exists():
        path = SNAPSHOT_ROOT / f"before-gensho2-release-backfill-{stamp}-{sequence}.json"
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


def plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    songs = {int(row["id"]): row for row in state["songs"]}
    references = {int(row["id"]): row for row in state["reference_sources"]}
    availabilities = {int(row["id"]): row for row in state["song_availabilities"]}
    availability_sources: dict[int, set[int]] = defaultdict(set)
    for row in state["song_availability_sources"]:
        availability_sources[int(row["song_availability_id"])].add(
            int(row["reference_source_id"])
        )

    if SONG_ID not in songs:
        raise RuntimeError("現象II: confirmed exact song is missing")
    if not songs[SONG_ID].get("title"):
        raise RuntimeError("現象II: confirmed exact song has no title")
    source = references.get(SOURCE_ID)
    if source is None or source.get("url") != OFFICIAL_URL or source.get("title") != TITLE:
        raise RuntimeError("現象II: official reference source drifted")
    if any(row.get("official_url") == OFFICIAL_URL for row in state["releases"]):
        raise RuntimeError("現象II: release is already present; refusing duplicate backfill")
    if any(row.get("title") == TITLE for row in state["release_groups"]):
        raise RuntimeError("現象II: release group title already present; refusing ambiguous reuse")

    expected_platforms = {"Blu-ray", "LIVE CD"}
    found_platforms: set[str] = set()
    for availability_id in AVAILABILITY_IDS:
        availability = availabilities.get(availability_id)
        if (
            availability is None
            or int(availability.get("song_id", -1)) != SONG_ID
            or availability.get("access_url") != OFFICIAL_URL
            or availability.get("content_type") != "live"
            or availability.get("media_type") != "physical"
            or availability.get("is_current") is not False
            or SOURCE_ID not in availability_sources[availability_id]
        ):
            raise RuntimeError(f"現象II: availability {availability_id} evidence drifted")
        found_platforms.add(str(availability.get("platform")))
    if found_platforms != expected_platforms:
        raise RuntimeError("現象II: confirmed availability platforms drifted")

    return {
        "song": songs[SONG_ID],
        "source": source,
        "components": [
            {"medium": medium, "component_name": name, "sort_order": order}
            for medium, name, order in COMPONENTS
        ],
    }


def apply(api: RestClient, current_plan: dict[str, Any]) -> dict[str, list[int]]:
    inserted: dict[str, list[int]] = defaultdict(list)
    try:
        group = insert_many(api, "release_groups", [{"title": TITLE, "release_date": None, "notes": None}])[0]
        group_id = int(group["id"])
        inserted["release_groups"].append(group_id)

        release = insert_many(api, "releases", [{
            "release_group_id": group_id,
            "title": TITLE,
            "release_type": "other",
            "release_kind": "other",
            "artist_credit": None,
            "release_date": None,
            "jacket_image_url": None,
            "official_url": OFFICIAL_URL,
            "notes": None,
            "edition_name": None,
            "is_primary_edition": True,
        }])[0]
        release_id = int(release["id"])
        inserted["releases"].append(release_id)

        component_rows = insert_many(api, "release_components", [{
            "release_id": release_id,
            "medium": component["medium"],
            "component_name": component["component_name"],
            "component_number": component["sort_order"],
            "sort_order": component["sort_order"],
            "catalog_number": None,
            "notes": None,
        } for component in current_plan["components"]])
        inserted["release_components"] = [int(row["id"]) for row in component_rows]
        component_ids = {
            int(row["sort_order"]): int(row["id"])
            for row in component_rows
        }

        song = current_plan["song"]
        item_rows = insert_many(api, "release_items", [{
            "release_group_id": group_id,
            "release_id": release_id,
            "release_component_id": component_ids[component["sort_order"]],
            "song_id": SONG_ID,
            "disc_number": None,
            "track_number": None,
            "sort_order": 1,
            "track_title": song["title"],
            "track_artist": song.get("artist_credit"),
            "title_override": None,
            "notes": None,
        } for component in current_plan["components"]])
        inserted["release_items"] = [int(row["id"]) for row in item_rows]

        source_row = insert_many(api, "release_sources", [{
            "release_id": release_id,
            "reference_source_id": SOURCE_ID,
            "locator": None,
            "evidence_note": "公式商品ページによりBlu-ray / LIVE CD収録を確認",
            "sort_order": 1,
        }])[0]
        inserted["release_sources"] = [int(source_row["id"])]
        return inserted
    except Exception:
        rollback(api, inserted)
        raise


def rollback(api: RestClient, inserted: dict[str, list[int]]) -> None:
    delete_ids(api, "release_sources", inserted.get("release_sources", []))
    delete_ids(api, "release_items", inserted.get("release_items", []))
    delete_ids(api, "release_components", inserted.get("release_components", []))
    delete_ids(api, "releases", inserted.get("releases", []))
    delete_ids(api, "release_groups", inserted.get("release_groups", []))


def validate(
    before: dict[str, list[dict[str, Any]]],
    after: dict[str, list[dict[str, Any]]],
    inserted: dict[str, list[int]],
) -> dict[str, Any]:
    immutable = (
        "songs", "song_digital_releases", "song_availabilities",
        "song_availability_sources", "reference_sources", "links",
    )
    for table in immutable:
        if canonical_hash(before[table]) != canonical_hash(after[table]):
            raise RuntimeError(f"{table}: changed unexpectedly")

    for table in ("release_groups", "releases", "release_components", "release_items", "release_sources"):
        before_by_id = {int(row["id"]): row for row in before[table]}
        after_by_id = {int(row["id"]): row for row in after[table]}
        if any(after_by_id.get(row_id) != row for row_id, row in before_by_id.items()):
            raise RuntimeError(f"{table}: existing row changed unexpectedly")
        expected_new = set(inserted.get(table, []))
        if set(after_by_id).difference(before_by_id) != expected_new:
            raise RuntimeError(f"{table}: unexpected new rows")

    if {table: len(ids) for table, ids in inserted.items()} != {
        "release_groups": 1,
        "releases": 1,
        "release_components": 2,
        "release_items": 2,
        "release_sources": 1,
    }:
        raise RuntimeError("現象II: insertion count mismatch")

    release = next(
        (row for row in after["releases"] if row.get("official_url") == OFFICIAL_URL),
        None,
    )
    if release is None or release.get("release_kind") != "other":
        raise RuntimeError("現象II: release identity mismatch")
    release_id = int(release["id"])
    components = [
        row for row in after["release_components"] if int(row["release_id"]) == release_id
    ]
    if {(row.get("medium"), row.get("component_name"), row.get("sort_order")) for row in components} != {
        ("blu_ray", "Blu-ray", 1),
        ("cd", "LIVE CD", 2),
    }:
        raise RuntimeError("現象II: component identity mismatch")
    component_ids = {int(row["id"]) for row in components}
    items = [row for row in after["release_items"] if int(row["release_id"]) == release_id]
    if len(items) != 2 or {int(row.get("song_id", -1)) for row in items} != {SONG_ID}:
        raise RuntimeError("現象II: same-song item relation mismatch")
    if {int(row["release_component_id"]) for row in items} != component_ids:
        raise RuntimeError("現象II: item/component relation mismatch")
    if any(row.get("sort_order") != 1 or row.get("track_number") is not None for row in items):
        raise RuntimeError("現象II: inferred track position was written")

    component_position_signatures = [
        (row.get("release_component_id"), row.get("sort_order"))
        for row in after["release_items"]
        if row.get("release_component_id") is not None and row.get("sort_order") is not None
    ]
    if len(component_position_signatures) != len(set(component_position_signatures)):
        raise RuntimeError("release_items: duplicate known component position")
    source_relations = [
        row for row in after["release_sources"]
        if int(row["release_id"]) == release_id and int(row["reference_source_id"]) == SOURCE_ID
    ]
    if len(source_relations) != 1:
        raise RuntimeError("現象II: official source relation mismatch")
    return {
        "release_id": release_id,
        "component_ids": sorted(component_ids),
        "item_ids": sorted(int(row["id"]) for row in items),
        "same_song_id": SONG_ID,
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()

    api = service_client()
    before = fetch_state(api)
    current_plan = plan(before)
    print(json.dumps({
        "mode": "dry-run",
        "title": TITLE,
        "song_id": SONG_ID,
        "components": current_plan["components"],
        "track_information": "unknown; track_number remains NULL",
    }, ensure_ascii=False, indent=2))
    if not args.apply:
        return
    if args.confirm != CONFIRM:
        raise SystemExit(f"write refused: require --apply --confirm {CONFIRM}")

    path = snapshot_path()
    write_snapshot(path, before)
    inserted: dict[str, list[int]] = defaultdict(list)
    try:
        inserted = apply(api, current_plan)
        after = fetch_state(api)
        result = validate(before, after, inserted)
    except Exception:
        if inserted:
            rollback(api, inserted)
        raise
    print(json.dumps({
        "mode": "applied",
        "snapshot": str(path),
        "inserted": {table: len(ids) for table, ids in inserted.items()},
        "validation": result,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
