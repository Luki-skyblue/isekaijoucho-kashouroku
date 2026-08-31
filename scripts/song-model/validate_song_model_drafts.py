"""Static validation for unapplied song-model SQL drafts.

This validates file ordering, additive-only intent, and required security and
integrity clauses. It deliberately does not connect to Supabase or execute SQL.
"""

from __future__ import annotations

import re
from pathlib import Path
from typing import Final


ROOT: Final = Path(__file__).resolve().parents[2]
SQL_ROOT: Final = ROOT / "sql"

FILES: Final = {
    "work": SQL_ROOT / "song_model" / "001_add_song_group_work_fields.sql",
    "version": SQL_ROOT / "song_model" / "002_add_song_version_fields_and_credits.sql",
    "verification": SQL_ROOT / "song_model" / "003_add_song_model_verification.sql",
    "availability": SQL_ROOT / "song_references" / "002_document_current_availability_semantics.sql",
}

REQUIRED: Final = {
    "work": (
        "add column work_provenance text",
        "add column base_song_id bigint",
        "foreign key (base_song_id) references public.songs (id) on delete restrict",
        "create constraint trigger song_groups_base_song_membership_check",
        "create constraint trigger songs_base_song_membership_check",
    ),
    "version": (
        "add column performance_context text",
        "add column version_kind text",
        "create table public.song_credits",
        "alter table public.song_credits enable row level security",
        "grant all privileges on table public.song_credits",
    ),
    "verification": (
        "create table public.song_group_field_checks",
        "create table public.song_credit_checks",
        "create table public.song_group_field_check_sources",
        "create table public.song_credit_check_sources",
        "references public.reference_sources (id) on delete restrict",
        "enable row level security",
    ),
    "availability": (
        "comment on column public.song_availabilities.is_current",
        "new user can currently acquire or access",
    ),
}

MUTATING_PATTERN: Final = re.compile(
    r"^\s*(?:insert\s+into|update|delete\s+from|drop\s+(?:table|column|type|function))\b",
    re.IGNORECASE | re.MULTILINE,
)


def main() -> None:
    failures: list[str] = []

    for name, path in FILES.items():
        if not path.is_file():
            failures.append(f"missing draft: {path.relative_to(ROOT)}")
            continue

        text = path.read_text(encoding="utf-8")
        normalized = text.lower()
        if not normalized.lstrip().startswith("-- reviewed draft"):
            failures.append(f"{path.name}: missing reviewed-draft banner")
        if "begin;" not in normalized or "commit;" not in normalized:
            failures.append(f"{path.name}: transaction wrapper is incomplete")
        if MUTATING_PATTERN.search(text):
            failures.append(f"{path.name}: contains destructive or data-mutating SQL")
        for fragment in REQUIRED[name]:
            if fragment.lower() not in normalized:
                failures.append(f"{path.name}: missing required fragment: {fragment}")

    if failures:
        raise SystemExit("song-model draft validation failed:\n- " + "\n- ".join(failures))

    print("PASS: song-model SQL drafts are additive, transaction-wrapped, and contain required integrity/RLS clauses.")


if __name__ == "__main__":
    main()
