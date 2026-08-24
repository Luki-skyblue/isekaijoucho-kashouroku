"""Register the approved live series relations through the Supabase Data API.

Dry-run is the default. Writes require both --apply and the exact confirmation
name. Performances are resolved only through THINKR Wiki source keys.
"""

from __future__ import annotations

import argparse
import sys
from collections import Counter
from dataclasses import dataclass, field
from typing import Final

from import_live_ready import (
    PartialImportError,
    RestClient,
    create_anon_client,
    create_service_client,
    ids_filter,
    returned_id,
)


CONFIRM_NAME: Final = "live-series-001"
EXPECTED_PUBLIC_PERFORMANCES: Final = 29

# These relations and their order are explicit human decisions. Titles beside
# source keys are validation aids only; source_key is the identity resolution
# basis and no title-based matching is performed.
SERIES_DEFINITIONS: Final = (
    (
        "Anima",
        (
            ("2021.1023", "Anima"),
            ("2023.0618", "Anima II -神椿市参番街-"),
            ("2024.0807", "Anima III"),
            ("2026.0502", "Anima Re:birth"),
        ),
    ),
    (
        "キャンディライブ",
        (
            ("2020.1226", "キャンディライブ"),
            ("2023.0114", "キャンディライブ 2"),
            ("2025.1011", "キャンディライブ 3"),
        ),
    ),
    (
        "parallel canvas",
        (
            ("2023.0415", "parallel canvas"),
            ("2023.1028", "parallel canvas II"),
        ),
    ),
    (
        "現象",
        (
            ("2022.0416", "現象"),
            ("2024.0113", "現象II -魔女拡成-"),
            ("2024.1102", "現象II(再)"),
            ("2026.0228", "現象IV -反転運命-"),
        ),
    ),
    (
        "Singularity Live",
        (
            ("2022.0717", "Singularity Live vol.1"),
            ("2025.1103", "Singularity Live Vol.4"),
        ),
    ),
    (
        "拡声の会",
        (
            ("2025.0717", "ARIA-ISEKAIJOUCHO"),
            ("2025.0814", "ARIA-ISEKAIJOUCHO 2"),
            ("2025.0927", "魔女達の夜会～歌と重大発表と笑い話と～"),
        ),
    ),
    (
        "不可解弐",
        (
            ("2020.1010", "不可解弐Q1"),
            ("2021.0612", "不可解弐Q2:RE -世界線は分岐する-"),
        ),
    ),
    (
        "V.W.P Virtual mini live",
        (
            ("2023.1229", "拡成前夜"),
            ("2025.0707", "拡張前夜"),
        ),
    ),
)


@dataclass(frozen=True)
class Preflight:
    performance_ids_by_key: dict[str, int]
    existing_series: int
    existing_memberships: int


@dataclass
class Created:
    series_ids_by_title: dict[str, int] = field(default_factory=dict)


def source_keys() -> list[str]:
    return [key for _, members in SERIES_DEFINITIONS for key, _ in members]


def expected_titles_by_key() -> dict[str, str]:
    return {
        key: performance_title
        for _, members in SERIES_DEFINITIONS
        for key, performance_title in members
    }


def validate_definitions() -> None:
    if len(SERIES_DEFINITIONS) != 8:
        raise RuntimeError("series定義が8件ではありません。")
    titles = [title for title, _ in SERIES_DEFINITIONS]
    if len(set(titles)) != len(titles):
        raise RuntimeError("series titleがuniqueではありません。")
    keys = source_keys()
    if len(keys) != 22 or len(set(keys)) != 22:
        raise RuntimeError("source_key定義が22件・uniqueではありません。")
    for title, members in SERIES_DEFINITIONS:
        if not title.strip() or not members:
            raise RuntimeError("空のseries titleまたはmembership定義があります。")


def snapshot_performances(service: RestClient) -> list[dict[str, object]]:
    rows = service.select(
        "live_performances",
        [
            (
                "select",
                "id,live_event_group_id,group_sort_order,title,title_kana,sort_title,"
                "artist_credit,performance_date,format_label,image_url,venue,"
                "streaming_platforms,notes,published_at,is_listed,created_at",
            ),
            ("order", "id.asc"),
        ],
    )
    if len(rows) != EXPECTED_PUBLIC_PERFORMANCES:
        raise RuntimeError(
            f"performance本体が想定の29件ではありません: {len(rows)}"
        )
    return rows


def preflight(service: RestClient) -> Preflight:
    validate_definitions()
    keys = source_keys()
    sources = service.select(
        "live_performance_sources",
        [
            ("select", "source_key,live_performance_id"),
            ("source_type", "eq.thinkr_wiki"),
            ("source_key", f"in.({','.join(keys)})"),
        ],
    )
    counts = Counter(str(row.get("source_key")) for row in sources)
    if counts != Counter(keys):
        missing = sorted(set(keys) - set(counts))
        duplicate = sorted(key for key, count in counts.items() if count != 1)
        raise RuntimeError(
            "source_keyを22件すべて一意解決できません: "
            f"missing={missing}, duplicate={duplicate}"
        )
    ids_by_key: dict[str, int] = {}
    for row in sources:
        key = str(row["source_key"])
        performance_id = row.get("live_performance_id")
        if not isinstance(performance_id, int):
            raise RuntimeError(f"{key}: performance IDが不正です。")
        ids_by_key[key] = performance_id
    if len(set(ids_by_key.values())) != 22:
        raise RuntimeError("複数source_keyが同じperformanceへ解決されています。")

    performances = service.select(
        "live_performances",
        [
            ("select", "id,title,published_at,is_listed"),
            ("id", ids_filter(list(ids_by_key.values()))),
        ],
    )
    if len(performances) != 22:
        raise RuntimeError("sourceから解決したperformanceを22件取得できません。")
    key_by_id = {value: key for key, value in ids_by_key.items()}
    expected_titles = expected_titles_by_key()
    for row in performances:
        row_id = row.get("id")
        if not isinstance(row_id, int) or row_id not in key_by_id:
            raise RuntimeError("未知のperformanceがpreflightへ混入しています。")
        key = key_by_id[row_id]
        if row.get("title") != expected_titles[key]:
            raise RuntimeError(f"{key}: 確認用titleが承認値と一致しません。")
        if row.get("published_at") is None or row.get("is_listed") is not True:
            raise RuntimeError(f"{key}: performanceが公開済みではありません。")

    series_titles = [title for title, _ in SERIES_DEFINITIONS]
    existing_series = service.select(
        "live_series",
        [
            ("select", "id,title"),
            ("title", f"in.({','.join(series_titles)})"),
        ],
    )
    existing_members = service.select(
        "live_series_members",
        [
            ("select", "id,live_series_id,live_performance_id"),
            ("live_performance_id", ids_filter(list(ids_by_key.values()))),
        ],
    )
    result = Preflight(ids_by_key, len(existing_series), len(existing_members))
    conflicts: list[str] = []
    if result.existing_series:
        conflicts.append(f"series={result.existing_series}")
    if result.existing_memberships:
        conflicts.append(f"memberships={result.existing_memberships}")
    if conflicts:
        raise RuntimeError(
            "series重複候補があるため自動mergeせず停止します: "
            + ", ".join(conflicts)
        )
    return result


def cleanup(service: RestClient, created: Created) -> None:
    if created.series_ids_by_title:
        service.delete_ids("live_series", list(created.series_ids_by_title.values()))
        created.series_ids_by_title.clear()


def expected_memberships(
    preflight_result: Preflight, created: Created
) -> set[tuple[int, int, int]]:
    return {
        (
            created.series_ids_by_title[series_title],
            preflight_result.performance_ids_by_key[key],
            sort_order,
        )
        for series_title, members in SERIES_DEFINITIONS
        for sort_order, (key, _) in enumerate(members, start=1)
    }


def validate_relations(
    client: RestClient,
    preflight_result: Preflight,
    created: Created,
    *,
    anon: bool,
) -> None:
    series_ids = list(created.series_ids_by_title.values())
    series = client.select(
        "live_series",
        [
            ("select", "id,title,title_kana,sort_title,notes"),
            ("id", ids_filter(series_ids)),
        ],
    )
    if len(series) != 8:
        raise RuntimeError("anon" if anon else "service" + " series件数が8件ではありません。")
    expected_series = {
        (series_id, title)
        for title, series_id in created.series_ids_by_title.items()
    }
    actual_series = {(row.get("id"), row.get("title")) for row in series}
    if actual_series != expected_series:
        raise RuntimeError("series ID/titleが登録計画と一致しません。")
    if any(
        row.get("title_kana") is not None
        or row.get("sort_title") is not None
        or row.get("notes") is not None
        for row in series
    ):
        raise RuntimeError("series optional列がNULLではありません。")

    members = client.select(
        "live_series_members",
        [
            ("select", "live_series_id,live_performance_id,sort_order"),
            ("live_series_id", ids_filter(series_ids)),
        ],
    )
    if len(members) != 22:
        raise RuntimeError("series membership件数が22件ではありません。")
    actual_memberships = {
        (
            row.get("live_series_id"),
            row.get("live_performance_id"),
            row.get("sort_order"),
        )
        for row in members
    }
    if actual_memberships != expected_memberships(preflight_result, created):
        raise RuntimeError("series membershipまたはsort_orderが指定値と一致しません。")


def apply(service: RestClient, anon: RestClient, before: list[dict[str, object]]) -> None:
    preflight_result = preflight(service)
    created = Created()
    write_started = False
    try:
        for title, _ in SERIES_DEFINITIONS:
            write_started = True
            inserted = service.insert(
                "live_series",
                {
                    "title": title,
                    "title_kana": None,
                    "sort_title": None,
                    "notes": None,
                },
            )
            created.series_ids_by_title[title] = returned_id(inserted, "live_series")

        member_payload = [
            {
                "live_series_id": created.series_ids_by_title[series_title],
                "live_performance_id": preflight_result.performance_ids_by_key[key],
                "sort_order": sort_order,
            }
            for series_title, members in SERIES_DEFINITIONS
            for sort_order, (key, _) in enumerate(members, start=1)
        ]
        write_started = True
        inserted_members = service.insert("live_series_members", member_payload)
        if len(inserted_members) != 22:
            raise RuntimeError("membership INSERT件数が22件ではありません。")

        validate_relations(service, preflight_result, created, anon=False)
        if snapshot_performances(service) != before:
            raise RuntimeError("performance本体29件に意図しない変更があります。")
        validate_relations(anon, preflight_result, created, anon=True)
    except Exception as error:
        if not write_started:
            raise
        try:
            cleanup(service, created)
        except Exception as cleanup_error:
            raise PartialImportError(
                "series apply失敗後のcleanupにも失敗しました。部分投入の可能性があります。"
            ) from cleanup_error
        raise PartialImportError(
            "series applyは失敗し、追跡できた今回作成seriesをcleanupしました。"
            "応答を受け取れなかったINSERTがある場合は部分投入の可能性があります。"
        ) from error


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true", help="register series relations")
    parser.add_argument("--confirm", help="exact confirmation required with --apply")
    return parser


def main() -> int:
    if hasattr(sys.stdout, "reconfigure"):
        sys.stdout.reconfigure(encoding="utf-8")
        sys.stderr.reconfigure(encoding="utf-8")
    args = build_parser().parse_args()
    try:
        if args.apply:
            if args.confirm != CONFIRM_NAME:
                raise RuntimeError(f"applyには --confirm {CONFIRM_NAME} が必要です。")
        elif args.confirm is not None:
            raise RuntimeError("--confirmは--applyなしでは指定できません。")

        service = create_service_client()
        before = snapshot_performances(service)
        result = preflight(service)
        print(
            "preflight: PASS "
            f"(source_keys={len(result.performance_ids_by_key)}, "
            f"series={result.existing_series}, memberships={result.existing_memberships})"
        )
        if not args.apply:
            print("mode: DRY-RUN (database writes: 0)")
            print("plan: live_series=8, live_series_members=22")
            return 0

        apply(service, create_anon_client(), before)
        print("apply: PASS (live_series=8, live_series_members=22)")
        print("service validation: PASS")
        print("anon validation: PASS")
        print("performances unchanged: 29")
        return 0
    except (OSError, RuntimeError, ValueError) as error:
        print(f"series importerを停止しました: {error}", file=sys.stderr)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
