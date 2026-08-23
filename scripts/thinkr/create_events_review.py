"""Create a one-time human-review copy of the THINKR Wiki event CSV."""

from __future__ import annotations

import csv
import sys
from pathlib import Path
from typing import Final


REPOSITORY_ROOT: Final = Path(__file__).resolve().parents[2]
RAW_PATH: Final = (
    REPOSITORY_ROOT
    / "private-data"
    / "imports"
    / "thinkr"
    / "raw"
    / "events_raw.csv"
)
REVIEW_PATH: Final = (
    REPOSITORY_ROOT
    / "private-data"
    / "imports"
    / "thinkr"
    / "working"
    / "events_review.csv"
)
RAW_FIELDS: Final = [
    "source_category",
    "year",
    "page_key",
    "event_date_raw",
    "event_title_raw",
    "source_url",
    "import_target",
]
REVIEW_FIELDS: Final = [*RAW_FIELDS, "review_note"]


def read_raw_rows() -> list[dict[str, str]]:
    with RAW_PATH.open("r", encoding="utf-8-sig", newline="") as raw_file:
        reader = csv.DictReader(raw_file)
        if reader.fieldnames != RAW_FIELDS:
            raise RuntimeError(
                "events_raw.csvの列構成が想定と異なるため、レビュー用CSVを作成しません。"
            )
        return list(reader)


def write_review_rows(rows: list[dict[str, str]]) -> None:
    REVIEW_PATH.parent.mkdir(parents=True, exist_ok=True)

    # Exclusive creation protects a review file that a person may have edited.
    with REVIEW_PATH.open("x", encoding="utf-8-sig", newline="") as review_file:
        writer = csv.DictWriter(review_file, fieldnames=REVIEW_FIELDS)
        writer.writeheader()
        for row in rows:
            writer.writerow({**row, "import_target": "", "review_note": ""})


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    if REVIEW_PATH.exists():
        print(
            f"既存のレビュー結果を保護するため、上書きしません: {REVIEW_PATH}",
            file=sys.stderr,
        )
        return 1

    try:
        rows = read_raw_rows()
        write_review_rows(rows)
    except (OSError, RuntimeError) as error:
        print(f"レビュー用CSVの作成に失敗しました: {error}", file=sys.stderr)
        return 1

    print(f"作成件数: {len(rows)}")
    print(f"出力先: {REVIEW_PATH}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
