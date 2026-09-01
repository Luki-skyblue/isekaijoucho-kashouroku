"""Read-only audit for the release-item identity migration and 現象II dry-run."""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Final


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

from apply_live_song_setlist_ready import anon_client, service_client  # noqa: E402
from dry_run_song_model_backfill import select_all  # noqa: E402


GENSHO2_URL: Final = "https://findmestore.thinkr.jp/products/ktr-100-0184"
GENSHO2_SOURCE_ID: Final = 24
GENSHO2_SONG_ID: Final = 200


def key(value: Any) -> str:
    return "NULL" if value is None else str(value)


def duplicate_keys(rows: list[dict[str, Any]], fields: tuple[str, ...]) -> dict[str, list[int]]:
    grouped: dict[tuple[Any, ...], list[int]] = defaultdict(list)
    for row in rows:
        values = tuple(row.get(field) for field in fields)
        grouped[values].append(int(row["id"]))
    return {
        " / ".join(key(value) for value in values): ids
        for values, ids in grouped.items()
        if len(ids) > 1
    }


def main() -> None:
    api = service_client()
    items = select_all(api, "release_items")
    components = select_all(api, "release_components")
    releases = select_all(api, "releases")
    availabilities = select_all(api, "song_availabilities")
    availability_sources = select_all(api, "song_availability_sources")
    references = select_all(api, "reference_sources")

    components_by_id = {int(row["id"]): row for row in components}
    releases_by_id = {int(row["id"]): row for row in releases}
    source_ids_by_availability: dict[int, set[int]] = defaultdict(set)
    for relation in availability_sources:
        source_ids_by_availability[int(relation["song_availability_id"])].add(
            int(relation["reference_source_id"])
        )
    reference_by_id = {int(row["id"]): row for row in references}

    component_rows = [row for row in items if row.get("release_component_id") is not None]
    positioned_component_rows = [
        row for row in component_rows if row.get("sort_order") is not None
    ]
    component_track_rows = [
        row for row in component_rows if row.get("track_number") is not None
    ]
    legacy_component_null_rows = [row for row in items if row.get("release_component_id") is None]
    null_song_rows = [row for row in items if row.get("song_id") is None]

    component_position_duplicates = duplicate_keys(
        positioned_component_rows, ("release_component_id", "sort_order")
    )
    component_track_duplicates = duplicate_keys(
        component_track_rows, ("release_component_id", "track_number")
    )
    legacy_song_duplicates = duplicate_keys(
        [row for row in items if row.get("song_id") is not None], ("release_id", "song_id")
    )

    gensho_availabilities = [
        row for row in availabilities
        if row.get("access_url") == GENSHO2_URL
        and int(row.get("song_id", -1)) == GENSHO2_SONG_ID
    ]
    source = reference_by_id.get(GENSHO2_SOURCE_ID)
    if (
        source is None
        or source.get("url") != GENSHO2_URL
        or {row.get("platform") for row in gensho_availabilities} != {"Blu-ray", "LIVE CD"}
        or any(row.get("is_current") is not False for row in gensho_availabilities)
        or any(GENSHO2_SOURCE_ID not in source_ids_by_availability[int(row["id"])] for row in gensho_availabilities)
    ):
        raise RuntimeError("現象II dry-run evidence drifted")

    hypothetical_release_id = "new:現象II"
    hypothetical_rows = [
        {"release_id": hypothetical_release_id, "component": "blu_ray", "sort_order": 1, "song_id": GENSHO2_SONG_ID},
        {"release_id": hypothetical_release_id, "component": "live_cd", "sort_order": 1, "song_id": GENSHO2_SONG_ID},
    ]
    old_unique_conflict = len({(row["release_id"], row["song_id"]) for row in hypothetical_rows}) != len(hypothetical_rows)
    new_position_conflict = len({(row["component"], row["sort_order"]) for row in hypothetical_rows}) != len(hypothetical_rows)

    report = {
        "counts": {
            "release_items": len(items),
            "release_components": len(components),
            "releases": len(releases),
            "component_assigned_items": len(component_rows),
            "component_assigned_with_sort_order": len(positioned_component_rows),
            "component_assigned_with_track_number": len(component_track_rows),
            "legacy_component_null_items": len(legacy_component_null_rows),
            "song_id_null_items": len(null_song_rows),
        },
        "existing_duplicate_audit": {
            "component_sort_order": component_position_duplicates,
            "component_track_number": component_track_duplicates,
            "legacy_release_song": legacy_song_duplicates,
        },
        "component_release_integrity": {
            "invalid_item_ids": sorted(
                int(item["id"])
                for item in component_rows
                if int(item["release_component_id"]) not in components_by_id
                or int(components_by_id[int(item["release_component_id"])]["release_id"]) != int(item["release_id"])
            ),
            "componentless_release_ids": sorted(
                int(release_id)
                for release_id in releases_by_id
                if not any(int(component["release_id"]) == int(release_id) for component in components)
            ),
        },
        "gensho2_dry_run": {
            "source_id": GENSHO2_SOURCE_ID,
            "source_title": source.get("title"),
            "song_id": GENSHO2_SONG_ID,
            "availability_ids": sorted(int(row["id"]) for row in gensho_availabilities),
            "components": ["Blu-ray", "LIVE CD"],
            "old_unique_release_song_would_conflict": old_unique_conflict,
            "new_component_position_would_conflict": new_position_conflict,
            "result": "PASS" if old_unique_conflict and not new_position_conflict else "FAIL",
        },
    }

    # The public release page uses the anon client. Keep this probe read-only
    # so UI validation can distinguish a missing row from an access issue.
    try:
        anon = anon_client()
        public_release_fields = (
            "id,title,title_kana,sort_title,release_type,artist_credit,release_date,"
            "jacket_image_url,official_url,notes,release_group_id,edition_name,"
            "is_primary_edition"
        )
        public_releases = anon.request(
            "releases",
            params=[("select", public_release_fields), ("id", "in.(8,9)")],
        )
        public_items = anon.request(
            "release_items",
            params=[
                ("select", "id,release_id,release_component_id"),
                ("release_id", "eq.8"),
            ],
        )
        report["public_release_read_probe"] = {
            "release_ids": sorted(int(row["id"]) for row in public_releases),
            "release_8_item_count": len(public_items),
        }
    except RuntimeError as error:
        report["public_release_read_probe"] = {"error": str(error)}

    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
