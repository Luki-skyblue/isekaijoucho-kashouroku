"""Read-only classifier for the proposed song/work/version model backfill.

This program never sends a mutating request. It identifies candidates and
NEEDS_HUMAN queues only; applying the DDL and updating production data are
separate, explicitly approved steps.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from pathlib import Path
from typing import Any, Final


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

from apply_live_song_setlist_ready import RestClient, service_client  # noqa: E402


WORK_FIELDS: Final = (
    "original_artist",
    "original_vocal",
    "original_lyricist",
    "original_composer",
    "original_arranger",
)

STATUS_BY_FIELD: Final = {
    "original_artist": "original_artist_status",
    "original_vocal": "original_vocal_status",
    "original_lyricist": "original_lyricist_status",
    "original_composer": "original_composer_status",
    "original_arranger": "original_arranger_status",
}


def select_all(api: RestClient, table: str, fields: str = "*") -> list[dict[str, Any]]:
    result = api.request(table, params=[("select", fields), ("limit", "10000")])
    if not isinstance(result, list):
        raise RuntimeError(f"{table} did not return a list")
    return [row for row in result if isinstance(row, dict)]


def normalized_work_value(field: str, value: Any) -> Any:
    """Translate only the legacy original_artist sentinel for target analysis."""
    if field == "original_artist" and value == "-":
        return None
    return value


def current_human_checks(checks: list[dict[str, Any]]) -> set[tuple[int, str, str]]:
    result: set[tuple[int, str, str]] = set()
    for check in checks:
        if check.get("checker_type") != "human":
            continue
        song_id = check.get("song_id")
        field_name = check.get("field_name")
        if not isinstance(song_id, int) or not isinstance(field_name, str):
            continue
        value_key = json.dumps(check.get("checked_value"), ensure_ascii=False, sort_keys=True)
        result.add((song_id, field_name, value_key))
    return result


def has_current_human_check(song: dict[str, Any], field: str, checks: set[tuple[int, str, str]]) -> bool:
    song_id = song.get("id")
    if not isinstance(song_id, int):
        return False
    value_key = json.dumps(song.get(field), ensure_ascii=False, sort_keys=True)
    return (song_id, field, value_key) in checks


def is_confirmed_human(song: dict[str, Any], field: str, checks: set[tuple[int, str, str]]) -> bool:
    return song.get(STATUS_BY_FIELD[field]) == "confirmed" and has_current_human_check(song, field, checks)


def legacy_type(song: dict[str, Any]) -> str | None:
    value = song.get("song_type")
    return value if isinstance(value, str) else None


def safe_base_candidate(members: list[dict[str, Any]]) -> dict[str, Any] | None:
    if len(members) < 2:
        return None
    candidates = [
        song for song in members
        if song.get("is_primary_version") is True and song.get("version_type") == "standard"
    ]
    return candidates[0] if len(candidates) == 1 else None


def display_song(song: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": song.get("id"),
        "title": song.get("title"),
        "artist_credit": song.get("artist_credit"),
        "song_type": song.get("song_type"),
        "version_type": song.get("version_type"),
        "version_name": song.get("version_name"),
        "is_primary_version": song.get("is_primary_version"),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--summary", action="store_true", help="emit counts and compact candidate lists")
    args = parser.parse_args()

    api = service_client()
    songs = select_all(api, "songs")
    groups = select_all(api, "song_groups")
    checks = select_all(api, "song_field_checks")
    human_checks = current_human_checks(checks)

    members_by_group: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for song in songs:
        group_id = song.get("song_group_id")
        if isinstance(group_id, int):
            members_by_group[group_id].append(song)

    for members in members_by_group.values():
        members.sort(key=lambda song: int(song["id"]))

    provenance_safe: list[dict[str, Any]] = []
    provenance_mixed: list[dict[str, Any]] = []
    base_candidates: list[dict[str, Any]] = []
    variant_candidates: list[dict[str, Any]] = []
    collaboration_review: list[dict[str, Any]] = []
    credit_consistent: list[dict[str, Any]] = []
    credit_conflicts: list[dict[str, Any]] = []
    original_artist_dash: list[dict[str, Any]] = []
    exact_credit_candidates: list[dict[str, Any]] = []

    for group_id, members in sorted(members_by_group.items()):
        types = {legacy_type(song) for song in members}
        non_variant_non_collab = {
            value for value in types
            if value in {"original", "cover"}
        }
        base = safe_base_candidate(members)
        base_summary = display_song(base) if base else None

        if base:
            base_candidates.append({"song_group_id": group_id, "base_song": base_summary})

        if len(types) == 1 and next(iter(types)) in {"original", "cover"}:
            provenance_safe.append({
                "song_group_id": group_id,
                "work_provenance": next(iter(types)),
                "members": [display_song(song) for song in members],
            })
        elif non_variant_non_collab and len(non_variant_non_collab) == 1 and not any(
            legacy_type(song) == "collaboration" for song in members
        ):
            provenance_safe.append({
                "song_group_id": group_id,
                "work_provenance": next(iter(non_variant_non_collab)),
                "members": [display_song(song) for song in members],
            })
        else:
            provenance_mixed.append({
                "song_group_id": group_id,
                "legacy_song_types": sorted(value for value in types if value is not None),
                "members": [display_song(song) for song in members],
            })

        for song in members:
            if legacy_type(song) == "collaboration":
                inherited = None
                if base and legacy_type(base) in {"original", "cover"}:
                    inherited = legacy_type(base)
                collaboration_review.append({
                    "song_group_id": group_id,
                    "song": display_song(song),
                    "inherited_work_provenance_candidate": inherited,
                    "needs_human": inherited is None,
                })

            if legacy_type(song) == "variant":
                inherited = None
                if base and legacy_type(base) in {"original", "cover"}:
                    inherited = legacy_type(base)
                variant_candidates.append({
                    "song_group_id": group_id,
                    "song": display_song(song),
                    "inherited_work_provenance_candidate": inherited,
                    "needs_human": inherited is None,
                })

            if song.get("original_artist") == "-":
                original_artist_dash.append({
                    "song_group_id": group_id,
                    "song": display_song(song),
                    "target_work_artist_credit": None,
                    "current_human_check": has_current_human_check(song, "original_artist", human_checks),
                })

        normalized_values = {
            field: {
                json.dumps(normalized_work_value(field, song.get(field)), ensure_ascii=False, sort_keys=True)
                for song in members
            }
            for field in WORK_FIELDS
        }
        conflicts = [field for field, values in normalized_values.items() if len(values) > 1]
        source = base or (members[0] if len(members) == 1 else None)
        safe_fields = [
            field for field in WORK_FIELDS
            if source and field not in conflicts and is_confirmed_human(source, field, human_checks)
        ]

        record = {
            "song_group_id": group_id,
            "source_song": display_song(source) if source else None,
            "safe_fields": safe_fields,
            "members": [display_song(song) for song in members],
        }
        if conflicts:
            record["conflicting_fields"] = conflicts
            credit_conflicts.append(record)
        else:
            credit_consistent.append(record)

        if base:
            for song in members:
                if song["id"] == base["id"]:
                    continue
                differences = []
                for field in ("original_vocal", "original_lyricist", "original_composer", "original_arranger"):
                    current = normalized_work_value(field, song.get(field))
                    base_value = normalized_work_value(field, base.get(field))
                    if current is not None and current != base_value:
                        differences.append({"field": field, "current": current, "base": base_value})
                named_variant = song.get("version_name") is not None or song.get("version_type") not in {"standard", None}
                if differences or named_variant:
                    exact_credit_candidates.append({
                        "song_group_id": group_id,
                        "base_song": base_summary,
                        "song": display_song(song),
                        "legacy_credit_differences": differences,
                        "requires_independent_source": True,
                    })

    orphan_groups = [group for group in groups if isinstance(group.get("id"), int) and group["id"] not in members_by_group]
    collaboration_needs_human = [item for item in collaboration_review if item["needs_human"]]
    variant_needs_human = [item for item in variant_candidates if item["needs_human"]]
    exact_credit_difference_candidates = [
        item for item in exact_credit_candidates if item["legacy_credit_differences"]
    ]

    report = {
        "read_only": True,
        "counts": {
            "songs": len(songs),
            "song_groups": len(groups),
            "referenced_song_groups": len(members_by_group),
            "orphan_song_groups": len(orphan_groups),
            "work_provenance_safe_candidates": len(provenance_safe),
            "work_provenance_mixed_or_unresolved_groups": len(provenance_mixed),
            "base_song_safe_candidates": len(base_candidates),
            "collaboration_rows": len(collaboration_review),
            "collaboration_needs_human": len(collaboration_needs_human),
            "variant_rows": len(variant_candidates),
            "variant_needs_human": len(variant_needs_human),
            "work_credit_consistent_groups": len(credit_consistent),
            "work_credit_conflict_groups": len(credit_conflicts),
            "legacy_original_artist_dash_rows": len(original_artist_dash),
            "exact_version_credit_candidates": len(exact_credit_candidates),
            "exact_version_credit_difference_candidates": len(exact_credit_difference_candidates),
        },
        "work_provenance_safe_candidates": provenance_safe,
        "work_provenance_mixed_or_unresolved_groups": provenance_mixed,
        "base_song_safe_candidates": base_candidates,
        "collaboration_review": collaboration_review,
        "variant_provenance_candidates": variant_candidates,
        "work_credit_consistent_groups": credit_consistent,
        "work_credit_conflict_groups": credit_conflicts,
        "legacy_original_artist_dash_rows": original_artist_dash,
        "exact_version_credit_candidates": exact_credit_candidates,
        "exact_version_credit_difference_candidates": exact_credit_difference_candidates,
        "orphan_song_groups": [{"id": group.get("id"), "title": group.get("title")} for group in orphan_groups],
    }

    if args.summary:
        summary = {
            "read_only": True,
            "counts": report["counts"],
            "collaboration_needs_human": collaboration_needs_human,
            "variant_needs_human": variant_needs_human,
            "work_credit_conflicts": [
                {"song_group_id": item["song_group_id"], "conflicting_fields": item["conflicting_fields"]}
                for item in credit_conflicts
            ],
            "exact_version_credit_difference_candidates": exact_credit_difference_candidates,
        }
        print(json.dumps(summary, ensure_ascii=False, indent=2))
        return

    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
