"""Validate and optionally import a reviewed THINKR live ready directory.

The default mode is always a read-only dry-run. Database writes require both
--apply and an exact --confirm value matching the ready manifest pilot name.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
from collections import Counter
from dataclasses import dataclass, field
from datetime import date, datetime, timezone
from pathlib import Path
from typing import Final
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


REPOSITORY_ROOT: Final = Path(__file__).resolve().parents[2]
DEFAULT_READY_PATH: Final = (
    REPOSITORY_ROOT
    / "private-data"
    / "imports"
    / "thinkr"
    / "ready"
    / "pilot-001"
)
ENV_PATH: Final = REPOSITORY_ROOT / ".env.local"
PILOT_NAME: Final = "pilot-001"
PILOT_PAGE_KEYS: Final = ("2021.1023", "2026.0501", "2026.0502")
EXPECTED_SETLIST_COUNTS: Final = {
    "2021.1023": 21,
    "2026.0501": 23,
    "2026.0502": 21,
}
EXPECTED_PERFORMANCES: Final = {
    "2021.1023": ("Anima", "2021-10-23", None, None),
    "2026.0501": (
        "Flower Closet",
        "2026-05-01",
        "isekaijoucho-2days-live-2026",
        1,
    ),
    "2026.0502": (
        "Anima Re:birth",
        "2026-05-02",
        "isekaijoucho-2days-live-2026",
        2,
    ),
}
EXPECTED_GROUP_KEY: Final = "isekaijoucho-2days-live-2026"
EXPECTED_GROUP_TITLE: Final = "ヰ世界情緒 2DAYS LIVE"

READY_FILENAMES: Final = {
    "event_groups.csv",
    "performances.csv",
    "performance_sources.csv",
    "setlist_entries.csv",
    "manifest.md",
}
EVENT_GROUP_FIELDS: Final = [
    "local_group_key",
    "title",
    "title_kana",
    "sort_title",
    "notes",
]
PERFORMANCE_FIELDS: Final = [
    "performance_key",
    "local_group_key",
    "group_sort_order",
    "title",
    "title_kana",
    "sort_title",
    "artist_credit",
    "performance_date",
    "format_label",
    "image_url",
    "venue",
    "streaming_platforms",
    "notes",
    "published_at",
    "is_listed",
]
SOURCE_FIELDS: Final = [
    "performance_key",
    "source_type",
    "source_url",
    "source_key",
    "event_title_raw",
    "event_date_raw",
    "source_category_raw",
    "notes",
]
SETLIST_FIELDS: Final = [
    "performance_key",
    "sort_order",
    "entry_type",
    "setlist_no_raw",
    "song_id",
    "song_title_raw",
    "artist_credit_raw",
    "note_raw",
    "marker_label",
    "notes",
    "joucho_participation",
]
LINK_FIELDS: Final = [
    "performance_key",
    "link_type",
    "label",
    "url",
    "published_date",
    "notes",
    "sort_order",
]
GENERIC_READY_FILENAMES: Final = READY_FILENAMES | {"performance_links.csv"}


class RestError(RuntimeError):
    """A sanitized Data API failure that never includes credentials or URLs."""

    def __init__(self, status: int | None, code: str | None, message: str) -> None:
        self.status = status
        self.code = code
        super().__init__(
            f"Data API error: status={status or 'network'}, "
            f"code={code or 'unknown'}, message={message}"
        )


class PartialImportError(RuntimeError):
    """Raised when a failed apply cannot be proven to have been fully cleaned."""


@dataclass(frozen=True)
class ReadyData:
    pilot_name: str
    event_groups: list[dict[str, object]]
    performances: list[dict[str, object]]
    sources: list[dict[str, object]]
    setlists: list[dict[str, object]]


@dataclass(frozen=True)
class PreflightResult:
    source_candidates: int
    performance_candidates: int
    event_group_candidates: int


@dataclass(frozen=True)
class BatchReadyData:
    ready_name: str
    event_groups: list[dict[str, object]]
    performances: list[dict[str, object]]
    sources: list[dict[str, object]]
    links: list[dict[str, object]]
    setlists: list[dict[str, object]]


@dataclass
class CreatedRows:
    group_ids: dict[str, int] = field(default_factory=dict)
    performance_ids: dict[str, int] = field(default_factory=dict)


@dataclass(frozen=True)
class BatchApplyResult:
    public_performance_total: int
    public_setlist_total: int
    public_link_total: int
    published_at: str


class RestClient:
    def __init__(self, base_url: str, api_key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key

    def request(
        self,
        table: str,
        *,
        method: str = "GET",
        params: list[tuple[str, str]] | None = None,
        payload: object | None = None,
        prefer: str | None = None,
    ) -> object:
        query = ""
        if params:
            query = "?" + urlencode(params, safe="(),.*")
        request_url = f"{self._base_url}/rest/v1/{table}{query}"
        headers = {
            "apikey": self._api_key,
            "Authorization": f"Bearer {self._api_key}",
            "Accept": "application/json",
        }
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer

        request = Request(request_url, data=body, headers=headers, method=method)
        try:
            with urlopen(request, timeout=30) as response:
                response_body = response.read()
        except HTTPError as error:
            code = None
            message = "request rejected"
            try:
                decoded = json.loads(error.read().decode("utf-8"))
                if isinstance(decoded, dict):
                    code = str(decoded.get("code")) if decoded.get("code") else None
                    if decoded.get("message"):
                        message = str(decoded["message"])
            except (UnicodeDecodeError, json.JSONDecodeError):
                pass
            raise RestError(error.code, code, message) from None
        except URLError as error:
            raise RestError(None, None, "network request failed") from error

        if not response_body:
            return None
        try:
            return json.loads(response_body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise RestError(None, None, "invalid JSON response") from error

    def select(
        self, table: str, params: list[tuple[str, str]]
    ) -> list[dict[str, object]]:
        result = self.request(table, params=params)
        if not isinstance(result, list) or not all(
            isinstance(row, dict) for row in result
        ):
            raise RestError(None, None, "unexpected SELECT response")
        return result

    def insert(
        self, table: str, payload: dict[str, object] | list[dict[str, object]]
    ) -> list[dict[str, object]]:
        result = self.request(
            table,
            method="POST",
            payload=payload,
            prefer="return=representation",
        )
        if not isinstance(result, list) or not all(
            isinstance(row, dict) for row in result
        ):
            raise RestError(None, None, "unexpected INSERT response")
        return result

    def delete_ids(self, table: str, ids: list[int]) -> None:
        if not ids:
            return
        if any(not isinstance(value, int) or value <= 0 for value in ids):
            raise RuntimeError("cleanup対象に不正なIDがあります。")
        self.request(
            table,
            method="DELETE",
            params=[("id", f"in.({','.join(str(value) for value in ids)})")],
            prefer="return=minimal",
        )

    def update_ids(
        self, table: str, ids: list[int], payload: dict[str, object]
    ) -> list[dict[str, object]]:
        if not ids:
            raise RuntimeError("UPDATE対象IDが空です。")
        if any(not isinstance(value, int) or value <= 0 for value in ids):
            raise RuntimeError("UPDATE対象に不正なIDがあります。")
        result = self.request(
            table,
            method="PATCH",
            params=[("id", f"in.({','.join(str(value) for value in ids)})")],
            payload=payload,
            prefer="return=representation",
        )
        if not isinstance(result, list) or not all(
            isinstance(row, dict) for row in result
        ):
            raise RestError(None, None, "unexpected UPDATE response")
        return result


def read_csv_rows(path: Path, expected_fields: list[str]) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        if reader.fieldnames != expected_fields:
            raise RuntimeError(f"{path.name}の列構成が想定と異なります。")
        return list(reader)


def required_text(value: str, field_name: str) -> str:
    if not value.strip():
        raise RuntimeError(f"{field_name}が空です。")
    return value


def optional_text(value: str) -> str | None:
    if value == "":
        return None
    if value.strip().upper() == "NULL":
        raise RuntimeError(
            "CSVの文字列NULLは使用できません。SQL NULLには空セルを使用してください。"
        )
    return value


def optional_integer(value: str, field_name: str) -> int | None:
    if value == "":
        return None
    try:
        parsed = int(value)
    except ValueError as error:
        raise RuntimeError(f"{field_name}がintegerではありません。") from error
    return parsed


def required_integer(value: str, field_name: str) -> int:
    parsed = optional_integer(value, field_name)
    if parsed is None:
        raise RuntimeError(f"{field_name}が空です。")
    return parsed


def optional_boolean(value: str, field_name: str) -> bool | None:
    if value == "":
        return None
    lowered = value.lower()
    if lowered == "true":
        return True
    if lowered == "false":
        return False
    raise RuntimeError(f"{field_name}はtrue/false/空欄のいずれかである必要があります。")


def required_boolean(value: str, field_name: str) -> bool:
    parsed = optional_boolean(value, field_name)
    if parsed is None:
        raise RuntimeError(f"{field_name}が空です。")
    return parsed


def text_array(value: str, field_name: str) -> list[str]:
    if value == "":
        raise RuntimeError(f"{field_name}はNULLではなく配列である必要があります。")
    try:
        parsed = json.loads(value)
    except json.JSONDecodeError as error:
        raise RuntimeError(f"{field_name}がJSON配列ではありません。") from error
    if not isinstance(parsed, list) or any(not isinstance(item, str) for item in parsed):
        raise RuntimeError(f"{field_name}は文字列配列である必要があります。")
    return parsed


def read_manifest(path: Path, ready_name: str) -> str:
    manifest = path.read_text(encoding="utf-8")
    first_line = next((line.strip() for line in manifest.splitlines() if line.strip()), "")
    if first_line != f"# {PILOT_NAME}" or ready_name != PILOT_NAME:
        raise RuntimeError("manifestまたはreadyディレクトリ名がpilot-001ではありません。")
    required_lines = {
        "- Event groups: 1",
        "- Performance rows: 3",
        "- Source rows: 3",
        "- Setlist entries: 65",
        "- Linked song_id values: 0",
        "- Markers: 0",
        "- Published performances: 0",
        "- Listed performances: 0",
    }
    manifest_lines = {line.strip() for line in manifest.splitlines()}
    missing = sorted(required_lines - manifest_lines)
    if missing:
        raise RuntimeError(f"manifestの必須集計が不足しています: {missing}")
    return PILOT_NAME


def load_ready(ready_path: Path) -> ReadyData:
    if not ready_path.is_dir():
        raise RuntimeError(f"readyディレクトリがありません: {ready_path}")
    actual_names = {path.name for path in ready_path.iterdir() if path.is_file()}
    if actual_names != READY_FILENAMES:
        raise RuntimeError(
            f"readyファイル構成が想定と異なります: {sorted(actual_names)}"
        )
    pilot_name = read_manifest(ready_path / "manifest.md", ready_path.name)

    raw_groups = read_csv_rows(ready_path / "event_groups.csv", EVENT_GROUP_FIELDS)
    raw_performances = read_csv_rows(
        ready_path / "performances.csv", PERFORMANCE_FIELDS
    )
    raw_sources = read_csv_rows(
        ready_path / "performance_sources.csv", SOURCE_FIELDS
    )
    raw_setlists = read_csv_rows(
        ready_path / "setlist_entries.csv", SETLIST_FIELDS
    )

    groups: list[dict[str, object]] = []
    for row in raw_groups:
        groups.append(
            {
                "local_group_key": required_text(
                    row["local_group_key"], "local_group_key"
                ),
                "title": required_text(row["title"], "event group title"),
                "title_kana": optional_text(row["title_kana"]),
                "sort_title": optional_text(row["sort_title"]),
                "notes": optional_text(row["notes"]),
            }
        )

    performances: list[dict[str, object]] = []
    for row in raw_performances:
        performance_date = required_text(
            row["performance_date"], "performance_date"
        )
        try:
            if date.fromisoformat(performance_date).isoformat() != performance_date:
                raise ValueError
        except ValueError as error:
            raise RuntimeError("performance_dateがISO dateではありません。") from error
        performances.append(
            {
                "performance_key": required_text(
                    row["performance_key"], "performance_key"
                ),
                "local_group_key": optional_text(row["local_group_key"]),
                "group_sort_order": optional_integer(
                    row["group_sort_order"], "group_sort_order"
                ),
                "title": required_text(row["title"], "performance title"),
                "title_kana": optional_text(row["title_kana"]),
                "sort_title": optional_text(row["sort_title"]),
                "artist_credit": optional_text(row["artist_credit"]),
                "performance_date": performance_date,
                "format_label": optional_text(row["format_label"]),
                "image_url": optional_text(row["image_url"]),
                "venue": optional_text(row["venue"]),
                "streaming_platforms": text_array(
                    row["streaming_platforms"], "streaming_platforms"
                ),
                "notes": optional_text(row["notes"]),
                "published_at": optional_text(row["published_at"]),
                "is_listed": required_boolean(row["is_listed"], "is_listed"),
            }
        )

    sources: list[dict[str, object]] = []
    for row in raw_sources:
        sources.append(
            {
                "performance_key": required_text(
                    row["performance_key"], "source performance_key"
                ),
                "source_type": optional_text(row["source_type"]),
                "source_url": required_text(row["source_url"], "source_url"),
                "source_key": optional_text(row["source_key"]),
                "event_title_raw": optional_text(row["event_title_raw"]),
                "event_date_raw": optional_text(row["event_date_raw"]),
                "source_category_raw": optional_text(row["source_category_raw"]),
                "notes": optional_text(row["notes"]),
            }
        )

    setlists: list[dict[str, object]] = []
    for row in raw_setlists:
        setlists.append(
            {
                "performance_key": required_text(
                    row["performance_key"], "setlist performance_key"
                ),
                "sort_order": required_integer(row["sort_order"], "sort_order"),
                "entry_type": required_text(row["entry_type"], "entry_type"),
                "setlist_no_raw": optional_text(row["setlist_no_raw"]),
                "song_id": optional_integer(row["song_id"], "song_id"),
                "song_title_raw": optional_text(row["song_title_raw"]),
                "artist_credit_raw": optional_text(row["artist_credit_raw"]),
                "note_raw": optional_text(row["note_raw"]),
                "marker_label": optional_text(row["marker_label"]),
                "notes": optional_text(row["notes"]),
                "joucho_participation": optional_boolean(
                    row["joucho_participation"], "joucho_participation"
                ),
            }
        )

    ready = ReadyData(pilot_name, groups, performances, sources, setlists)
    validate_ready(ready)
    return ready


def validate_ready(ready: ReadyData) -> None:
    if len(ready.event_groups) != 1:
        raise RuntimeError("event groupは1件である必要があります。")
    group = ready.event_groups[0]
    if (
        group["local_group_key"] != EXPECTED_GROUP_KEY
        or group["title"] != EXPECTED_GROUP_TITLE
    ):
        raise RuntimeError("2DAYS event groupが想定と異なります。")

    if len(ready.performances) != 3:
        raise RuntimeError("performancesは3件である必要があります。")
    performance_keys = [str(row["performance_key"]) for row in ready.performances]
    if tuple(performance_keys) != PILOT_PAGE_KEYS or len(set(performance_keys)) != 3:
        raise RuntimeError("performance_keyの対象・順序・unique性が想定外です。")
    for row in ready.performances:
        key = str(row["performance_key"])
        title, event_date, group_key, group_order = EXPECTED_PERFORMANCES[key]
        if (
            row["title"] != title
            or row["performance_date"] != event_date
            or row["local_group_key"] != group_key
            or row["group_sort_order"] != group_order
        ):
            raise RuntimeError(f"{key}の主要値またはgroup relationが想定外です。")
        if row["streaming_platforms"] != []:
            raise RuntimeError(f"{key}のstreaming_platformsが空配列ではありません。")
        if row["published_at"] is not None or row["is_listed"] is not False:
            raise RuntimeError(f"{key}の公開状態が想定外です。")

    performance_key_set = set(performance_keys)
    if len(ready.sources) != 3:
        raise RuntimeError("sourcesは3件である必要があります。")
    source_counts = Counter(str(row["performance_key"]) for row in ready.sources)
    if source_counts != Counter(PILOT_PAGE_KEYS):
        raise RuntimeError("各performanceにはsourceが1件必要です。")
    for row in ready.sources:
        key = str(row["performance_key"])
        if key not in performance_key_set:
            raise RuntimeError("sourceが未知のperformanceを参照しています。")
        if row["source_type"] != "thinkr_wiki" or row["source_key"] != key:
            raise RuntimeError(f"{key}のsource type/keyが想定外です。")

    if len(ready.setlists) != 65:
        raise RuntimeError("setlist entriesは65件である必要があります。")
    setlist_counts = Counter(str(row["performance_key"]) for row in ready.setlists)
    if setlist_counts != Counter(EXPECTED_SETLIST_COUNTS):
        raise RuntimeError(f"setlist件数が想定外です: {dict(setlist_counts)}")
    for key in PILOT_PAGE_KEYS:
        rows = [row for row in ready.setlists if row["performance_key"] == key]
        sort_orders = [int(row["sort_order"]) for row in rows]
        expected_orders = [index * 100 for index in range(1, len(rows) + 1)]
        if sort_orders != expected_orders or len(set(sort_orders)) != len(sort_orders):
            raise RuntimeError(f"{key}のsort_orderが想定外です。")
    for row in ready.setlists:
        if row["entry_type"] != "song":
            raise RuntimeError("pilotにはsong entryだけを投入します。")
        if not str(row["setlist_no_raw"] or "").strip():
            raise RuntimeError("setlist_no_rawが空です。")
        if not str(row["song_title_raw"] or "").strip():
            raise RuntimeError("song_title_rawが空です。")
        if not str(row["artist_credit_raw"] or "").strip():
            raise RuntimeError("artist_credit_rawが空です。")
        if row["song_id"] is not None:
            raise RuntimeError("pilotのsong_idは全件NULLである必要があります。")
        if row["joucho_participation"] is not None:
            raise RuntimeError(
                "pilotのjoucho_participationは全件NULLである必要があります。"
            )
        if row["marker_label"] is not None:
            raise RuntimeError("pilotにはmarkerを含めません。")


def read_batch_manifest(path: Path, ready_name: str) -> str:
    manifest = path.read_text(encoding="utf-8")
    lines = [line.strip() for line in manifest.splitlines() if line.strip()]
    if not lines or lines[0] != f"# {ready_name}":
        raise RuntimeError("manifest名とreadyディレクトリ名が一致しません。")
    return manifest


def load_batch_ready(ready_path: Path) -> BatchReadyData:
    if not ready_path.is_dir():
        raise RuntimeError(f"readyディレクトリがありません: {ready_path}")
    actual_names = {path.name for path in ready_path.iterdir() if path.is_file()}
    if actual_names != GENERIC_READY_FILENAMES:
        raise RuntimeError(
            f"batch readyファイル構成が想定と異なります: {sorted(actual_names)}"
        )
    manifest = read_batch_manifest(ready_path / "manifest.md", ready_path.name)

    raw_groups = read_csv_rows(ready_path / "event_groups.csv", EVENT_GROUP_FIELDS)
    raw_performances = read_csv_rows(
        ready_path / "performances.csv", PERFORMANCE_FIELDS
    )
    raw_sources = read_csv_rows(
        ready_path / "performance_sources.csv", SOURCE_FIELDS
    )
    raw_links = read_csv_rows(
        ready_path / "performance_links.csv", LINK_FIELDS
    )
    raw_setlists = read_csv_rows(
        ready_path / "setlist_entries.csv", SETLIST_FIELDS
    )

    groups = [
        {
            "local_group_key": required_text(row["local_group_key"], "local_group_key"),
            "title": required_text(row["title"], "event group title"),
            "title_kana": optional_text(row["title_kana"]),
            "sort_title": optional_text(row["sort_title"]),
            "notes": optional_text(row["notes"]),
        }
        for row in raw_groups
    ]

    performances: list[dict[str, object]] = []
    for row in raw_performances:
        performance_date = required_text(row["performance_date"], "performance_date")
        try:
            if date.fromisoformat(performance_date).isoformat() != performance_date:
                raise ValueError
        except ValueError as error:
            raise RuntimeError("performance_dateがISO dateではありません。") from error
        performances.append(
            {
                "performance_key": required_text(row["performance_key"], "performance_key"),
                "local_group_key": optional_text(row["local_group_key"]),
                "group_sort_order": optional_integer(row["group_sort_order"], "group_sort_order"),
                "title": required_text(row["title"], "performance title"),
                "title_kana": optional_text(row["title_kana"]),
                "sort_title": optional_text(row["sort_title"]),
                "artist_credit": optional_text(row["artist_credit"]),
                "performance_date": performance_date,
                "format_label": optional_text(row["format_label"]),
                "image_url": optional_text(row["image_url"]),
                "venue": optional_text(row["venue"]),
                "streaming_platforms": text_array(
                    row["streaming_platforms"], "streaming_platforms"
                ),
                "notes": optional_text(row["notes"]),
                "published_at": optional_text(row["published_at"]),
                "is_listed": required_boolean(row["is_listed"], "is_listed"),
            }
        )

    sources = [
        {
            "performance_key": required_text(row["performance_key"], "source performance_key"),
            "source_type": required_text(row["source_type"], "source_type"),
            "source_url": required_text(row["source_url"], "source_url"),
            "source_key": required_text(row["source_key"], "source_key"),
            "event_title_raw": optional_text(row["event_title_raw"]),
            "event_date_raw": optional_text(row["event_date_raw"]),
            "source_category_raw": optional_text(row["source_category_raw"]),
            "notes": optional_text(row["notes"]),
        }
        for row in raw_sources
    ]
    links = [
        {
            "performance_key": required_text(row["performance_key"], "link performance_key"),
            "link_type": required_text(row["link_type"], "link_type"),
            "label": optional_text(row["label"]),
            "url": required_text(row["url"], "link url"),
            "published_date": optional_text(row["published_date"]),
            "notes": optional_text(row["notes"]),
            "sort_order": required_integer(row["sort_order"], "link sort_order"),
        }
        for row in raw_links
    ]

    setlists = [
        {
            "performance_key": required_text(row["performance_key"], "setlist performance_key"),
            "sort_order": required_integer(row["sort_order"], "sort_order"),
            "entry_type": required_text(row["entry_type"], "entry_type"),
            "setlist_no_raw": optional_text(row["setlist_no_raw"]),
            "song_id": optional_integer(row["song_id"], "song_id"),
            "song_title_raw": optional_text(row["song_title_raw"]),
            "artist_credit_raw": optional_text(row["artist_credit_raw"]),
            "note_raw": optional_text(row["note_raw"]),
            "marker_label": optional_text(row["marker_label"]),
            "notes": optional_text(row["notes"]),
            "joucho_participation": optional_boolean(
                row["joucho_participation"], "joucho_participation"
            ),
        }
        for row in raw_setlists
    ]
    ready = BatchReadyData(
        ready_path.name, groups, performances, sources, links, setlists
    )
    validate_batch_ready(ready, manifest)
    return ready


def validate_batch_ready(ready: BatchReadyData, manifest: str) -> None:
    if len(ready.performances) != 26:
        raise RuntimeError("batch performancesは26件である必要があります。")
    keys = [str(row["performance_key"]) for row in ready.performances]
    key_set = set(keys)
    if len(key_set) != len(keys):
        raise RuntimeError("batch performance_keyがuniqueではありません。")
    if key_set & set(PILOT_PAGE_KEYS):
        raise RuntimeError("batchにpilot済みperformance_keyが混入しています。")
    if ready.event_groups:
        raise RuntimeError("このbatchでは新規event groupを作成しません。")
    for row in ready.performances:
        if row["local_group_key"] is not None or row["group_sort_order"] is not None:
            raise RuntimeError("このbatchにparent relationが混入しています。")
        if row["streaming_platforms"] != []:
            raise RuntimeError("streaming_platformsが空配列ではありません。")
        if row["published_at"] is not None or row["is_listed"] is not False:
            raise RuntimeError("batchの公開初期状態が想定外です。")

    source_counts = Counter(str(row["performance_key"]) for row in ready.sources)
    if source_counts != Counter(keys):
        raise RuntimeError("各batch performanceにsourceが1件必要です。")
    for row in ready.sources:
        key = str(row["performance_key"])
        if row["source_type"] != "thinkr_wiki" or row["source_key"] != key:
            raise RuntimeError(f"{key}: source type/keyが想定外です。")

    for row in ready.links:
        if row["performance_key"] not in key_set:
            raise RuntimeError("linkが未知のperformanceを参照しています。")
        if row["sort_order"] is None or int(row["sort_order"]) <= 0:
            raise RuntimeError("link sort_orderが正の整数ではありません。")

    if len(ready.setlists) != 434:
        raise RuntimeError("batch setlist entriesは434件である必要があります。")
    setlist_counts = Counter(str(row["performance_key"]) for row in ready.setlists)
    if set(setlist_counts) != key_set or any(count <= 0 for count in setlist_counts.values()):
        raise RuntimeError("setlistのperformance参照または件数が不正です。")
    for key in keys:
        rows = [row for row in ready.setlists if row["performance_key"] == key]
        orders = [int(row["sort_order"]) for row in rows]
        expected = list(range(100, len(rows) * 100 + 1, 100))
        if orders != expected or len(set(orders)) != len(orders):
            raise RuntimeError(f"{key}: setlist sort_orderがraw行順ではありません。")
    for row in ready.setlists:
        if row["entry_type"] != "song" or row["marker_label"] is not None:
            raise RuntimeError("このbatchにはsong entryだけを許可します。")
        if row["song_title_raw"] is None:
            raise RuntimeError("song_title_rawがNULLのsong entryがあります。")

    required_manifest_lines = {
        "- Event groups: 0",
        "- Performance rows: 26",
        "- Source rows: 26",
        f"- Performance link rows: {len(ready.links)}",
        "- Setlist entries: 434",
        "- Markers: 0",
        "- Published performances: 0",
        "- Listed performances: 0",
    }
    manifest_lines = {line.strip() for line in manifest.splitlines()}
    missing = required_manifest_lines - manifest_lines
    if missing:
        raise RuntimeError(f"batch manifest集計がCSVと一致しません: {sorted(missing)}")


def preflight_batch_database(
    client: RestClient, ready: BatchReadyData
) -> PreflightResult:
    source_keys = [str(row["source_key"]) for row in ready.sources]
    source_candidates = client.select(
        "live_performance_sources",
        [
            ("select", "id,source_key"),
            ("source_type", "eq.thinkr_wiki"),
            ("source_key", f"in.({','.join(source_keys)})"),
        ],
    )

    dates = sorted({str(row["performance_date"]) for row in ready.performances})
    possible_performances = client.select(
        "live_performances",
        [
            ("select", "id,title,performance_date"),
            ("performance_date", f"in.({','.join(dates)})"),
        ],
    )
    expected_pairs = {
        (str(row["title"]), str(row["performance_date"]))
        for row in ready.performances
    }
    performance_candidates = [
        row
        for row in possible_performances
        if (str(row.get("title")), str(row.get("performance_date")))
        in expected_pairs
    ]

    group_candidates: list[dict[str, object]] = []
    for group in ready.event_groups:
        group_candidates.extend(
            client.select(
                "live_event_groups",
                [("select", "id"), ("title", f"eq.{group['title']}")],
            )
        )
    result = PreflightResult(
        len(source_candidates), len(performance_candidates), len(group_candidates)
    )
    conflicts: list[str] = []
    if result.source_candidates:
        conflicts.append(f"sources={result.source_candidates}")
    if result.performance_candidates:
        conflicts.append(f"performances={result.performance_candidates}")
    if result.event_group_candidates:
        conflicts.append(f"event_groups={result.event_group_candidates}")
    if conflicts:
        raise RuntimeError(
            "DBに今回batchの重複候補があるため自動mergeせず停止します: "
            + ", ".join(conflicts)
        )
    return result


def print_batch_plan(ready: BatchReadyData, preflight: PreflightResult) -> None:
    counts = Counter(str(row["performance_key"]) for row in ready.setlists)
    print("mode: DRY-RUN (database writes: 0)")
    print(f"ready: {ready.ready_name}")
    print("ready validation: PASS")
    print(
        "DB preflight: PASS "
        f"(sources={preflight.source_candidates}, "
        f"performances={preflight.performance_candidates}, "
        f"event_groups={preflight.event_group_candidates})"
    )
    print(f"STEP 1 live_event_groups: {len(ready.event_groups)}")
    print(f"STEP 2 live_performances: {len(ready.performances)}")
    print("  - all: published_at=NULL, is_listed=false")
    print(f"STEP 3 live_performance_sources: {len(ready.sources)}")
    print(f"STEP 4 live_performance_links: {len(ready.links)}")
    print(f"STEP 5 live_setlist_entries: {len(ready.setlists)}")
    print("setlist counts:")
    for row in ready.performances:
        key = str(row["performance_key"])
        print(f"  - {key} {row['title']}: {counts[key]}")


def load_local_environment() -> None:
    if not ENV_PATH.exists():
        return
    for raw_line in ENV_PATH.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        key = key.strip()
        value = value.strip()
        if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
            value = value[1:-1]
        os.environ.setdefault(key, value)


def required_environment(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"必要な環境変数がありません: {name}")
    return value


def create_service_client() -> RestClient:
    load_local_environment()
    return RestClient(
        required_environment("NEXT_PUBLIC_SUPABASE_URL"),
        required_environment("SUPABASE_SERVICE_ROLE_KEY"),
    )


def create_anon_client() -> RestClient:
    load_local_environment()
    return RestClient(
        required_environment("NEXT_PUBLIC_SUPABASE_URL"),
        required_environment("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
    )


def preflight_database(client: RestClient, ready: ReadyData) -> PreflightResult:
    source_keys = [str(row["source_key"]) for row in ready.sources]
    source_candidates = client.select(
        "live_performance_sources",
        [
            ("select", "id"),
            ("source_type", "eq.thinkr_wiki"),
            ("source_key", f"in.({','.join(source_keys)})"),
        ],
    )

    performance_candidates: list[dict[str, object]] = []
    for row in ready.performances:
        performance_candidates.extend(
            client.select(
                "live_performances",
                [
                    ("select", "id"),
                    ("title", f"eq.{row['title']}"),
                    ("performance_date", f"eq.{row['performance_date']}"),
                ],
            )
        )

    group_candidates = client.select(
        "live_event_groups",
        [("select", "id"), ("title", f"eq.{EXPECTED_GROUP_TITLE}")],
    )
    result = PreflightResult(
        len(source_candidates), len(performance_candidates), len(group_candidates)
    )
    conflicts: list[str] = []
    if result.source_candidates:
        conflicts.append(f"sources={result.source_candidates}")
    if result.performance_candidates:
        conflicts.append(f"performances={result.performance_candidates}")
    if result.event_group_candidates:
        conflicts.append(f"event_groups={result.event_group_candidates}")
    if conflicts:
        raise RuntimeError(
            "DBにpilot重複候補があるため自動mergeせず停止します: "
            + ", ".join(conflicts)
        )
    return result


def returned_id(rows: list[dict[str, object]], table: str) -> int:
    if len(rows) != 1 or not isinstance(rows[0].get("id"), int):
        raise RuntimeError(f"{table} INSERTからgenerated idを取得できませんでした。")
    value = rows[0]["id"]
    assert isinstance(value, int)
    return value


def cleanup_created(client: RestClient, created: CreatedRows) -> None:
    # Only IDs returned by this apply attempt are ever eligible for deletion.
    if created.performance_ids:
        client.delete_ids(
            "live_performances", list(created.performance_ids.values())
        )
        created.performance_ids.clear()
    if created.group_ids:
        client.delete_ids("live_event_groups", list(created.group_ids.values()))
        created.group_ids.clear()


def apply_ready(client: RestClient, ready: ReadyData) -> CreatedRows:
    created = CreatedRows()
    write_started = False
    try:
        for row in ready.event_groups:
            write_started = True
            inserted = client.insert(
                "live_event_groups",
                {
                    "title": row["title"],
                    "title_kana": row["title_kana"],
                    "sort_title": row["sort_title"],
                    "notes": row["notes"],
                },
            )
            created.group_ids[str(row["local_group_key"])] = returned_id(
                inserted, "live_event_groups"
            )

        for row in ready.performances:
            group_key = row["local_group_key"]
            group_id = None if group_key is None else created.group_ids[str(group_key)]
            write_started = True
            inserted = client.insert(
                "live_performances",
                {
                    "live_event_group_id": group_id,
                    "group_sort_order": row["group_sort_order"],
                    "title": row["title"],
                    "title_kana": row["title_kana"],
                    "sort_title": row["sort_title"],
                    "artist_credit": row["artist_credit"],
                    "performance_date": row["performance_date"],
                    "format_label": row["format_label"],
                    "image_url": row["image_url"],
                    "venue": row["venue"],
                    "streaming_platforms": row["streaming_platforms"],
                    "notes": row["notes"],
                    "published_at": row["published_at"],
                    "is_listed": row["is_listed"],
                },
            )
            created.performance_ids[str(row["performance_key"])] = returned_id(
                inserted, "live_performances"
            )

        source_payload = [
            {
                "live_performance_id": created.performance_ids[
                    str(row["performance_key"])
                ],
                "source_type": row["source_type"],
                "source_url": row["source_url"],
                "source_key": row["source_key"],
                "event_title_raw": row["event_title_raw"],
                "event_date_raw": row["event_date_raw"],
                "source_category_raw": row["source_category_raw"],
                "notes": row["notes"],
            }
            for row in ready.sources
        ]
        write_started = True
        inserted_sources = client.insert("live_performance_sources", source_payload)
        if len(inserted_sources) != 3:
            raise RuntimeError("source INSERT件数が3件ではありません。")

        setlist_payload = [
            {
                "live_performance_id": created.performance_ids[
                    str(row["performance_key"])
                ],
                "sort_order": row["sort_order"],
                "entry_type": row["entry_type"],
                "setlist_no_raw": row["setlist_no_raw"],
                "song_id": row["song_id"],
                "song_title_raw": row["song_title_raw"],
                "artist_credit_raw": row["artist_credit_raw"],
                "note_raw": row["note_raw"],
                "marker_label": row["marker_label"],
                "notes": row["notes"],
                "joucho_participation": row["joucho_participation"],
            }
            for row in ready.setlists
        ]
        write_started = True
        inserted_setlists = client.insert("live_setlist_entries", setlist_payload)
        if len(inserted_setlists) != 65:
            raise RuntimeError("setlist INSERT件数が65件ではありません。")

        validate_applied(client, create_anon_client(), ready, created)
        return created
    except Exception as error:
        if not write_started:
            raise
        try:
            cleanup_created(client, created)
        except Exception as cleanup_error:
            raise PartialImportError(
                "apply失敗後のcleanupにも失敗しました。部分投入の可能性があります。"
            ) from cleanup_error
        raise PartialImportError(
            "applyは失敗し、追跡できた作成IDをcleanupしました。"
            "応答を受け取れなかったINSERTがある場合は部分投入の可能性があります。"
        ) from error


def ids_filter(ids: list[int]) -> str:
    return f"in.({','.join(str(value) for value in ids)})"


def validate_applied(
    service: RestClient, anon: RestClient, ready: ReadyData, created: CreatedRows
) -> None:
    group_ids = list(created.group_ids.values())
    performance_ids = list(created.performance_ids.values())
    reverse_performance_ids = {
        value: key for key, value in created.performance_ids.items()
    }
    groups = service.select(
        "live_event_groups",
        [("select", "id,title"), ("id", ids_filter(group_ids))],
    )
    if len(groups) != 1 or groups[0].get("title") != EXPECTED_GROUP_TITLE:
        raise RuntimeError("apply後のevent group検証に失敗しました。")

    performances = service.select(
        "live_performances",
        [
            (
                "select",
                "id,live_event_group_id,group_sort_order,title,artist_credit,"
                "performance_date,published_at,is_listed,streaming_platforms",
            ),
            ("id", ids_filter(performance_ids)),
        ],
    )
    if len(performances) != 3:
        raise RuntimeError("apply後のperformances件数が3件ではありません。")
    ready_by_key = {
        str(row["performance_key"]): row for row in ready.performances
    }
    for row in performances:
        row_id = row.get("id")
        if not isinstance(row_id, int) or row_id not in reverse_performance_ids:
            raise RuntimeError("apply後に未知のperformance IDがあります。")
        key = reverse_performance_ids[row_id]
        expected = ready_by_key[key]
        expected_group_id = (
            None
            if expected["local_group_key"] is None
            else created.group_ids[str(expected["local_group_key"])]
        )
        if (
            row.get("live_event_group_id") != expected_group_id
            or row.get("group_sort_order") != expected["group_sort_order"]
            or row.get("title") != expected["title"]
            or row.get("artist_credit") != expected["artist_credit"]
            or row.get("performance_date") != expected["performance_date"]
            or row.get("published_at") is not None
            or row.get("is_listed") is not False
            or row.get("streaming_platforms") != []
        ):
            raise RuntimeError(f"apply後のperformance値が一致しません: {key}")

    sources = service.select(
        "live_performance_sources",
        [
            (
                "select",
                "live_performance_id,source_type,source_url,source_key,"
                "event_title_raw,event_date_raw,source_category_raw,notes",
            ),
            ("live_performance_id", ids_filter(performance_ids)),
        ],
    )
    if len(sources) != 3:
        raise RuntimeError("apply後のsources件数が3件ではありません。")
    ready_sources = {str(row["performance_key"]): row for row in ready.sources}
    for row in sources:
        performance_id = row.get("live_performance_id")
        if not isinstance(performance_id, int) or performance_id not in reverse_performance_ids:
            raise RuntimeError("apply後sourceのperformance IDが不正です。")
        key = reverse_performance_ids[performance_id]
        expected = ready_sources[key]
        for field_name in (
            "source_type",
            "source_url",
            "source_key",
            "event_title_raw",
            "event_date_raw",
            "source_category_raw",
            "notes",
        ):
            if row.get(field_name) != expected[field_name]:
                raise RuntimeError(f"apply後sourceのraw値が一致しません: {key}")

    setlists = service.select(
        "live_setlist_entries",
        [
            (
                "select",
                "live_performance_id,sort_order,entry_type,setlist_no_raw,song_id,"
                "song_title_raw,artist_credit_raw,note_raw,marker_label,notes,"
                "joucho_participation",
            ),
            ("live_performance_id", ids_filter(performance_ids)),
            ("order", "live_performance_id.asc,sort_order.asc"),
        ],
    )
    if len(setlists) != 65:
        raise RuntimeError("apply後のsetlist件数が65件ではありません。")
    ready_setlists: dict[str, list[dict[str, object]]] = {
        key: [] for key in PILOT_PAGE_KEYS
    }
    for row in ready.setlists:
        ready_setlists[str(row["performance_key"])].append(row)
    returned_setlists: dict[str, list[dict[str, object]]] = {
        key: [] for key in PILOT_PAGE_KEYS
    }
    for row in setlists:
        performance_id = row.get("live_performance_id")
        if not isinstance(performance_id, int) or performance_id not in reverse_performance_ids:
            raise RuntimeError("apply後setlistのperformance IDが不正です。")
        returned_setlists[reverse_performance_ids[performance_id]].append(row)
    compare_fields = (
        "sort_order",
        "entry_type",
        "setlist_no_raw",
        "song_id",
        "song_title_raw",
        "artist_credit_raw",
        "note_raw",
        "marker_label",
        "notes",
        "joucho_participation",
    )
    for key in PILOT_PAGE_KEYS:
        expected_rows = ready_setlists[key]
        actual_rows = sorted(returned_setlists[key], key=lambda row: int(row["sort_order"]))
        if len(expected_rows) != len(actual_rows):
            raise RuntimeError(f"apply後setlist件数が一致しません: {key}")
        for expected, actual in zip(expected_rows, actual_rows, strict=True):
            if any(actual.get(field) != expected[field] for field in compare_fields):
                raise RuntimeError(f"apply後setlistのraw値が一致しません: {key}")

    if anon.select(
        "live_performances",
        [("select", "id"), ("id", ids_filter(performance_ids))],
    ):
        raise RuntimeError("未公開performanceがanonから取得できてしまいます。")
    if anon.select(
        "live_setlist_entries",
        [
            ("select", "id"),
            ("live_performance_id", ids_filter(performance_ids)),
        ],
    ):
        raise RuntimeError("未公開setlistがanonから取得できてしまいます。")
    if anon.select(
        "live_event_groups",
        [("select", "id"), ("id", ids_filter(group_ids))],
    ):
        raise RuntimeError("未公開event groupがanonから取得できてしまいます。")
    try:
        anon.select(
            "live_performance_sources",
            [
                ("select", "id"),
                ("live_performance_id", ids_filter(performance_ids)),
                ("limit", "0"),
            ],
        )
    except RestError as error:
        if error.status not in {401, 403} or error.code != "42501":
            raise RuntimeError("sourcesのanon拒否応答が想定と異なります。") from error
    else:
        raise RuntimeError("sourcesがanonからSELECT可能になっています。")


def snapshot_pilot_performances(
    service: RestClient,
) -> list[dict[str, object]]:
    source_rows = service.select(
        "live_performance_sources",
        [
            ("select", "source_key,live_performance_id"),
            ("source_type", "eq.thinkr_wiki"),
            ("source_key", f"in.({','.join(PILOT_PAGE_KEYS)})"),
        ],
    )
    if len(source_rows) != len(PILOT_PAGE_KEYS):
        raise RuntimeError("既存pilot 3件のsource relationを確認できません。")
    ids = [row.get("live_performance_id") for row in source_rows]
    if any(not isinstance(value, int) for value in ids):
        raise RuntimeError("既存pilotのperformance IDが不正です。")
    pilot_ids = [int(value) for value in ids]
    rows = service.select(
        "live_performances",
        [
            (
                "select",
                "id,live_event_group_id,group_sort_order,title,title_kana,sort_title,"
                "artist_credit,performance_date,format_label,image_url,venue,"
                "streaming_platforms,notes,published_at,is_listed",
            ),
            ("id", ids_filter(pilot_ids)),
        ],
    )
    if len(rows) != len(PILOT_PAGE_KEYS):
        raise RuntimeError("既存pilot performancesを3件取得できません。")
    return sorted(rows, key=lambda row: int(row["id"]))


def batch_ready_by_key(ready: BatchReadyData) -> dict[str, dict[str, object]]:
    return {str(row["performance_key"]): row for row in ready.performances}


def validate_batch_service_rows(
    service: RestClient,
    ready: BatchReadyData,
    created: CreatedRows,
    *,
    published: bool,
) -> None:
    performance_ids = list(created.performance_ids.values())
    if len(performance_ids) != len(ready.performances):
        raise RuntimeError("追跡中のgenerated performance ID件数が一致しません。")
    reverse_ids = {value: key for key, value in created.performance_ids.items()}
    expected_performances = batch_ready_by_key(ready)

    performances = service.select(
        "live_performances",
        [
            (
                "select",
                "id,live_event_group_id,group_sort_order,title,title_kana,sort_title,"
                "artist_credit,performance_date,format_label,image_url,venue,"
                "streaming_platforms,notes,published_at,is_listed",
            ),
            ("id", ids_filter(performance_ids)),
        ],
    )
    if len(performances) != len(ready.performances):
        raise RuntimeError("service read-backのperformance件数が一致しません。")
    compare_fields = (
        "title",
        "title_kana",
        "sort_title",
        "artist_credit",
        "performance_date",
        "format_label",
        "image_url",
        "venue",
        "streaming_platforms",
        "notes",
    )
    for actual in performances:
        actual_id = actual.get("id")
        if not isinstance(actual_id, int) or actual_id not in reverse_ids:
            raise RuntimeError("service read-backに未知のperformance IDがあります。")
        key = reverse_ids[actual_id]
        expected = expected_performances[key]
        if actual.get("live_event_group_id") is not None:
            raise RuntimeError(f"{key}: 想定外のevent group relationがあります。")
        if actual.get("group_sort_order") is not None:
            raise RuntimeError(f"{key}: 想定外のgroup_sort_orderがあります。")
        if any(actual.get(field) != expected[field] for field in compare_fields):
            raise RuntimeError(f"{key}: performance ready値が一致しません。")
        if published:
            if actual.get("published_at") is None or actual.get("is_listed") is not True:
                raise RuntimeError(f"{key}: 公開状態が反映されていません。")
        elif actual.get("published_at") is not None or actual.get("is_listed") is not False:
            raise RuntimeError(f"{key}: 投入直後の非公開状態が不正です。")

    sources = service.select(
        "live_performance_sources",
        [
            (
                "select",
                "live_performance_id,source_type,source_url,source_key,event_title_raw,"
                "event_date_raw,source_category_raw,notes",
            ),
            ("live_performance_id", ids_filter(performance_ids)),
        ],
    )
    if len(sources) != len(ready.sources):
        raise RuntimeError("service read-backのsource件数が一致しません。")
    expected_sources = {str(row["performance_key"]): row for row in ready.sources}
    for actual in sources:
        performance_id = actual.get("live_performance_id")
        if not isinstance(performance_id, int) or performance_id not in reverse_ids:
            raise RuntimeError("sourceに未知のperformance IDがあります。")
        key = reverse_ids[performance_id]
        expected = expected_sources[key]
        for field in (
            "source_type",
            "source_url",
            "source_key",
            "event_title_raw",
            "event_date_raw",
            "source_category_raw",
            "notes",
        ):
            if actual.get(field) != expected[field]:
                raise RuntimeError(f"{key}: source ready値が一致しません。")

    links = service.select(
        "live_performance_links",
        [
            (
                "select",
                "live_performance_id,link_type,label,url,published_date,notes,sort_order",
            ),
            ("live_performance_id", ids_filter(performance_ids)),
            ("order", "live_performance_id.asc,sort_order.asc,id.asc"),
        ],
    )
    if len(links) != len(ready.links):
        raise RuntimeError("service read-backのperformance link件数が一致しません。")
    expected_links: dict[str, list[dict[str, object]]] = {
        key: [] for key in expected_performances
    }
    for row in ready.links:
        expected_links[str(row["performance_key"])].append(row)
    actual_links: dict[str, list[dict[str, object]]] = {
        key: [] for key in expected_performances
    }
    for row in links:
        performance_id = row.get("live_performance_id")
        if not isinstance(performance_id, int) or performance_id not in reverse_ids:
            raise RuntimeError("linkに未知のperformance IDがあります。")
        actual_links[reverse_ids[performance_id]].append(row)
    link_fields = (
        "link_type",
        "label",
        "url",
        "published_date",
        "notes",
        "sort_order",
    )
    for key in expected_performances:
        expected_rows = sorted(
            expected_links[key], key=lambda row: (int(row["sort_order"]), str(row["url"]))
        )
        actual_rows = sorted(
            actual_links[key], key=lambda row: (int(row["sort_order"]), str(row["url"]))
        )
        if len(expected_rows) != len(actual_rows):
            raise RuntimeError(f"{key}: link件数が一致しません。")
        for expected, actual in zip(expected_rows, actual_rows, strict=True):
            if any(actual.get(field) != expected[field] for field in link_fields):
                raise RuntimeError(f"{key}: link ready値が一致しません。")

    setlists = service.select(
        "live_setlist_entries",
        [
            (
                "select",
                "live_performance_id,sort_order,entry_type,setlist_no_raw,song_id,"
                "song_title_raw,artist_credit_raw,note_raw,marker_label,notes,"
                "joucho_participation",
            ),
            ("live_performance_id", ids_filter(performance_ids)),
            ("order", "live_performance_id.asc,sort_order.asc,id.asc"),
        ],
    )
    if len(setlists) != len(ready.setlists):
        raise RuntimeError("service read-backのsetlist件数が一致しません。")
    expected_setlists: dict[str, list[dict[str, object]]] = {
        key: [] for key in expected_performances
    }
    for row in ready.setlists:
        expected_setlists[str(row["performance_key"])].append(row)
    actual_setlists: dict[str, list[dict[str, object]]] = {
        key: [] for key in expected_performances
    }
    for row in setlists:
        performance_id = row.get("live_performance_id")
        if not isinstance(performance_id, int) or performance_id not in reverse_ids:
            raise RuntimeError("setlistに未知のperformance IDがあります。")
        actual_setlists[reverse_ids[performance_id]].append(row)
    setlist_fields = (
        "sort_order",
        "entry_type",
        "setlist_no_raw",
        "song_id",
        "song_title_raw",
        "artist_credit_raw",
        "note_raw",
        "marker_label",
        "notes",
        "joucho_participation",
    )
    for key in expected_performances:
        expected_rows = expected_setlists[key]
        actual_rows = sorted(actual_setlists[key], key=lambda row: int(row["sort_order"]))
        if len(expected_rows) != len(actual_rows):
            raise RuntimeError(f"{key}: setlist件数が一致しません。")
        for expected, actual in zip(expected_rows, actual_rows, strict=True):
            if any(actual.get(field) != expected[field] for field in setlist_fields):
                raise RuntimeError(f"{key}: setlist ready値が一致しません。")


def validate_batch_anon_visibility(
    anon: RestClient,
    ready: BatchReadyData,
    created: CreatedRows,
    *,
    published: bool,
) -> None:
    performance_ids = list(created.performance_ids.values())
    performances = anon.select(
        "live_performances",
        [("select", "id"), ("id", ids_filter(performance_ids))],
    )
    setlists = anon.select(
        "live_setlist_entries",
        [
            ("select", "id,live_performance_id"),
            ("live_performance_id", ids_filter(performance_ids)),
        ],
    )
    links = anon.select(
        "live_performance_links",
        [
            ("select", "id,live_performance_id"),
            ("live_performance_id", ids_filter(performance_ids)),
        ],
    )
    if published:
        if len(performances) != len(ready.performances):
            raise RuntimeError("anonから公開26 performancesを取得できません。")
        if len(setlists) != len(ready.setlists):
            raise RuntimeError("anonから公開434 setlist entriesを取得できません。")
        if len(links) != len(ready.links):
            raise RuntimeError("anonから公開2 performance linksを取得できません。")
    elif performances or setlists or links:
        raise RuntimeError("公開前のbatchデータがanonから取得できてしまいます。")


def assert_sources_are_private(anon: RestClient, performance_ids: list[int]) -> None:
    try:
        anon.select(
            "live_performance_sources",
            [
                ("select", "id"),
                ("live_performance_id", ids_filter(performance_ids)),
                ("limit", "0"),
            ],
        )
    except RestError as error:
        if error.status not in {401, 403} or error.code != "42501":
            raise RuntimeError("sourcesのanon拒否応答が想定と異なります。") from error
    else:
        raise RuntimeError("sourcesがanonからSELECT可能になっています。")


def apply_batch_ready(
    service: RestClient, anon: RestClient, ready: BatchReadyData
) -> tuple[CreatedRows, BatchApplyResult]:
    created = CreatedRows()
    write_started = False
    pilot_before = snapshot_pilot_performances(service)
    try:
        for row in ready.performances:
            write_started = True
            inserted = service.insert(
                "live_performances",
                {
                    "live_event_group_id": None,
                    "group_sort_order": None,
                    "title": row["title"],
                    "title_kana": row["title_kana"],
                    "sort_title": row["sort_title"],
                    "artist_credit": row["artist_credit"],
                    "performance_date": row["performance_date"],
                    "format_label": row["format_label"],
                    "image_url": row["image_url"],
                    "venue": row["venue"],
                    "streaming_platforms": row["streaming_platforms"],
                    "notes": row["notes"],
                    "published_at": None,
                    "is_listed": False,
                },
            )
            created.performance_ids[str(row["performance_key"])] = returned_id(
                inserted, "live_performances"
            )

        source_payload = [
            {
                "live_performance_id": created.performance_ids[str(row["performance_key"])],
                "source_type": row["source_type"],
                "source_url": row["source_url"],
                "source_key": row["source_key"],
                "event_title_raw": row["event_title_raw"],
                "event_date_raw": row["event_date_raw"],
                "source_category_raw": row["source_category_raw"],
                "notes": row["notes"],
            }
            for row in ready.sources
        ]
        write_started = True
        inserted_sources = service.insert("live_performance_sources", source_payload)
        if len(inserted_sources) != len(ready.sources):
            raise RuntimeError("source INSERT件数がreadyと一致しません。")

        if ready.links:
            link_payload = [
                {
                    "live_performance_id": created.performance_ids[
                        str(row["performance_key"])
                    ],
                    "link_type": row["link_type"],
                    "label": row["label"],
                    "url": row["url"],
                    "published_date": row["published_date"],
                    "notes": row["notes"],
                    "sort_order": row["sort_order"],
                }
                for row in ready.links
            ]
            write_started = True
            inserted_links = service.insert("live_performance_links", link_payload)
            if len(inserted_links) != len(ready.links):
                raise RuntimeError("performance link INSERT件数がreadyと一致しません。")

        setlist_payload = [
            {
                "live_performance_id": created.performance_ids[str(row["performance_key"])],
                "sort_order": row["sort_order"],
                "entry_type": row["entry_type"],
                "setlist_no_raw": row["setlist_no_raw"],
                "song_id": row["song_id"],
                "song_title_raw": row["song_title_raw"],
                "artist_credit_raw": row["artist_credit_raw"],
                "note_raw": row["note_raw"],
                "marker_label": row["marker_label"],
                "notes": row["notes"],
                "joucho_participation": row["joucho_participation"],
            }
            for row in ready.setlists
        ]
        write_started = True
        inserted_setlists = service.insert("live_setlist_entries", setlist_payload)
        if len(inserted_setlists) != len(ready.setlists):
            raise RuntimeError("setlist INSERT件数がreadyと一致しません。")

        validate_batch_service_rows(service, ready, created, published=False)
        validate_batch_anon_visibility(anon, ready, created, published=False)
        assert_sources_are_private(anon, list(created.performance_ids.values()))

        published_at = datetime.now(timezone.utc).isoformat(timespec="microseconds")
        updated = service.update_ids(
            "live_performances",
            list(created.performance_ids.values()),
            {"published_at": published_at, "is_listed": True},
        )
        updated_ids = {row.get("id") for row in updated}
        if updated_ids != set(created.performance_ids.values()):
            raise RuntimeError("公開UPDATEの対象IDが今回26件と一致しません。")

        validate_batch_service_rows(service, ready, created, published=True)
        validate_batch_anon_visibility(anon, ready, created, published=True)
        assert_sources_are_private(anon, list(created.performance_ids.values()))
        if snapshot_pilot_performances(service) != pilot_before:
            raise RuntimeError("既存pilot 3 performancesに意図しない変更があります。")

        public_performances = anon.select("live_performances", [("select", "id")])
        public_setlists = anon.select("live_setlist_entries", [("select", "id")])
        public_links = anon.select("live_performance_links", [("select", "id")])
        return created, BatchApplyResult(
            public_performance_total=len(public_performances),
            public_setlist_total=len(public_setlists),
            public_link_total=len(public_links),
            published_at=published_at,
        )
    except Exception as error:
        if not write_started:
            raise
        try:
            cleanup_created(service, created)
        except Exception as cleanup_error:
            raise PartialImportError(
                "batch apply失敗後のcleanupにも失敗しました。部分投入の可能性があります。"
            ) from cleanup_error
        raise PartialImportError(
            "batch applyは失敗し、追跡できた今回作成performanceをcleanupしました。"
            "応答を受け取れなかったINSERTがある場合は部分投入の可能性があります。"
        ) from error


def print_plan(ready: ReadyData, preflight: PreflightResult) -> None:
    performance_by_key = {
        str(row["performance_key"]): row for row in ready.performances
    }
    print("mode: DRY-RUN (database writes: 0)")
    print("ready validation: PASS")
    print(
        "DB preflight: PASS "
        f"(sources={preflight.source_candidates}, "
        f"performances={preflight.performance_candidates}, "
        f"event_groups={preflight.event_group_candidates})"
    )
    print("STEP 1 live_event_groups: 1")
    print(f"  - {EXPECTED_GROUP_TITLE}")
    print("STEP 2 live_performances: 3")
    for key in PILOT_PAGE_KEYS:
        row = performance_by_key[key]
        if row["local_group_key"] is None:
            relation = "groupなし"
        else:
            relation = f"2DAYS group / group_sort_order {row['group_sort_order']}"
        print(f"  - {row['title']}: {relation}")
    print("  - all: published_at=NULL, is_listed=false")
    print("STEP 3 live_performance_sources: 3 (各performance 1件)")
    print("STEP 4 live_setlist_entries: 65")
    for key in PILOT_PAGE_KEYS:
        title = performance_by_key[key]["title"]
        print(f"  - {title}: {EXPECTED_SETLIST_COUNTS[key]}")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--ready",
        type=Path,
        default=DEFAULT_READY_PATH,
        help="validated ready directory (default: pilot-001)",
    )
    parser.add_argument(
        "--apply",
        action="store_true",
        help="perform writes; requires an exact --confirm pilot name",
    )
    parser.add_argument(
        "--confirm",
        help="exact pilot name required together with --apply",
    )
    return parser


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    args = build_parser().parse_args()
    try:
        ready_path = args.ready.resolve()
        if ready_path.name != PILOT_NAME:
            batch_ready = load_batch_ready(ready_path)
            if args.apply:
                if args.confirm != batch_ready.ready_name:
                    raise RuntimeError(
                        f"applyには --confirm {batch_ready.ready_name} が必要です。"
                    )
            elif args.confirm is not None:
                raise RuntimeError("--confirmは--applyなしでは指定できません。")
            service = create_service_client()
            batch_preflight = preflight_batch_database(service, batch_ready)
            if not args.apply:
                print_batch_plan(batch_ready, batch_preflight)
                return 0
            created, result = apply_batch_ready(
                service, create_anon_client(), batch_ready
            )
            print("apply preflight: PASS")
            print(f"apply completed: performances={len(created.performance_ids)}")
            print(f"apply completed: sources={len(batch_ready.sources)}")
            print(f"apply completed: links={len(batch_ready.links)}")
            print(f"apply completed: setlists={len(batch_ready.setlists)}")
            print("service read-back validation: PASS")
            print("publication: PASS (published_at set, is_listed=true)")
            print("anon target validation: PASS")
            print(
                "public totals: "
                f"performances={result.public_performance_total}, "
                f"setlists={result.public_setlist_total}, "
                f"links={result.public_link_total}"
            )
            return 0

        ready = load_ready(ready_path)
        if args.apply:
            if args.confirm != ready.pilot_name:
                raise RuntimeError(
                    f"applyには --confirm {ready.pilot_name} が必要です。"
                )
        elif args.confirm is not None:
            raise RuntimeError("--confirmは--applyなしでは指定できません。")

        service = create_service_client()
        preflight = preflight_database(service, ready)
        if not args.apply:
            print_plan(ready, preflight)
            return 0

        created = apply_ready(service, ready)
        print(f"apply completed: groups={len(created.group_ids)}")
        print(f"apply completed: performances={len(created.performance_ids)}")
        print(f"apply completed: sources={len(ready.sources)}")
        print(f"apply completed: setlists={len(ready.setlists)}")
        print("post-apply validation: PASS")
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        print(f"importerを停止しました: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
