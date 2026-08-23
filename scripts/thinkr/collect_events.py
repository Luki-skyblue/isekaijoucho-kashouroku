"""Collect the event index from the THINKR Wiki top page as a raw CSV.

This script requests only the top page. It does not visit event detail pages.
"""

from __future__ import annotations

import csv
import re
import sys
from collections import Counter
from dataclasses import dataclass, field
from html.parser import HTMLParser
from pathlib import Path
from typing import Final
from urllib.error import HTTPError, URLError
from urllib.parse import parse_qs, unquote, urljoin, urlparse
from urllib.request import Request, urlopen


SOURCE_URL: Final = "https://wikiwiki.jp/thinkr/"
USER_AGENT: Final = "Mozilla/5.0 (compatible; KashourokuEventCollector/1.0)"
OUTPUT_PATH: Final = (
    Path(__file__).resolve().parents[2]
    / "private-data"
    / "imports"
    / "thinkr"
    / "raw"
    / "events_raw.csv"
)
CSV_FIELDS: Final = [
    "source_category",
    "year",
    "page_key",
    "event_date_raw",
    "event_title_raw",
    "source_url",
    "import_target",
]
EVENT_CATEGORIES: Final = {"箱内", "歌枠・配信", "外部"}
PAGE_KEY_PATTERN: Final = re.compile(r"^\d{4}\.\d{4}[A-Za-z]*$")
YEAR_PATTERN: Final = re.compile(r"^(?:19|20)\d{2}$")


@dataclass
class Anchor:
    href: str
    text_parts: list[str] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "".join(self.text_parts).strip()


@dataclass
class Cell:
    tag: str
    attrs: dict[str, str]
    text_parts: list[str] = field(default_factory=list)
    anchors: list[Anchor] = field(default_factory=list)

    @property
    def text(self) -> str:
        return "".join(self.text_parts).strip()


@dataclass
class Table:
    rows: list[list[Cell]] = field(default_factory=list)


class WikiTableParser(HTMLParser):
    """Capture top-level HTML tables without building a full DOM."""

    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.tables: list[Table] = []
        self._table_depth = 0
        self._table: Table | None = None
        self._row: list[Cell] | None = None
        self._cell: Cell | None = None
        self._anchor: Anchor | None = None

    def handle_starttag(
        self, tag: str, attrs_list: list[tuple[str, str | None]]
    ) -> None:
        attrs = {key: value or "" for key, value in attrs_list}

        if tag == "table":
            self._table_depth += 1
            if self._table_depth == 1:
                self._table = Table()
            return

        if self._table_depth != 1:
            return

        if tag == "tr":
            self._row = []
        elif tag in {"th", "td"} and self._row is not None:
            self._cell = Cell(tag=tag, attrs=attrs)
        elif tag == "a" and self._cell is not None:
            self._anchor = Anchor(href=attrs.get("href", ""))
        elif tag == "br" and self._cell is not None:
            self._cell.text_parts.append("\n")
            if self._anchor is not None:
                self._anchor.text_parts.append("\n")

    def handle_endtag(self, tag: str) -> None:
        if tag == "table":
            if self._table_depth == 1 and self._table is not None:
                self.tables.append(self._table)
                self._table = None
                self._row = None
                self._cell = None
                self._anchor = None
            if self._table_depth > 0:
                self._table_depth -= 1
            return

        if self._table_depth != 1:
            return

        if tag == "a" and self._cell is not None and self._anchor is not None:
            self._cell.anchors.append(self._anchor)
            self._anchor = None
        elif tag in {"th", "td"} and self._row is not None and self._cell is not None:
            self._row.append(self._cell)
            self._cell = None
        elif tag == "tr" and self._table is not None and self._row is not None:
            self._table.rows.append(self._row)
            self._row = None

    def handle_data(self, data: str) -> None:
        if self._table_depth == 1 and self._cell is not None:
            self._cell.text_parts.append(data)
            if self._anchor is not None:
                self._anchor.text_parts.append(data)


def fetch_top_page() -> str:
    request = Request(
        SOURCE_URL,
        headers={
            "User-Agent": USER_AGENT,
            "Accept": "text/html,application/xhtml+xml",
        },
    )

    with urlopen(request, timeout=30) as response:
        content_type = response.headers.get_content_type()
        if content_type != "text/html":
            raise RuntimeError(f"想定外のContent-Typeです: {content_type}")
        charset = response.headers.get_content_charset() or "utf-8"
        return response.read().decode(charset)


def page_key_from_href(href: str) -> str | None:
    absolute_url = urljoin(SOURCE_URL, href)
    path = unquote(urlparse(absolute_url).path)
    prefix = "/thinkr/"
    if not path.startswith(prefix):
        return None

    page_key = path[len(prefix) :].strip("/")
    return page_key if PAGE_KEY_PATTERN.fullmatch(page_key) else None


def page_key_from_edit_href(href: str) -> str | None:
    """Read the intended page key from WIKIWIKI's missing-page edit link."""
    absolute_url = urljoin(SOURCE_URL, href)
    parsed = urlparse(absolute_url)
    if unquote(parsed.path) != "/thinkr/::cmd/edit":
        return None

    page_keys = parse_qs(parsed.query).get("page", [])
    if len(page_keys) != 1:
        return None
    return page_keys[0] if PAGE_KEY_PATTERN.fullmatch(page_keys[0]) else None


def extract_events(
    html: str,
) -> tuple[list[dict[str, str]], list[tuple[str, str, str]]]:
    parser = WikiTableParser()
    parser.feed(html)

    events: list[dict[str, str]] = []
    skipped_rows: list[tuple[str, str, str]] = []

    for table in parser.tables:
        category: str | None = None
        year: str | None = None

        for cells in table.rows:
            if not cells:
                continue

            first = cells[0]
            if (
                first.tag == "th"
                and first.attrs.get("colspan") == "2"
                and first.text in EVENT_CATEGORIES
            ):
                category = first.text
                year = None
                continue

            if category is None:
                continue

            if first.tag == "th" and YEAR_PATTERN.fullmatch(first.text):
                year = first.text
                continue

            if year is None or first.tag != "td" or len(cells) < 2:
                continue

            page_key: str | None = None
            event_date_raw: str | None = None
            source_url: str | None = None
            for anchor in first.anchors:
                candidate = page_key_from_href(anchor.href)
                if candidate is not None:
                    page_key = candidate
                    event_date_raw = anchor.text
                    source_url = urljoin(SOURCE_URL, anchor.href)
                    break

            if page_key is None:
                for anchor in first.anchors:
                    candidate = page_key_from_edit_href(anchor.href)
                    if candidate is not None:
                        page_key = candidate
                        edit_marker = anchor.text
                        event_date_raw = first.text
                        if edit_marker and event_date_raw.endswith(edit_marker):
                            event_date_raw = event_date_raw[: -len(edit_marker)].rstrip()
                        source_url = urljoin(SOURCE_URL, candidate)
                        break

            title = cells[1].text
            if page_key is None or event_date_raw is None or source_url is None:
                if first.text or title:
                    skipped_rows.append((category, first.text, title))
                continue

            events.append(
                {
                    "source_category": category,
                    "year": year,
                    "page_key": page_key,
                    "event_date_raw": event_date_raw,
                    "event_title_raw": title,
                    "source_url": source_url,
                    "import_target": "",
                }
            )

    if not events:
        raise RuntimeError("イベント行を取得できませんでした。HTML構造が変わった可能性があります。")

    return events, skipped_rows


def write_csv(events: list[dict[str, str]]) -> None:
    OUTPUT_PATH.parent.mkdir(parents=True, exist_ok=True)
    with OUTPUT_PATH.open("w", encoding="utf-8-sig", newline="") as output_file:
        writer = csv.DictWriter(output_file, fieldnames=CSV_FIELDS)
        writer.writeheader()
        writer.writerows(events)


def print_summary(
    events: list[dict[str, str]], skipped_rows: list[tuple[str, str, str]]
) -> None:
    category_counts = Counter(event["source_category"] for event in events)
    url_counts = Counter(event["source_url"] for event in events)
    duplicates = {url: count for url, count in url_counts.items() if count > 1}

    print(f"取得件数: {len(events)}")
    print("分類別: " + ", ".join(f"{key}={value}" for key, value in category_counts.items()))
    print(f"重複URL: {len(duplicates)}種類 / {sum(duplicates.values()) - len(duplicates)}件の重複行")
    if duplicates:
        print("重複行は原文の出現を失わないようCSVに残しています。")
        for url, count in list(duplicates.items())[:10]:
            print(f"  {count}回: {url}")

    print(f"未取得候補行: {len(skipped_rows)}")
    for category, date_text, title in skipped_rows[:10]:
        print(f"  [{category}] {date_text!r} / {title!r}")
    print(f"出力先: {OUTPUT_PATH}")


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")

    try:
        html = fetch_top_page()
        events, skipped_rows = extract_events(html)
        write_csv(events)
    except (HTTPError, URLError, OSError, RuntimeError, UnicodeError) as error:
        print(f"取得に失敗しました: {error}", file=sys.stderr)
        return 1

    print_summary(events, skipped_rows)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
