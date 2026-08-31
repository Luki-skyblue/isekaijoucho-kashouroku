"""Read-only report for the staged release component / edition-track migration.

The script intentionally does not create release rows, components, items, or
song matches. It reports structurally safe candidates and the rows that need
product-page research or a later human decision before an apply step exists.
"""

from __future__ import annotations

import json
import re
import sys
import argparse
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Final


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))

from dry_run_song_model_backfill import select_all  # noqa: E402
from apply_live_song_setlist_ready import service_client  # noqa: E402


INSTRUMENTAL_PATTERN: Final = re.compile(r"(?:instrumental|\binst\.?\b)", re.IGNORECASE)


def as_int(value: Any) -> int | None:
    return value if isinstance(value, int) else None


def text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def existing_component_candidate(release: dict[str, Any]) -> dict[str, Any]:
    """Represent one conservative legacy component per current edition.

    The old model does not reliably state a medium for album/EP/compilation
    rows, so it deliberately leaves the proposed medium null except the
    explicit legacy `cd` type.
    """

    legacy_type = text(release.get("release_type"))
    return {
        "release_id": release.get("id"),
        "release_title": release.get("title"),
        "candidate_component_count": 1,
        "component_name_candidate": "legacy tracklist component",
        "medium_candidate": "cd" if legacy_type == "cd" else None,
        "medium_reason": (
            "legacy release_type is explicitly cd"
            if legacy_type == "cd"
            else "legacy release_type mixes work kind and medium; product evidence required"
        ),
    }


def classify_null_item(item: dict[str, Any]) -> str:
    title = text(item.get("track_title")) or text(item.get("title_override")) or ""
    if INSTRUMENTAL_PATTERN.search(title):
        return "instrumental_candidate"
    if text(item.get("track_artist")):
        return "unmatched_raw_artist_credit"
    return "unmatched_raw_track"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", action="store_true", help="emit counts and review queues without every candidate row")
    args = parser.parse_args()
    api = service_client()
    releases = select_all(api, "releases")
    release_groups = select_all(api, "release_groups")
    items = select_all(api, "release_items")
    digital_releases = select_all(api, "song_digital_releases")
    availabilities = select_all(api, "song_availabilities")
    availability_sources = select_all(api, "song_availability_sources")
    reference_sources = select_all(api, "reference_sources")
    release_components = select_all(api, "release_components")
    release_sources = select_all(api, "release_sources")

    release_by_id = {as_int(row.get("id")): row for row in releases if as_int(row.get("id")) is not None}
    group_by_id = {as_int(row.get("id")): row for row in release_groups if as_int(row.get("id")) is not None}
    items_by_release: dict[int, list[dict[str, Any]]] = defaultdict(list)
    items_by_group: dict[int, list[dict[str, Any]]] = defaultdict(list)
    null_items: list[dict[str, Any]] = []
    for item in items:
        release_id = as_int(item.get("release_id"))
        group_id = as_int(item.get("release_group_id"))
        if release_id is not None:
            items_by_release[release_id].append(item)
        if group_id is not None:
            items_by_group[group_id].append(item)
        if item.get("song_id") is None:
            null_items.append(item)

    edition_track_counts = []
    ui_scope_differences = []
    for release in sorted(releases, key=lambda row: int(row["id"])):
        release_id = int(release["id"])
        group_id = as_int(release.get("release_group_id"))
        edition_count = len(items_by_release.get(release_id, []))
        legacy_group_count = len(items_by_group.get(group_id, [])) if group_id is not None else edition_count
        entry = {
            "release_id": release_id,
            "release_title": release.get("title"),
            "release_group_id": group_id,
            "release_group_title": group_by_id.get(group_id, {}).get("title") if group_id else None,
            "edition_track_count": edition_count,
            "legacy_group_scope_count": legacy_group_count,
        }
        edition_track_counts.append(entry)
        if edition_count != legacy_group_count:
            ui_scope_differences.append(entry)

    physical_availability = [
        row for row in availabilities
        if row.get("media_type") == "physical"
    ]
    physical_release_candidates: dict[tuple[Any, ...], dict[str, Any]] = {}
    reference_by_id = {
        as_int(row.get("id")): row
        for row in reference_sources
        if as_int(row.get("id")) is not None
    }
    source_ids_by_availability: dict[int, list[int]] = defaultdict(list)
    for relation in availability_sources:
        availability_id = as_int(relation.get("song_availability_id"))
        source_id = as_int(relation.get("reference_source_id"))
        if availability_id is not None and source_id is not None:
            source_ids_by_availability[availability_id].append(source_id)
    for availability in physical_availability:
        key = (
            availability.get("access_url"),
            availability.get("platform"),
            availability.get("provider"),
            availability.get("content_type"),
        )
        candidate = physical_release_candidates.setdefault(key, {
            "access_url": availability.get("access_url"),
            "platform": availability.get("platform"),
            "provider": availability.get("provider"),
            "content_type": availability.get("content_type"),
            "is_current_values": set(),
            "song_ids": [],
            "availability_ids": [],
            "release_candidate_kind": "live product" if availability.get("content_type") == "live" else "physical product",
        })
        candidate["is_current_values"].add(availability.get("is_current"))
        candidate["song_ids"].append(availability.get("song_id"))
        candidate["availability_ids"].append(availability.get("id"))

    for candidate in physical_release_candidates.values():
        source_ids = sorted({
            source_id
            for availability_id in candidate["availability_ids"]
            for source_id in source_ids_by_availability.get(int(availability_id), [])
        })
        candidate["reference_sources"] = [
            {
                "id": source_id,
                "url": reference_by_id.get(source_id, {}).get("url"),
                "title": reference_by_id.get(source_id, {}).get("title"),
                "publisher": reference_by_id.get(source_id, {}).get("publisher"),
                "source_type": reference_by_id.get(source_id, {}).get("source_type"),
            }
            for source_id in source_ids
        ]

    digital_by_url: dict[str, list[dict[str, Any]]] = defaultdict(list)
    digital_by_title_date: dict[tuple[Any, Any], list[dict[str, Any]]] = defaultdict(list)
    for row in digital_releases:
        url = text(row.get("official_url"))
        if url:
            digital_by_url[url].append(row)
        digital_by_title_date[(row.get("title"), row.get("release_date"))].append(row)
    duplicate_digital_urls = {
        key: sorted(int(row["id"]) for row in rows)
        for key, rows in digital_by_url.items()
        if len(rows) > 1
    }
    duplicate_digital_title_dates = {
        f"{key[0]} / {key[1]}": sorted(int(row["id"]) for row in rows)
        for key, rows in digital_by_title_date.items()
        if len(rows) > 1
    }
    releases_by_url = {
        text(row.get("official_url")): row
        for row in releases
        if text(row.get("official_url"))
    }
    existing_release_url_matches = [
        {
            "song_digital_release_id": row.get("id"),
            "release_id": releases_by_url[text(row.get("official_url"))].get("id"),
            "url": row.get("official_url"),
        }
        for row in digital_releases
        if text(row.get("official_url")) in releases_by_url
    ]
    existing_release_title_date_matches = [
        {
            "song_digital_release_id": row.get("id"),
            "release_ids": sorted(
                int(release["id"])
                for release in releases
                if release.get("title") == row.get("title")
                and release.get("release_date") == row.get("release_date")
            ),
            "title": row.get("title"),
            "release_date": row.get("release_date"),
        }
        for row in digital_releases
        if any(
            release.get("title") == row.get("title")
            and release.get("release_date") == row.get("release_date")
            for release in releases
        )
    ]
    missing_digital_titles = [
        row for row in digital_releases if not text(row.get("title"))
    ]

    null_classification = Counter(classify_null_item(item) for item in null_items)
    report = {
        "read_only": True,
        "counts": {
            "release_groups": len(release_groups),
            "releases": len(releases),
            "release_items": len(items),
            "release_items_with_song_id": len(items) - len(null_items),
            "release_items_without_song_id": len(null_items),
            "song_digital_releases": len(digital_releases),
            "physical_availability_rows": len(physical_availability),
            "release_components": len(release_components),
            "release_sources": len(release_sources),
        },
        "release_component_candidates": [
            existing_component_candidate(release)
            for release in sorted(releases, key=lambda row: int(row["id"]))
        ],
        "release_item_mapping": {
            "safe_edition_relation_count": sum(1 for item in items if as_int(item.get("release_id")) is not None),
            "items_without_release_id": [item.get("id") for item in items if as_int(item.get("release_id")) is None],
            "component_mapping_rule": "Each existing item can be assigned only to a new default component belonging to its existing release_id; medium and real multi-disc structure require evidence.",
        },
        "digital_release_candidates": [
            {
                "song_digital_release_id": row.get("id"),
                "song_id": row.get("song_id"),
                "title": row.get("title"),
                "release_date": row.get("release_date"),
                "official_url": row.get("official_url"),
                "release_kind_candidate": "single",
                "component_medium_candidate": "digital",
                "mapping_rule": "One source row becomes one candidate digital edition/component/item unless later evidence permits consolidation.",
            }
            for row in sorted(digital_releases, key=lambda row: int(row["id"]))
        ],
        "digital_duplicate_analysis": {
            "duplicate_official_urls": duplicate_digital_urls,
            "duplicate_title_dates": duplicate_digital_title_dates,
            "existing_release_url_matches": existing_release_url_matches,
            "existing_release_title_date_matches": existing_release_title_date_matches,
            "missing_title_rows": missing_digital_titles,
        },
        "physical_release_candidates": [
            {
                **candidate,
                "is_current_values": sorted(candidate["is_current_values"]),
                "song_ids": sorted(candidate["song_ids"]),
                "availability_ids": sorted(candidate["availability_ids"]),
            }
            for candidate in physical_release_candidates.values()
        ],
        "edition_track_counts": edition_track_counts,
        "edition_ui_scope_differences": ui_scope_differences,
        "null_release_item_classification": {
            "counts": dict(sorted(null_classification.items())),
            "rule": "No automatic song matching. These labels are review queues, not canonical classifications.",
            "item_ids_by_class": {
                category: sorted(
                    int(item["id"])
                    for item in null_items
                    if classify_null_item(item) == category
                )
                for category in sorted(null_classification)
            },
        },
    }
    if args.summary:
        report = {
            "read_only": True,
            "counts": report["counts"],
            "release_item_mapping": report["release_item_mapping"],
            "digital_release_candidate_count": len(report["digital_release_candidates"]),
            "digital_duplicate_analysis": report["digital_duplicate_analysis"],
            "physical_release_candidates": report["physical_release_candidates"],
            "edition_ui_scope_differences": report["edition_ui_scope_differences"],
            "null_release_item_classification": report["null_release_item_classification"],
            "component_medium_known_count": sum(
                1
                for candidate in report["release_component_candidates"]
                if candidate["medium_candidate"] is not None
            ),
        }

    print(json.dumps(report, ensure_ascii=False, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
