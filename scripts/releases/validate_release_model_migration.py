"""Static checks for the additive release component migration.

This intentionally validates the SQL source without connecting to Supabase.
Applying the migration and backfilling data remain separate operations.
"""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "sql" / "releases" / "001_add_release_components_and_edition_tracks.sql"

REQUIRED_SNIPPETS = (
    "alter table public.releases\n  add column release_kind text",
    "create table public.release_components",
    "references public.releases (id) on delete cascade",
    "add column release_component_id bigint",
    "references public.release_components (id) on delete restrict",
    "add column sort_order integer",
    "create function public.enforce_release_item_component_membership()",
    "create trigger release_items_component_membership_trigger",
    "create table public.release_sources",
    "references public.reference_sources (id) on delete restrict",
    "alter table public.release_components enable row level security",
    "create policy release_components_public_select",
    "alter table public.release_sources enable row level security",
    "revoke all privileges on table public.release_sources from anon, authenticated",
    "grant all privileges on table public.release_sources to service_role",
    "begin;",
    "commit;",
)


def main() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    missing = [snippet for snippet in REQUIRED_SNIPPETS if snippet not in sql]
    if missing:
        print("FAIL: migration is missing required clauses:", file=sys.stderr)
        for snippet in missing:
            print(f"- {snippet}", file=sys.stderr)
        raise SystemExit(1)

    if "drop table" in sql.lower() or "delete from" in sql.lower():
        print("FAIL: additive migration contains a destructive statement", file=sys.stderr)
        raise SystemExit(1)

    print("PASS: release component migration is additive and contains required schema, FK, RLS, and grant clauses.")


if __name__ == "__main__":
    main()
