"""Static checks for the unapplied entity/credit/participation SQL drafts."""

from __future__ import annotations

import re
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
SQL = ROOT / "sql" / "song_model"

REQUIRED = {
    "004_create_entities_and_relationships.sql": (
        "create table public.entities",
        "create table public.entity_aliases",
        "create table public.entity_relationships",
        "enable row level security",
        "grant all privileges",
    ),
    "005_create_structured_credits_and_participations.sql": (
        "create table public.song_group_credits",
        "alter table public.song_credits",
        "add column entity_id",
        "create table public.song_participations",
        "on delete set null",
        "on delete restrict",
    ),
    "006_separate_metadata_reference_and_origin.sql": (
        "add column metadata_reference_song_id",
        "create table public.song_group_origins",
        "origin_kind = 'internal_song'",
        "create constraint trigger",
        "enable row level security",
    ),
}

DATA_MUTATION = re.compile(r"^\s*(?:insert\s+into|update|delete\s+from|truncate|drop\s+)\b", re.I | re.M)


def main() -> None:
    failures: list[str] = []
    for filename, fragments in REQUIRED.items():
        path = SQL / filename
        if not path.is_file():
            failures.append(f"missing {filename}")
            continue
        text = path.read_text(encoding="utf-8")
        lower = text.lower()
        if not lower.lstrip().startswith("-- reviewed draft"):
            failures.append(f"{filename}: draft banner missing")
        if "begin;" not in lower or "commit;" not in lower:
            failures.append(f"{filename}: transaction wrapper missing")
        if DATA_MUTATION.search(text):
            failures.append(f"{filename}: data/destructive mutation detected")
        for fragment in fragments:
            if fragment not in lower:
                failures.append(f"{filename}: missing {fragment}")
    if failures:
        raise SystemExit("entity model draft validation failed:\n- " + "\n- ".join(failures))
    print("PASS: entity/credit/participation drafts are additive, guarded, and transaction-wrapped.")


if __name__ == "__main__":
    main()
