"""Apply live-song-resolution ready data with guarded cleanup and validation.

Writes require both --apply and an exact --confirm value. A local setlist
snapshot is written before the first database mutation. On any failure, only
rows created or changed by this run are targeted for compensating cleanup.
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
import os
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Final
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode
from urllib.request import Request, urlopen
from zoneinfo import ZoneInfo

import dry_run_live_song_setlist_ready as dry


ROOT: Final = Path(__file__).resolve().parents[2]
READY_NAME: Final = "live-song-resolution-001"
DEFAULT_READY: Final = ROOT / "private-data" / "imports" / "thinkr" / "ready" / READY_NAME
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "imports" / "thinkr" / "working" / "backups"


class RestClient:
    def __init__(self, base_url: str, key: str) -> None:
        self._base_url = base_url.rstrip("/")
        self._key = key

    def request(
        self,
        table: str,
        *,
        method: str = "GET",
        params: list[tuple[str, str]] | None = None,
        payload: object | None = None,
        prefer: str | None = None,
    ) -> object:
        query = "?" + urlencode(params, safe="(),.*") if params else ""
        headers = {
            "apikey": self._key,
            "Authorization": f"Bearer {self._key}",
            "Accept": "application/json",
        }
        body = None
        if payload is not None:
            body = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            headers["Content-Type"] = "application/json"
        if prefer:
            headers["Prefer"] = prefer
        request = Request(
            f"{self._base_url}/rest/v1/{table}{query}",
            data=body,
            headers=headers,
            method=method,
        )
        try:
            with urlopen(request, timeout=45) as response:
                response_body = response.read()
        except HTTPError as error:
            code = None
            message = "request rejected"
            try:
                decoded = json.loads(error.read().decode("utf-8"))
                if isinstance(decoded, dict):
                    code = decoded.get("code")
                    message = decoded.get("message") or message
            except (UnicodeDecodeError, json.JSONDecodeError):
                pass
            raise RuntimeError(
                f"Data API error: status={error.code}, code={code or 'unknown'}, message={message}"
            ) from None
        except URLError as error:
            raise RuntimeError("Data API network request failed") from error
        if not response_body:
            return None
        return json.loads(response_body.decode("utf-8"))

    def select(self, table: str, fields: str) -> list[dict[str, object]]:
        result = self.request(table, params=[("select", fields)])
        if not isinstance(result, list):
            raise RuntimeError("SELECT response is not a list")
        return result

    def insert_one(self, table: str, payload: dict[str, object]) -> dict[str, object]:
        result = self.request(
            table,
            method="POST",
            payload=payload,
            prefer="return=representation",
        )
        if not isinstance(result, list) or len(result) != 1 or not isinstance(result[0], dict):
            raise RuntimeError(f"{table} INSERT did not return exactly one row")
        return result[0]

    def patch_ids(self, table: str, ids: list[int], payload: dict[str, object]) -> None:
        if not ids:
            return
        result = self.request(
            table,
            method="PATCH",
            params=[("id", f"in.({','.join(str(value) for value in ids)})")],
            payload=payload,
            prefer="return=representation",
        )
        if not isinstance(result, list) or {int(row["id"]) for row in result} != set(ids):
            raise RuntimeError(f"{table} PATCH returned unexpected IDs")

    def delete_ids(self, table: str, ids: list[int]) -> None:
        if not ids:
            return
        self.request(
            table,
            method="DELETE",
            params=[("id", f"in.({','.join(str(value) for value in ids)})")],
            prefer="return=minimal",
        )


def service_client() -> RestClient:
    dry.load_environment()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_ROLE_KEY")
    if not url or not key:
        raise RuntimeError("service role environment is unavailable")
    return RestClient(url, key)


def anon_client() -> RestClient:
    dry.load_environment()
    url = os.environ.get("NEXT_PUBLIC_SUPABASE_URL")
    key = os.environ.get("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY")
    if not url or not key:
        raise RuntimeError("anon environment is unavailable")
    return RestClient(url, key)


def canonical_hash(rows: list[dict[str, object]]) -> str:
    encoded = json.dumps(
        sorted(rows, key=lambda row: int(row["id"])),
        ensure_ascii=False,
        sort_keys=True,
        separators=(",", ":"),
    ).encode("utf-8")
    return hashlib.sha256(encoded).hexdigest()


def optional_int(value: str) -> int | None:
    return int(value) if value else None


def optional_bool(value: str) -> bool | None:
    return dry.optional_bool(value)


def nullable(value: str) -> object | None:
    return value if value != "" else None


def song_payload(row: dict[str, str], song_group_id: int | None) -> dict[str, object]:
    return {
        "title": row["title"],
        "title_kana": nullable(row["title_kana"]),
        "sort_title": nullable(row["sort_title"]),
        "song_type": nullable(row["song_type"]),
        "artist_credit": nullable(row["artist_credit"]),
        "first_date": nullable(row["first_date"]),
        "first_source": nullable(row["first_source"]),
        "verification_status": row["verification_status"],
        "verification_note": nullable(row["verification_note"]),
        "first_status": row["first_status"],
        "first_full_status": row["first_full_status"],
        "tie_up_status": row["tie_up_status"],
        "album_text_status": row["album_text_status"],
        "original_artist_status": row["original_artist_status"],
        "original_vocal_status": row["original_vocal_status"],
        "original_lyricist_status": row["original_lyricist_status"],
        "original_composer_status": row["original_composer_status"],
        "original_arranger_status": row["original_arranger_status"],
        "song_group_id": song_group_id,
        "version_name": nullable(row["version_name"]),
        "version_type": row["version_type"],
        "is_primary_version": optional_bool(row["is_primary_version"]),
    }


def snapshot_path() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    candidate = SNAPSHOT_ROOT / f"live-setlist-before-{READY_NAME}-{stamp}.csv"
    counter = 1
    while candidate.exists():
        candidate = SNAPSHOT_ROOT / f"live-setlist-before-{READY_NAME}-{stamp}-{counter}.csv"
        counter += 1
    return candidate


def write_snapshot(path: Path, rows: list[dict[str, object]]) -> None:
    fields = [
        "id", "live_performance_id", "sort_order", "setlist_no_raw",
        "song_title_raw", "artist_credit_raw", "song_id", "joucho_participation",
        "note_raw", "notes",
    ]
    with path.open("x", encoding="utf-8-sig", newline="") as stream:
        writer = csv.DictWriter(stream, fieldnames=fields, lineterminator="\n")
        writer.writeheader()
        for row in sorted(rows, key=lambda item: int(item["id"])):
            writer.writerow({field: "" if row.get(field) is None else row.get(field) for field in fields})


def preflight_state(
    api: RestClient,
    ready_dir: Path,
) -> tuple[
    list[dict[str, str]], list[dict[str, str]], list[dict[str, str]],
    list[dict[str, object]], dict[str, str], Path,
]:
    # Re-run the already validated read-only preflight immediately before apply.
    dry_stats = dry.preflight(ready_dir)
    if dry_stats["db_writes"] != 0:
        raise RuntimeError("dry preflight unexpectedly reported writes")
    groups, songs, setlists, _ = dry.validate_ready(ready_dir)
    current_setlists = api.select(
        "live_setlist_entries",
        "id,live_performance_id,sort_order,setlist_no_raw,song_title_raw,artist_credit_raw,song_id,joucho_participation,note_raw,notes",
    )
    if len(current_setlists) != 499:
        raise RuntimeError("pre-apply setlist snapshot is not 499 rows")
    immutable = {}
    for table in ("live_performances", "live_series", "live_series_members", "live_event_groups"):
        immutable[table] = canonical_hash(api.select(table, "*"))
    path = snapshot_path()
    write_snapshot(path, current_setlists)
    return groups, songs, setlists, current_setlists, immutable, path


def chunks(values: list[int], size: int = 80) -> list[list[int]]:
    return [values[index:index + size] for index in range(0, len(values), size)]


def desired_setlists(
    ready_rows: list[dict[str, str]],
    current_rows: list[dict[str, object]],
    local_song_ids: dict[str, int],
) -> list[dict[str, object]]:
    current_by_id = {int(row["id"]): row for row in current_rows}
    result = []
    for row in ready_rows:
        entry_id = int(row["setlist_entry_id"])
        current = current_by_id[entry_id]
        song_id = optional_int(row["target_existing_song_id"])
        if row["target_local_song_key"]:
            song_id = local_song_ids[row["target_local_song_key"]]
        notes = current.get("notes")
        if row["notes_append"]:
            notes = row["notes_append"] if notes is None else f"{notes}\n{row['notes_append']}"
        result.append({
            "id": entry_id,
            "song_id": song_id,
            "joucho_participation": optional_bool(row["target_joucho_participation"]),
            "notes": notes,
            "song_title_raw": row["expected_song_title_raw"],
            "artist_credit_raw": row["expected_artist_credit_raw"],
            "setlist_no_raw": current.get("setlist_no_raw"),
        })
    return result


def patch_setlists(api: RestClient, desired: list[dict[str, object]], updated_ids: set[int]) -> None:
    groups: dict[tuple[object, object, object], list[int]] = defaultdict(list)
    for row in desired:
        groups[(row["song_id"], row["joucho_participation"], row["notes"])].append(int(row["id"]))
    completed = 0
    total_batches = sum(len(chunks(ids)) for ids in groups.values())
    for (song_id, participation, notes), ids in groups.items():
        payload = {"song_id": song_id, "joucho_participation": participation, "notes": notes}
        for batch in chunks(ids):
            api.patch_ids("live_setlist_entries", batch, payload)
            updated_ids.update(batch)
            completed += 1
            if completed % 25 == 0 or completed == total_batches:
                print(f"setlist update batches: {completed}/{total_batches}", flush=True)


def restore_setlists(api: RestClient, snapshot: list[dict[str, object]], ids: set[int]) -> list[str]:
    errors: list[str] = []
    grouped: dict[tuple[object, object, object], list[int]] = defaultdict(list)
    for row in snapshot:
        entry_id = int(row["id"])
        if entry_id in ids:
            grouped[(row.get("song_id"), row.get("joucho_participation"), row.get("notes"))].append(entry_id)
    for (song_id, participation, notes), group_ids in grouped.items():
        for batch in chunks(group_ids):
            try:
                api.patch_ids(
                    "live_setlist_entries",
                    batch,
                    {"song_id": song_id, "joucho_participation": participation, "notes": notes},
                )
            except RuntimeError as error:
                errors.append(str(error))
    return errors


def cleanup(
    api: RestClient,
    snapshot: list[dict[str, object]],
    updated_ids: set[int],
    standard_ids: list[int],
    group_ids: list[int],
    version_ids: list[int],
) -> list[str]:
    errors = restore_setlists(api, snapshot, updated_ids)
    try:
        for batch in chunks(standard_ids):
            api.patch_ids("songs", batch, {"song_group_id": None})
    except RuntimeError as error:
        errors.append(str(error))
    try:
        for batch in chunks(group_ids):
            api.delete_ids("song_groups", batch)
    except RuntimeError as error:
        errors.append(str(error))
    try:
        for batch in chunks(version_ids + standard_ids):
            api.delete_ids("songs", batch)
    except RuntimeError as error:
        errors.append(str(error))
    return errors


def validate_service(
    api: RestClient,
    ready_songs: list[dict[str, str]],
    desired: list[dict[str, object]],
    local_song_ids: dict[str, int],
    group_ids: list[int],
    immutable_before: dict[str, str],
) -> None:
    db_songs = api.select("songs", "id,title,artist_credit,version_type,version_name,song_group_id,is_primary_version")
    by_id = {int(row["id"]): row for row in db_songs}
    if len(group_ids) != 18 or len(local_song_ids) != 39:
        raise RuntimeError("created group/song mapping count mismatch")
    for ready in ready_songs:
        song_id = local_song_ids[ready["local_song_key"]]
        actual = by_id.get(song_id)
        expected_group = optional_int(ready["existing_song_group_id"])
        if ready["local_group_key"]:
            expected_group = song_id
        expected = {
            "title": ready["title"],
            "artist_credit": nullable(ready["artist_credit"]),
            "version_type": ready["version_type"],
            "version_name": nullable(ready["version_name"]),
            "song_group_id": expected_group,
            "is_primary_version": optional_bool(ready["is_primary_version"]),
        }
        if actual is None or any(actual.get(field) != value for field, value in expected.items()):
            raise RuntimeError(f"created song read-back mismatch: {ready['local_song_key']}")

    actual_groups = {int(row["id"]) for row in api.select("song_groups", "id")}
    if not set(group_ids).issubset(actual_groups):
        raise RuntimeError("created song_groups are missing")

    db_setlists = api.select(
        "live_setlist_entries",
        "id,song_id,joucho_participation,notes,song_title_raw,artist_credit_raw,setlist_no_raw",
    )
    actual_by_id = {int(row["id"]): row for row in db_setlists}
    for expected in desired:
        actual = actual_by_id.get(int(expected["id"]))
        if actual is None or any(actual.get(field) != expected.get(field) for field in (
            "song_id", "joucho_participation", "notes", "song_title_raw", "artist_credit_raw", "setlist_no_raw"
        )):
            raise RuntimeError(f"setlist read-back mismatch: {expected['id']}")
    true_count = sum(row["joucho_participation"] is True for row in db_setlists)
    false_count = sum(row["joucho_participation"] is False for row in db_setlists)
    nonnull = sum(row["song_id"] is not None for row in db_setlists)
    nulls = sum(row["song_id"] is None for row in db_setlists)
    if (len(db_setlists), true_count, false_count, nonnull, nulls) != (499, 378, 121, 375, 124):
        raise RuntimeError("setlist aggregate validation mismatch")
    if any(row["song_id"] is not None and int(row["song_id"]) not in by_id for row in db_setlists):
        raise RuntimeError("setlist contains a missing song FK")
    for table, before_hash in immutable_before.items():
        if canonical_hash(api.select(table, "*")) != before_hash:
            raise RuntimeError(f"immutable live table changed: {table}")


def validate_anon(desired: list[dict[str, object]]) -> None:
    api = anon_client()
    entries = api.select("live_setlist_entries", "id,song_id,joucho_participation")
    if len(entries) != 499:
        raise RuntimeError("anon cannot read all 499 published setlist rows")
    nonnull_ids = {int(row["song_id"]) for row in entries if row.get("song_id") is not None}
    if sum(row.get("song_id") is not None for row in entries) != 375:
        raise RuntimeError("anon setlist song_id count mismatch")
    public_song_ids = {int(row["id"]) for row in api.select("songs", "id")}
    if not nonnull_ids.issubset(public_song_ids):
        raise RuntimeError("anon setlist references a song unavailable through public SELECT")


def apply(ready_dir: Path) -> Path:
    api = service_client()
    groups, songs, setlists, snapshot, immutable, snapshot_file = preflight_state(api, ready_dir)
    standard_rows = [row for row in songs if row["creation_kind"] == "NEW_SONG"]
    version_rows = [row for row in songs if row["creation_kind"] == "NEW_VERSION"]
    groups_by_key = {row["local_group_key"]: row for row in groups}
    local_ids: dict[str, int] = {}
    standard_ids: list[int] = []
    group_ids: list[int] = []
    version_ids: list[int] = []
    updated_ids: set[int] = set()
    try:
        print(f"snapshot created: {snapshot_file}", flush=True)
        for row in standard_rows:
            created = api.insert_one("songs", song_payload(row, None))
            song_id = int(created["id"])
            local_ids[row["local_song_key"]] = song_id
            standard_ids.append(song_id)
            group = groups_by_key[row["local_group_key"]]
            api.insert_one("song_groups", {
                "id": song_id,
                "title": group["title"],
                "title_kana": nullable(group["title_kana"]),
                "sort_title": nullable(group["sort_title"]),
                "notes": nullable(group["notes"]),
            })
            group_ids.append(song_id)
            api.patch_ids("songs", [song_id], {"song_group_id": song_id})
        print("created primary songs/groups: 18/18", flush=True)

        for row in version_rows:
            created = api.insert_one(
                "songs", song_payload(row, int(row["existing_song_group_id"]))
            )
            song_id = int(created["id"])
            local_ids[row["local_song_key"]] = song_id
            version_ids.append(song_id)
        print("created versions: 21", flush=True)

        desired = desired_setlists(setlists, snapshot, local_ids)
        patch_setlists(api, desired, updated_ids)
        validate_service(api, songs, desired, local_ids, group_ids, immutable)
        validate_anon(desired)
        print("service validation: PASS", flush=True)
        print("anon validation: PASS", flush=True)
        return snapshot_file
    except Exception:
        errors = cleanup(api, snapshot, updated_ids, standard_ids, group_ids, version_ids)
        if errors:
            raise RuntimeError(
                "apply failed; cleanup incomplete; partial state possible: " + " | ".join(errors)
            ) from None
        raise RuntimeError("apply failed; compensating cleanup completed") from None


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Apply reviewed live song/setlist ready data")
    parser.add_argument("--ready", type=Path, default=DEFAULT_READY)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    return parser.parse_args()


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    args = parse_args()
    if not args.apply or args.confirm != READY_NAME:
        print("write refused: require --apply --confirm live-song-resolution-001", file=sys.stderr)
        return 2
    try:
        snapshot = apply(args.ready.resolve())
        print("song_groups created: 18")
        print("songs created: 39")
        print("setlists updated: 499")
        print("participation: TRUE=378 FALSE=121")
        print("song_id: SET=375 NULL=124")
        print(f"rollback snapshot: {snapshot}")
        print("rollback: not required")
        print("apply: PASS")
        return 0
    except (OSError, RuntimeError, ValueError, KeyError, json.JSONDecodeError) as error:
        print(str(error), file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
