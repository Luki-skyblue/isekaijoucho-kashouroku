"""Read-only preflight and dry-run for live song/setlist ready data.

This importer intentionally exposes no apply mode and implements only GET
requests. It cannot write to Supabase in its current form.
"""

from __future__ import annotations

import argparse
import csv
import json
import os
import sys
import unicodedata
from collections import Counter
from pathlib import Path
from typing import Final
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen


ROOT: Final = Path(__file__).resolve().parents[2]
DEFAULT_READY: Final = ROOT / "private-data" / "imports" / "thinkr" / "ready" / "live-song-resolution-001"
ENV_PATH: Final = ROOT / ".env.local"
EXPECTED_FILES: Final = {"song_groups.csv", "songs.csv", "live_setlist_updates.csv", "manifest.json", "manifest.md"}


class ReadOnlyRestClient:
    def __init__(self, base_url: str, key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._key = key

    def select(self, table: str, fields: str) -> list[dict[str, object]]:
        query = urlencode({"select": fields}, safe="*,")
        request = Request(
            f"{self._base_url}/rest/v1/{table}?{query}",
            headers={"apikey": self._key, "Authorization": f"Bearer {self._key}", "Accept": "application/json"},
            method="GET",
        )
        try:
            with urlopen(request, timeout=30) as response:
                payload = response.read()
        except HTTPError as error:
            raise RuntimeError(f"read-only Data API SELECT failed: HTTP {error.code}") from None
        except URLError as error:
            raise RuntimeError("read-only Data API SELECT network failure") from error
        result = json.loads(payload.decode("utf-8"))
        if not isinstance(result, list) or not all(isinstance(row, dict) for row in result):
            raise RuntimeError("read-only Data API SELECT returned unexpected data")
        return result


def load_environment() -> None:
    if ENV_PATH.exists():
        for raw in ENV_PATH.read_text(encoding="utf-8").splitlines():
            line = raw.strip()
            if not line or line.startswith("#") or "=" not in line:
                continue
            key, value = line.split("=", 1)
            value = value.strip()
            if len(value) >= 2 and value[0] == value[-1] and value[0] in {"'", '"'}:
                value = value[1:-1]
            os.environ.setdefault(key.strip(), value)


def client() -> ReadOnlyRestClient:
    load_environment()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("Supabase read-only preflight用環境変数がありません。")
    return ReadOnlyRestClient(url, key)


def read_csv(path: Path) -> list[dict[str, str]]:
    with path.open("r", encoding="utf-8-sig", newline="") as stream:
        return list(csv.DictReader(stream))


def optional_int(value: str) -> int | None:
    return int(value) if value != "" else None


def optional_bool(value: str) -> bool | None:
    if value == "":
        return None
    if value == "true":
        return True
    if value == "false":
        return False
    raise RuntimeError(f"boolean CSV値が不正です: {value}")


def title_key(value: object) -> str:
    normalized = unicodedata.normalize("NFKC", str(value or "")).casefold()
    return "".join(character for character in normalized if character.isalnum())


def artist_key(value: object) -> str:
    return "".join(str(value or "").split())


def validate_ready(ready: Path) -> tuple[list[dict[str, str]], list[dict[str, str]], list[dict[str, str]], dict[str, object]]:
    if not ready.is_dir():
        raise RuntimeError(f"ready directoryがありません: {ready}")
    found = {path.name for path in ready.iterdir() if path.is_file()}
    if found != EXPECTED_FILES:
        raise RuntimeError(f"ready file構成が不正です: {sorted(found)}")
    manifest = json.loads((ready / "manifest.json").read_text(encoding="utf-8"))
    if manifest.get("ready_name") != "live-song-resolution-001" or manifest.get("database_writes") != 0:
        raise RuntimeError("manifestが対象ready/dry-run状態と一致しません。")
    groups = read_csv(ready / "song_groups.csv")
    songs = read_csv(ready / "songs.csv")
    setlists = read_csv(ready / "live_setlist_updates.csv")
    if len(groups) != 18 or len(songs) != 39 or len(setlists) != 499:
        raise RuntimeError("ready CSV件数が18 / 39 / 499ではありません。")
    if len({row["local_group_key"] for row in groups}) != 18:
        raise RuntimeError("local_group_keyがuniqueではありません。")
    if len({row["local_song_key"] for row in songs}) != 39:
        raise RuntimeError("local_song_keyがuniqueではありません。")
    if Counter(row["creation_kind"] for row in songs) != Counter({"NEW_VERSION": 21, "NEW_SONG": 18}):
        raise RuntimeError("song creation_kind件数が不正です。")
    local_song_keys = {row["local_song_key"] for row in songs}
    if any(row["target_local_song_key"] and row["target_local_song_key"] not in local_song_keys for row in setlists):
        raise RuntimeError("setlist readyに解決不能なlocal_song_keyがあります。")
    return groups, songs, setlists, manifest


def preflight(ready: Path) -> dict[str, int]:
    groups, songs, setlists, manifest = validate_ready(ready)
    api = client()
    db_songs = api.select("songs", "id,title,artist_credit,version_type,version_name,song_group_id")
    db_groups = api.select("song_groups", "id,title")
    db_setlists = api.select(
        "live_setlist_entries",
        "id,live_performance_id,sort_order,song_title_raw,artist_credit_raw,song_id,joucho_participation,notes",
    )
    db_song_ids = {int(row["id"]) for row in db_songs}
    db_group_ids = {int(row["id"]) for row in db_groups}

    version_group_ids = {int(row["existing_song_group_id"]) for row in songs if row["creation_kind"] == "NEW_VERSION"}
    missing_groups = sorted(version_group_ids - db_group_ids)
    if missing_groups:
        raise RuntimeError(f"NEW_VERSIONのsong_groupが存在しません: {missing_groups}")

    duplicates = []
    for row in songs:
        matches = [
            current for current in db_songs
            if str(current["title"]) == row["title"]
            and artist_key(current.get("artist_credit")) == artist_key(row["artist_credit"])
        ]
        if matches:
            duplicates.append((row["local_song_key"], row["title"], row["artist_credit"]))
    if duplicates:
        raise RuntimeError(f"既存songs重複候補があります: {duplicates}")

    db_group_keys = {title_key(row["title"]) for row in db_groups}
    group_duplicates = [row["title"] for row in groups if title_key(row["title"]) in db_group_keys]
    if group_duplicates:
        raise RuntimeError(f"既存song_groups重複候補があります: {group_duplicates}")

    existing_targets = {optional_int(row["target_existing_song_id"]) for row in setlists} - {None}
    missing_song_ids = sorted(existing_targets - db_song_ids)
    if missing_song_ids:
        raise RuntimeError(f"LINK_EXISTING参照先が存在しません: {missing_song_ids}")

    db_by_id = {int(row["id"]): row for row in db_setlists}
    if len(db_by_id) != 499 or len(setlists) != 499:
        raise RuntimeError("DB/ready setlistが499行ではありません。")
    for row in setlists:
        entry_id = int(row["setlist_entry_id"])
        current = db_by_id.get(entry_id)
        if not current:
            raise RuntimeError(f"DBにsetlist entryがありません: {entry_id}")
        expected = {
            "live_performance_id": int(row["expected_live_performance_id"]),
            "sort_order": int(row["expected_sort_order"]),
            "song_title_raw": row["expected_song_title_raw"],
            "artist_credit_raw": row["expected_artist_credit_raw"],
            "song_id": optional_int(row["expected_current_song_id"]),
            "joucho_participation": optional_bool(row["expected_current_joucho_participation"]),
        }
        if any(current.get(field) != value for field, value in expected.items()):
            raise RuntimeError(f"setlist entryの現在値がready期待値と不一致です: {entry_id}")
        if row["notes_append"] and current.get("notes") is not None:
            raise RuntimeError(f"annotation追記先notesが既に非NULLです: {entry_id}")

    true_count = sum(optional_bool(row["target_joucho_participation"]) is True for row in setlists)
    false_count = sum(optional_bool(row["target_joucho_participation"]) is False for row in setlists)
    existing_rows = sum(row["target_existing_song_id"] != "" for row in setlists)
    local_rows = sum(row["target_local_song_key"] != "" for row in setlists)
    null_rows = sum(row["target_existing_song_id"] == "" and row["target_local_song_key"] == "" for row in setlists)
    special = [row for row in setlists if row["resolution_status"] == "SPECIAL_UNRESOLVED"]
    if (true_count, false_count, existing_rows, local_rows, null_rows, len(special)) != (378, 121, 336, 39, 124, 3):
        raise RuntimeError("setlist target集計が最終想定と一致しません。")
    if any(row["target_joucho_participation"] != "true" or row["target_existing_song_id"] or row["target_local_song_key"] for row in special):
        raise RuntimeError("SPECIAL_UNRESOLVEDのTRUE/song_id NULL条件が不正です。")

    return {
        "new_song_groups": len(groups),
        "new_songs": len(songs),
        "new_versions": sum(row["creation_kind"] == "NEW_VERSION" for row in songs),
        "new_primary_songs": sum(row["creation_kind"] == "NEW_SONG" for row in songs),
        "setlist_updates": len(setlists),
        "participation_true": true_count,
        "participation_false": false_count,
        "song_id_set_rows": existing_rows + local_rows,
        "song_id_null_rows": null_rows,
        "special_unresolved_rows": len(special),
        "db_writes": 0,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Read-only live song/setlist ready dry-run")
    parser.add_argument("--ready", type=Path, default=DEFAULT_READY)
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    try:
        stats = preflight(parse_args().ready.resolve())
        print("mode: DRY-RUN ONLY (this script has no write methods)")
        print("ready validation: PASS")
        print("DB duplicate/reference preflight: PASS")
        print("STEP 1 create 18 standard songs and resolve generated IDs")
        print("STEP 2 create 18 song_groups with standard-song IDs; link primary songs")
        print("STEP 3 create 21 versions in existing song_groups")
        print("STEP 4 resolve 39 local song keys and update 499 live setlist rows")
        print(json.dumps(stats, ensure_ascii=False, indent=2))
        print("dry-run: PASS")
        return 0
    except (OSError, RuntimeError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(f"dry-runを停止しました: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
