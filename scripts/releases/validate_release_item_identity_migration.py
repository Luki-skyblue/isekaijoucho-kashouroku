"""Static validation for release-item occurrence identity migration SQL."""

from __future__ import annotations

import sys
from pathlib import Path


ROOT = Path(__file__).resolve().parents[2]
MIGRATION = ROOT / "sql" / "releases" / "002_replace_release_item_song_uniqueness.sql"

REQUIRED = (
    "drop constraint if exists release_items_release_id_song_id_key",
    "create unique index release_items_component_sort_order_unique_idx",
    "on public.release_items (release_component_id, sort_order)",
    "where release_component_id is not null",
    "and sort_order is not null",
    "Does not constrain song_id",
    "begin;",
    "commit;",
)


def main() -> None:
    sql = MIGRATION.read_text(encoding="utf-8")
    missing = [snippet for snippet in REQUIRED if snippet not in sql]
    if missing:
        print("FAIL: missing migration clauses", file=sys.stderr)
        for snippet in missing:
            print(f"- {snippet}", file=sys.stderr)
        raise SystemExit(1)
    if "delete from" in sql.lower() or "drop table" in sql.lower():
        print("FAIL: migration contains destructive data/table operation", file=sys.stderr)
        raise SystemExit(1)
    print("PASS: migration replaces legacy release/song uniqueness with a partial component/position unique index.")


if __name__ == "__main__":
    main()
