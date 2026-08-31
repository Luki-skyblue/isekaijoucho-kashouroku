"""Read-only inventory for the entity / credit / participation model draft.

No names are inserted and no credits are parsed heuristically. A raw credit is
considered safely resolvable only when it exactly equals one of the deliberately
small seed entities below. Composite credits remain raw text for review.
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path
from typing import Any, Final


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))

from apply_song_model_backfill import select_all  # noqa: E402
from apply_live_song_setlist_ready import service_client  # noqa: E402


# These are deliberately exact, human-known entities used by the representative
# cases. This is not a broad parser and does not merge aliases automatically.
SEED_ENTITIES: Final = {
    "ヰ世界情緒": "artist",
    "花譜": "artist",
    "春猿火": "artist",
    "幸祜": "artist",
    "理芽": "artist",
    "朝比奈健人": "artist",
    "V.W.P": "group",
    "V.I.P": "group",
    "VALIS": "group",
    "CIEL": "artist",
    "星界": "voicebank",
    "狐子": "voicebank",
    "裏命": "voicebank",
    "夜河世界": "character",
    "森先化歩": "character",
}

MEMBERSHIP_CANDIDATES: Final = [
    {"subject": "V.W.P", "relationship_type": "member", "object": name, "sort_order": index}
    for index, name in enumerate(("花譜", "理芽", "春猿火", "ヰ世界情緒", "幸祜"), start=1)
]
CHARACTER_RELATIONSHIP_CANDIDATES: Final = [
    {"subject": "夜河世界", "relationship_type": "voiced_by", "object": "ヰ世界情緒"},
    {"subject": "森先化歩", "relationship_type": "voiced_by", "object": "花譜"},
]

# These two cases have an earlier, confirmed in-DB pre-formation rendition and
# are supplied by the human-confirmed review context. They are not inferred by
# delimiter or song_type alone.
KNOWN_INTERNAL_ORIGIN_CORRECTIONS: Final = {49: 27, 59: 47}


def members_by_group(songs: list[dict[str, Any]]) -> dict[int, list[dict[str, Any]]]:
    result: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for song in songs:
        if isinstance(song.get("song_group_id"), int):
            result[int(song["song_group_id"])].append(song)
    for rows in result.values():
        rows.sort(key=lambda row: int(row["id"]))
    return result


def classify_base(
    group: dict[str, Any],
    base: dict[str, Any],
    members: list[dict[str, Any]],
) -> tuple[str, str, int | None]:
    group_id = int(group["id"])
    if group_id in KNOWN_INTERNAL_ORIGIN_CORRECTIONS:
        return "D", "human-reviewed earlier in-DB pre-formation version", KNOWN_INTERNAL_ORIGIN_CORRECTIONS[group_id]
    if group.get("work_provenance") == "cover":
        return "C", "current work metadata identifies an external/pre-existing work", None
    if group.get("work_provenance") != "original":
        return "E", "work provenance is unresolved or mixed", None
    earlier_confirmed = [
        row for row in members
        if row.get("first_status") == "confirmed"
        and row.get("first_date")
        and base.get("first_date")
        and str(row["first_date"]) < str(base["first_date"])
    ]
    if earlier_confirmed:
        return "B", "earlier in-DB rendition exists, but origin status is not independently established", int(earlier_confirmed[0]["id"])
    if base.get("first_status") == "confirmed" and base.get("first_date"):
        return "A", "original work with earliest confirmed in-DB rendition on current base", int(base["id"])
    return "B", "useful primary/standard reference, but historical origin is not sufficiently confirmed", None


def main() -> None:
    api = service_client()
    songs = select_all(api, "songs")
    groups = select_all(api, "song_groups")
    song_credits = select_all(api, "song_credits")
    if len(songs) != 405 or len(groups) != 386:
        raise RuntimeError(f"unexpected production inventory: songs={len(songs)}, groups={len(groups)}")

    songs_by_id = {int(song["id"]): song for song in songs}
    members = members_by_group(songs)
    base_assessment: list[dict[str, Any]] = []
    for group in groups:
        base_id = group.get("base_song_id")
        if base_id is None:
            continue
        base = songs_by_id.get(int(base_id))
        if base is None or base.get("song_group_id") != group.get("id"):
            raise RuntimeError(f"invalid base_song_id for group {group['id']}")
        category, reason, candidate = classify_base(group, base, members[int(group["id"])])
        base_assessment.append({
            "song_group_id": int(group["id"]),
            "title": group.get("title"),
            "category": category,
            "reason": reason,
            "current_base_song_id": int(base_id),
            "candidate_origin_song_id": candidate,
            "base_first_date": base.get("first_date"),
            "base_first_status": base.get("first_status"),
        })
    if len(base_assessment) != 27:
        raise RuntimeError(f"expected 27 base_song_id rows, found {len(base_assessment)}")

    group_credit_candidates: list[dict[str, Any]] = []
    for group in groups:
        for role, field in (
            ("artist", "work_artist_credit"),
            ("vocal", "work_vocal_credit"),
            ("lyricist", "work_lyricist_credit"),
            ("composer", "work_composer_credit"),
            ("arranger", "work_arranger_credit"),
        ):
            value = group.get(field)
            if value is not None:
                group_credit_candidates.append({
                    "song_group_id": int(group["id"]),
                    "role": role,
                    "credit_name": value,
                    "entity_resolution": value if value in SEED_ENTITIES else None,
                })

    exact_resolved = [
        row for row in song_credits if row.get("credit_name") in SEED_ENTITIES
    ]
    actual_participation_candidates = [
        row for row in exact_resolved if row.get("role") == "vocal"
    ]
    unresolved_credit_names = sorted({
        str(row["credit_name"])
        for row in [*group_credit_candidates, *song_credits]
        if row.get("credit_name") not in SEED_ENTITIES
    })

    report = {
        "read_only": True,
        "inventory": {
            "songs": len(songs),
            "song_groups": len(groups),
            "base_song_id_rows": len(base_assessment),
            "existing_song_credits": len(song_credits),
            "seed_entities": len(SEED_ENTITIES),
        },
        "base_song_assessment_counts": dict(sorted(Counter(row["category"] for row in base_assessment).items())),
        "base_song_assessment": base_assessment,
        "entity_seed_candidates": [
            {"canonical_name": name, "entity_type": entity_type}
            for name, entity_type in SEED_ENTITIES.items()
        ],
        "relationship_candidates": {
            "membership": MEMBERSHIP_CANDIDATES,
            "character_voiced_by": CHARACTER_RELATIONSHIP_CANDIDATES,
        },
        "group_credit_candidates": {
            "total_nonnull_raw_credits": len(group_credit_candidates),
            "safe_exact_entity_links": sum(row["entity_resolution"] is not None for row in group_credit_candidates),
            "work_vocal_rows": sum(row["role"] == "vocal" for row in group_credit_candidates),
            "work_vocal_safe_exact_entity_links": sum(
                row["role"] == "vocal" and row["entity_resolution"] is not None
                for row in group_credit_candidates
            ),
        },
        "song_credit_candidates": {
            "existing_rows": len(song_credits),
            "safe_exact_entity_links": len(exact_resolved),
            "actual_vocal_participation_candidates": len(actual_participation_candidates),
            "rows": [
                {
                    "song_credit_id": row["id"], "song_id": row["song_id"],
                    "role": row["role"], "credit_name": row["credit_name"],
                    "entity_resolution": row["credit_name"] if row["credit_name"] in SEED_ENTITIES else None,
                }
                for row in song_credits
            ],
        },
        "unresolved_credit_names": {
            "count": len(unresolved_credit_names),
            "examples": unresolved_credit_names[:40],
        },
        "known_model_cases": {
            "BREATHE": "work vocal=ヰ世界情緒; exact rearranged participation=ヰ世界情緒, 春猿火; arranger=朝比奈健人; derived relation added",
            "星界_duet": "work vocal=星界; exact participation=星界, ヰ世界情緒; derived relation added",
            "輪廻_solo": "work vocal=V.W.P; exact participation=ヰ世界情緒; membership is fallback only; derived relation reduced when resolved",
            "あわく心模様": "official credits remain character entities; voiced_by relations resolve 夜河世界→ヰ世界情緒 and 森先化歩→花譜 for identity-aware queries",
            "VWP_special_lineup": "song_participations overrides membership expansion for the exact version",
            "ピース": "leave metadata reference/origin assertion NULL when no single in-DB origin is established",
        },
    }
    print(json.dumps(report, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
