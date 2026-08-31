"""Guarded production backfill for release components and unified releases.

Default execution is read-only. Writes require ``--apply`` and the exact
confirmation token. Before the first mutation the complete relevant state is
written under private-data/backups/releases. Apply or validation failure
performs a compensating rollback limited to rows changed by this run.
"""

from __future__ import annotations

import argparse
import json
import sys
from collections import defaultdict
from datetime import datetime
from pathlib import Path
from typing import Any, Final
from zoneinfo import ZoneInfo


ROOT: Final = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / "scripts" / "song-model"))
sys.path.insert(0, str(ROOT / "scripts" / "thinkr"))

from apply_live_song_setlist_ready import RestClient, anon_client, service_client  # noqa: E402
from apply_song_model_backfill import canonical_hash, select_all  # noqa: E402


CONFIRM: Final = "RELEASE_MODEL_BACKFILL_001"
SNAPSHOT_ROOT: Final = ROOT / "private-data" / "backups" / "releases"
SNAPSHOT_TABLES: Final = (
    "songs",
    "release_groups",
    "releases",
    "release_components",
    "release_items",
    "release_sources",
    "song_digital_releases",
    "song_availabilities",
    "song_availability_sources",
    "reference_sources",
    "links",
)

EXISTING_COMPONENT_TARGETS: Final = {
    28: {
        "title": "CONNECTED OVER THE DIMENSION",
        "medium": "cd",
        "component_name": "CD",
        "source_id": 9,
        "availability_id": 5,
    },
    30: {
        "title": "水色の夜明け",
        "medium": "cd",
        "component_name": "CD",
        "source_id": None,
        "availability_id": None,
    },
}

PHYSICAL_PRODUCTS: Final = (
    {
        "title": "KOKO Virtual mini live「code／chord」vol.1・2 Blu-ray",
        "official_url": "https://findmestore.thinkr.jp/products/ktr-100-0235",
        "source_id": 15,
        "availability_ids": (11,),
        "release_kind": "video_release",
        "components": (("blu_ray", "Blu-ray", 190),),
    },
)

# The applied legacy constraint UNIQUE(release_id, song_id) cannot represent
# the same exact song in two components of one package. Keep this candidate out
# of the safe apply set until a separate schema decision is made.
DEFERRED_PHYSICAL_PRODUCTS: Final = (
    {
        "title": "V.W.P「現象II」Blu-ray / LIVE CD",
        "official_url": "https://findmestore.thinkr.jp/products/ktr-100-0184",
        "source_id": 24,
        "availability_ids": (12, 13),
        "reason": "legacy UNIQUE(release_id, song_id) blocks one exact song from belonging to both Blu-ray and LIVE CD components",
    },
)


def fetch_state(api: RestClient) -> dict[str, list[dict[str, Any]]]:
    return {table: select_all(api, table) for table in SNAPSHOT_TABLES}


def snapshot_path() -> Path:
    SNAPSHOT_ROOT.mkdir(parents=True, exist_ok=True)
    stamp = datetime.now(ZoneInfo("Asia/Tokyo")).strftime("%Y%m%d-%H%M%S")
    path = SNAPSHOT_ROOT / f"before-release-model-backfill-{stamp}.json"
    sequence = 1
    while path.exists():
        path = SNAPSHOT_ROOT / f"before-release-model-backfill-{stamp}-{sequence}.json"
        sequence += 1
    return path


def write_snapshot(path: Path, state: dict[str, list[dict[str, Any]]]) -> None:
    document = {
        "created_at": datetime.now(ZoneInfo("Asia/Tokyo")).isoformat(),
        "operation": CONFIRM,
        "counts": {table: len(rows) for table, rows in state.items()},
        "hashes": {table: canonical_hash(rows) for table, rows in state.items()},
        "tables": state,
    }
    with path.open("x", encoding="utf-8") as stream:
        json.dump(document, stream, ensure_ascii=False, indent=2)
        stream.write("\n")


def insert_many(api: RestClient, table: str, payloads: list[dict[str, Any]]) -> list[dict[str, Any]]:
    if not payloads:
        return []
    result = api.request(table, method="POST", payload=payloads, prefer="return=representation")
    if not isinstance(result, list) or len(result) != len(payloads):
        raise RuntimeError(f"{table}: INSERT read-back mismatch")
    return [row for row in result if isinstance(row, dict)]


def patch_release_items(
    api: RestClient,
    release_id: int,
    payload: dict[str, Any],
) -> list[dict[str, Any]]:
    result = api.request(
        "release_items",
        method="PATCH",
        params=[("release_id", f"eq.{release_id}")],
        payload=payload,
        prefer="return=representation",
    )
    if not isinstance(result, list):
        raise RuntimeError(f"release {release_id}: PATCH read-back mismatch")
    return [row for row in result if isinstance(row, dict)]


def patch_item(api: RestClient, item_id: int, payload: dict[str, Any]) -> None:
    result = api.request(
        "release_items",
        method="PATCH",
        params=[("id", f"eq.{item_id}")],
        payload=payload,
        prefer="return=representation",
    )
    if not isinstance(result, list) or len(result) != 1:
        raise RuntimeError(f"release_item {item_id}: rollback PATCH failed")


def delete_ids(api: RestClient, table: str, ids: list[int]) -> None:
    for offset in range(0, len(ids), 80):
        api.delete_ids(table, ids[offset:offset + 80])


def value_text(value: Any) -> str | None:
    return value.strip() if isinstance(value, str) and value.strip() else None


def build_plan(state: dict[str, list[dict[str, Any]]]) -> dict[str, Any]:
    if len(state["songs"]) != 405:
        raise RuntimeError("songs inventory drifted")
    if len(state["release_groups"]) != 26 or len(state["releases"]) != 42:
        raise RuntimeError("legacy release inventory drifted")
    if len(state["release_items"]) != 235 or len(state["song_digital_releases"]) != 51:
        raise RuntimeError("legacy release item/digital inventory drifted")
    if len(state["song_availabilities"]) != 13:
        raise RuntimeError("availability inventory drifted")
    if state["release_components"] or state["release_sources"]:
        raise RuntimeError("release backfill targets are no longer empty")

    songs = {int(row["id"]): row for row in state["songs"]}
    releases = {int(row["id"]): row for row in state["releases"]}
    references = {int(row["id"]): row for row in state["reference_sources"]}
    availabilities = {int(row["id"]): row for row in state["song_availabilities"]}
    relations_by_availability: dict[int, set[int]] = defaultdict(set)
    for relation in state["song_availability_sources"]:
        relations_by_availability[int(relation["song_availability_id"])].add(
            int(relation["reference_source_id"])
        )

    existing_urls = {
        value_text(row.get("official_url"))
        for row in state["releases"]
        if value_text(row.get("official_url"))
    }
    digital_urls = [value_text(row.get("official_url")) for row in state["song_digital_releases"]]
    if any(url is None for url in digital_urls) or len(set(digital_urls)) != 51:
        raise RuntimeError("digital official URLs are missing or duplicated")
    if existing_urls.intersection(set(digital_urls)):
        raise RuntimeError("digital release overlaps an existing release URL")

    reference_by_url = {
        value_text(row.get("url")): int(row["id"])
        for row in state["reference_sources"]
        if value_text(row.get("url"))
    }
    digital: list[dict[str, Any]] = []
    digital_group_keys: set[tuple[str, str | None]] = set()
    for legacy in sorted(state["song_digital_releases"], key=lambda row: int(row["id"])):
        song_id = int(legacy["song_id"])
        song = songs.get(song_id)
        if song is None:
            raise RuntimeError(f"digital release {legacy['id']}: song missing")
        title = value_text(legacy.get("title")) or value_text(song.get("title"))
        if not title:
            raise RuntimeError(f"digital release {legacy['id']}: no safe title")
        group_key = (title, legacy.get("release_date"))
        if group_key in digital_group_keys:
            raise RuntimeError(f"digital release {legacy['id']}: ambiguous duplicate title/date")
        digital_group_keys.add(group_key)
        url = str(legacy["official_url"])
        digital.append({
            "legacy_id": int(legacy["id"]),
            "song_id": song_id,
            "title": title,
            "artist_credit": song.get("artist_credit"),
            "release_date": legacy.get("release_date"),
            "jacket_image_url": legacy.get("jacket_image_url"),
            "official_url": url,
            "notes": legacy.get("notes"),
            "reference_source_id": reference_by_url.get(url),
        })

    for release_id, target in EXISTING_COMPONENT_TARGETS.items():
        release = releases.get(release_id)
        if release is None or release.get("title") != target["title"]:
            raise RuntimeError(f"existing component release {release_id}: identity drifted")
        if release_id == 30 and release.get("release_type") != "cd":
            raise RuntimeError("release 30 is no longer explicitly cd")
        source_id = target["source_id"]
        if source_id is not None and references.get(int(source_id), {}).get("title") != target["title"]:
            raise RuntimeError(f"release {release_id}: source identity drifted")
        availability_id = target["availability_id"]
        if availability_id is not None:
            availability = availabilities.get(int(availability_id))
            if (
                availability is None
                or availability.get("platform") != "CD"
                or availability.get("is_current") is not False
                or int(source_id) not in relations_by_availability[int(availability_id)]
            ):
                raise RuntimeError(f"release {release_id}: physical evidence drifted")

    for product in PHYSICAL_PRODUCTS:
        if product["official_url"] in existing_urls or product["official_url"] in set(digital_urls):
            raise RuntimeError(f"physical product already exists: {product['official_url']}")
        source = references.get(int(product["source_id"]))
        if source is None or source.get("url") != product["official_url"] or source.get("title") != product["title"]:
            raise RuntimeError(f"physical source drifted: {product['title']}")
        for availability_id in product["availability_ids"]:
            availability = availabilities.get(int(availability_id))
            if (
                availability is None
                or availability.get("content_type") != "live"
                or availability.get("media_type") != "physical"
                or availability.get("is_current") is not False
                or int(product["source_id"]) not in relations_by_availability[int(availability_id)]
            ):
                raise RuntimeError(f"physical availability {availability_id}: evidence drifted")
        for _medium, _name, song_id in product["components"]:
            if int(song_id) not in songs:
                raise RuntimeError(f"physical product song {song_id}: missing")

    for product in DEFERRED_PHYSICAL_PRODUCTS:
        source = references.get(int(product["source_id"]))
        if source is None or source.get("url") != product["official_url"] or source.get("title") != product["title"]:
            raise RuntimeError(f"deferred physical source drifted: {product['title']}")
        for availability_id in product["availability_ids"]:
            availability = availabilities.get(int(availability_id))
            if availability is None or availability.get("is_current") is not False:
                raise RuntimeError(f"deferred availability {availability_id}: drifted")

    existing_items = [
        row for row in state["release_items"]
        if int(row["release_id"]) in EXISTING_COMPONENT_TARGETS
    ]
    return {
        "digital": digital,
        "physical": list(PHYSICAL_PRODUCTS),
        "deferred_physical": list(DEFERRED_PHYSICAL_PRODUCTS),
        "existing_component_targets": EXISTING_COMPONENT_TARGETS,
        "existing_item_ids": sorted(int(row["id"]) for row in existing_items),
        "digital_source_relations": sum(row["reference_source_id"] is not None for row in digital),
    }


def plan_summary(plan: dict[str, Any]) -> dict[str, Any]:
    physical_component_count = sum(len(product["components"]) for product in plan["physical"])
    return {
        "existing_release_components": len(plan["existing_component_targets"]),
        "existing_release_items_to_attach": len(plan["existing_item_ids"]),
        "digital_release_groups": len(plan["digital"]),
        "digital_releases": len(plan["digital"]),
        "digital_components": len(plan["digital"]),
        "digital_items": len(plan["digital"]),
        "physical_release_groups": len(plan["physical"]),
        "physical_releases": len(plan["physical"]),
        "physical_components": physical_component_count,
        "physical_items": physical_component_count,
        "release_source_relations": (
            plan["digital_source_relations"]
            + sum(target["source_id"] is not None for target in plan["existing_component_targets"].values())
            + len(plan["physical"])
        ),
        "deferred_physical_products": len(plan["deferred_physical"]),
        "deferred_physical_reasons": [row["reason"] for row in plan["deferred_physical"]],
    }


def apply_plan(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
) -> tuple[dict[str, list[int]], list[int]]:
    inserted: dict[str, list[int]] = defaultdict(list)
    patched_existing_items: list[int] = []
    try:
        new_group_specs = [
            {"key": (row["title"], row["release_date"]), "payload": {
                "title": row["title"],
                "release_date": row["release_date"],
                "notes": row["notes"],
            }}
            for row in plan["digital"]
        ] + [
            {"key": (product["title"], None), "payload": {
                "title": product["title"],
                "release_date": None,
                "notes": None,
            }}
            for product in plan["physical"]
        ]
        group_rows = insert_many(api, "release_groups", [spec["payload"] for spec in new_group_specs])
        inserted["release_groups"] = [int(row["id"]) for row in group_rows]
        group_ids = {
            (str(row["title"]), row.get("release_date")): int(row["id"])
            for row in group_rows
        }
        if len(group_ids) != len(new_group_specs):
            raise RuntimeError("new release group identity is not unique")

        release_payloads = [
            {
                "release_group_id": group_ids[(row["title"], row["release_date"])],
                "title": row["title"],
                "release_type": "digital_single",
                "release_kind": "single",
                "artist_credit": row["artist_credit"],
                "release_date": row["release_date"],
                "jacket_image_url": row["jacket_image_url"],
                "official_url": row["official_url"],
                "notes": row["notes"],
                "edition_name": "digital",
                "is_primary_edition": True,
            }
            for row in plan["digital"]
        ] + [
            {
                "release_group_id": group_ids[(product["title"], None)],
                "title": product["title"],
                "release_type": "other",
                "release_kind": product["release_kind"],
                "artist_credit": None,
                "release_date": None,
                "jacket_image_url": None,
                "official_url": product["official_url"],
                "notes": None,
                "edition_name": None,
                "is_primary_edition": True,
            }
            for product in plan["physical"]
        ]
        release_rows = insert_many(api, "releases", release_payloads)
        inserted["releases"] = [int(row["id"]) for row in release_rows]
        release_ids_by_url = {str(row["official_url"]): int(row["id"]) for row in release_rows}
        if len(release_ids_by_url) != len(release_rows):
            raise RuntimeError("new release official URLs are not unique")

        component_specs: list[dict[str, Any]] = []
        for release_id, target in plan["existing_component_targets"].items():
            component_specs.append({
                "release_id": int(release_id),
                "medium": target["medium"],
                "component_name": target["component_name"],
                "component_number": 1,
                "sort_order": 1,
                "catalog_number": None,
                "notes": None,
            })
        for row in plan["digital"]:
            component_specs.append({
                "release_id": release_ids_by_url[row["official_url"]],
                "medium": "digital",
                "component_name": "digital",
                "component_number": 1,
                "sort_order": 1,
                "catalog_number": None,
                "notes": None,
            })
        for product in plan["physical"]:
            release_id = release_ids_by_url[product["official_url"]]
            for order, (medium, name, _song_id) in enumerate(product["components"], 1):
                component_specs.append({
                    "release_id": release_id,
                    "medium": medium,
                    "component_name": name,
                    "component_number": order,
                    "sort_order": order,
                    "catalog_number": None,
                    "notes": None,
                })
        component_rows = insert_many(api, "release_components", component_specs)
        inserted["release_components"] = [int(row["id"]) for row in component_rows]
        components_by_release_order = {
            (int(row["release_id"]), int(row["sort_order"])): int(row["id"])
            for row in component_rows
        }
        if len(components_by_release_order) != len(component_rows):
            raise RuntimeError("new component identity is not unique")

        for release_id in plan["existing_component_targets"]:
            component_id = components_by_release_order[(int(release_id), 1)]
            patched = patch_release_items(api, int(release_id), {"release_component_id": component_id})
            patched_ids = sorted(int(row["id"]) for row in patched)
            expected_ids = sorted(
                int(row["id"])
                for row in before["release_items"]
                if int(row["release_id"]) == int(release_id)
            )
            if patched_ids != expected_ids:
                raise RuntimeError(f"release {release_id}: item component PATCH mismatch")
            patched_existing_items.extend(patched_ids)

        songs = {int(row["id"]): row for row in before["songs"]}
        item_payloads = [
            {
                "release_group_id": group_ids[(row["title"], row["release_date"])],
                "release_id": release_ids_by_url[row["official_url"]],
                "release_component_id": components_by_release_order[(release_ids_by_url[row["official_url"]], 1)],
                "song_id": row["song_id"],
                "disc_number": None,
                "track_number": 1,
                "sort_order": 1,
                "track_title": row["title"],
                "track_artist": row["artist_credit"],
                "title_override": None,
                "notes": None,
            }
            for row in plan["digital"]
        ]
        for product in plan["physical"]:
            release_id = release_ids_by_url[product["official_url"]]
            group_id = group_ids[(product["title"], None)]
            for order, (_medium, _name, song_id) in enumerate(product["components"], 1):
                song = songs[int(song_id)]
                item_payloads.append({
                    "release_group_id": group_id,
                    "release_id": release_id,
                    "release_component_id": components_by_release_order[(release_id, order)],
                    "song_id": int(song_id),
                    "disc_number": None,
                    "track_number": None,
                    "sort_order": 1,
                    "track_title": song.get("title"),
                    "track_artist": song.get("artist_credit"),
                    "title_override": None,
                    "notes": None,
                })
        item_rows = insert_many(api, "release_items", item_payloads)
        inserted["release_items"] = [int(row["id"]) for row in item_rows]

        source_payloads: list[dict[str, Any]] = []
        for row in plan["digital"]:
            if row["reference_source_id"] is not None:
                source_payloads.append({
                    "release_id": release_ids_by_url[row["official_url"]],
                    "reference_source_id": row["reference_source_id"],
                    "locator": None,
                    "evidence_note": "legacy digital releaseの公式release page",
                    "sort_order": 1,
                })
        for release_id, target in plan["existing_component_targets"].items():
            if target["source_id"] is not None:
                source_payloads.append({
                    "release_id": int(release_id),
                    "reference_source_id": int(target["source_id"]),
                    "locator": None,
                    "evidence_note": "公式release pageによりCD収録を確認",
                    "sort_order": 1,
                })
        for product in plan["physical"]:
            source_payloads.append({
                "release_id": release_ids_by_url[product["official_url"]],
                "reference_source_id": int(product["source_id"]),
                "locator": None,
                "evidence_note": "公式商品ページによりLIVE商品の媒体と収録を確認",
                "sort_order": 1,
            })
        source_rows = insert_many(api, "release_sources", source_payloads)
        inserted["release_sources"] = [int(row["id"]) for row in source_rows]
        return inserted, patched_existing_items
    except Exception as error:
        rollback(api, before, inserted, patched_existing_items)
        raise RuntimeError(f"backfill failed ({error}); compensating rollback completed") from None


def rollback(
    api: RestClient,
    before: dict[str, list[dict[str, Any]]],
    inserted: dict[str, list[int]],
    patched_existing_items: list[int],
) -> None:
    before_items = {int(row["id"]): row for row in before["release_items"]}
    for item_id in patched_existing_items:
        row = before_items[item_id]
        patch_item(api, item_id, {
            "release_component_id": row.get("release_component_id"),
            "sort_order": row.get("sort_order"),
        })
    delete_ids(api, "release_sources", inserted.get("release_sources", []))
    delete_ids(api, "release_items", inserted.get("release_items", []))
    delete_ids(api, "release_components", inserted.get("release_components", []))
    delete_ids(api, "releases", inserted.get("releases", []))
    delete_ids(api, "release_groups", inserted.get("release_groups", []))


def existing_rows_unchanged(
    before: list[dict[str, Any]],
    after: list[dict[str, Any]],
    *,
    ignored_fields: set[str] | None = None,
) -> bool:
    ignored = ignored_fields or set()
    after_by_id = {int(row["id"]): row for row in after}
    for original in before:
        current = after_by_id.get(int(original["id"]))
        if current is None:
            return False
        original_view = {key: value for key, value in original.items() if key not in ignored}
        current_view = {key: value for key, value in current.items() if key not in ignored}
        if original_view != current_view:
            return False
    return True


def validate_anon(expected_component_count: int) -> dict[str, Any]:
    anon = anon_client()
    components = select_all(anon, "release_components")
    if len(components) != expected_component_count:
        raise RuntimeError("anon release_components SELECT does not match public metadata")
    try:
        sources = select_all(anon, "release_sources")
    except RuntimeError:
        return {"release_components": "selectable", "release_sources": "denied"}
    if sources:
        raise RuntimeError("anon can read private release_sources")
    return {"release_components": "selectable", "release_sources": "empty_by_rls"}


def validate(
    before: dict[str, list[dict[str, Any]]],
    after: dict[str, list[dict[str, Any]]],
    plan: dict[str, Any],
    inserted: dict[str, list[int]],
) -> dict[str, Any]:
    expected = plan_summary(plan)
    immutable = (
        "songs", "song_digital_releases", "song_availabilities",
        "song_availability_sources", "reference_sources", "links",
    )
    for table in immutable:
        if canonical_hash(before[table]) != canonical_hash(after[table]):
            raise RuntimeError(f"{table}: immutable history changed")
    if not existing_rows_unchanged(before["release_groups"], after["release_groups"]):
        raise RuntimeError("existing release_groups changed")
    if not existing_rows_unchanged(before["releases"], after["releases"]):
        raise RuntimeError("existing releases changed")
    if not existing_rows_unchanged(
        before["release_items"], after["release_items"],
        ignored_fields={"release_component_id", "sort_order"},
    ):
        raise RuntimeError("legacy release_item fields changed")

    if len(after["release_groups"]) != 26 + expected["digital_release_groups"] + expected["physical_release_groups"]:
        raise RuntimeError("release_group count mismatch")
    if len(after["releases"]) != 42 + expected["digital_releases"] + expected["physical_releases"]:
        raise RuntimeError("release count mismatch")
    expected_components = expected["existing_release_components"] + expected["digital_components"] + expected["physical_components"]
    if len(after["release_components"]) != expected_components:
        raise RuntimeError("release component count mismatch")
    expected_items = 235 + expected["digital_items"] + expected["physical_items"]
    if len(after["release_items"]) != expected_items:
        raise RuntimeError("release item count mismatch")
    if len(after["release_sources"]) != expected["release_source_relations"]:
        raise RuntimeError("release source count mismatch")

    components = {int(row["id"]): row for row in after["release_components"]}
    component_signatures = [
        (int(row["release_id"]), int(row["sort_order"]))
        for row in after["release_components"]
    ]
    if len(component_signatures) != len(set(component_signatures)):
        raise RuntimeError("duplicate release component")
    for item in after["release_items"]:
        component_id = item.get("release_component_id")
        if component_id is not None:
            component = components.get(int(component_id))
            if component is None or int(component["release_id"]) != int(item["release_id"]):
                raise RuntimeError("release item/component edition mismatch")

    after_releases_by_url = {
        str(row["official_url"]): row
        for row in after["releases"]
        if row.get("official_url") is not None
    }
    after_items_by_release: dict[int, list[dict[str, Any]]] = defaultdict(list)
    for item in after["release_items"]:
        after_items_by_release[int(item["release_id"])].append(item)
    for digital in plan["digital"]:
        release = after_releases_by_url.get(digital["official_url"])
        if release is None or release.get("release_kind") != "single":
            raise RuntimeError(f"digital release {digital['legacy_id']}: missing")
        items = after_items_by_release[int(release["id"])]
        if len(items) != 1 or int(items[0]["song_id"]) != int(digital["song_id"]):
            raise RuntimeError(f"digital release {digital['legacy_id']}: exact song mismatch")

    for release_id in plan["existing_component_targets"]:
        items = after_items_by_release[int(release_id)]
        if not items or any(item.get("release_component_id") is None for item in items):
            raise RuntimeError(f"existing release {release_id}: component backfill incomplete")

    source_signatures = [
        (int(row["release_id"]), int(row["reference_source_id"]))
        for row in after["release_sources"]
    ]
    if len(source_signatures) != len(set(source_signatures)):
        raise RuntimeError("duplicate release source relation")
    if sum(item.get("song_id") is None for item in after["release_items"]) != 120:
        raise RuntimeError("legacy NULL song items changed or new NULL items were added")
    if len(inserted["release_items"]) != expected["digital_items"] + expected["physical_items"]:
        raise RuntimeError("inserted release item tracking mismatch")

    edition_counts = {
        release_id: len(after_items_by_release.get(release_id, []))
        for release_id in (8, 9)
    }
    if edition_counts != {8: 14, 9: 1}:
        raise RuntimeError(f"edition track scope mismatch: {edition_counts}")
    componentless_releases = [
        int(row["id"])
        for row in after["releases"]
        if not any(int(component["release_id"]) == int(row["id"]) for component in after["release_components"])
    ]
    if 8 not in componentless_releases or 9 not in componentless_releases:
        raise RuntimeError("legacy fallback fixture drifted")

    return {
        "counts": {table: len(rows) for table, rows in after.items()},
        "edition_track_counts": edition_counts,
        "componentless_release_count": len(componentless_releases),
        "rls": validate_anon(expected_components),
    }


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--apply", action="store_true")
    parser.add_argument("--confirm")
    args = parser.parse_args()

    api = service_client()
    before = fetch_state(api)
    plan = build_plan(before)
    print(json.dumps({"mode": "dry-run", "plan": plan_summary(plan)}, ensure_ascii=False, indent=2))
    if not args.apply:
        return
    if args.confirm != CONFIRM:
        print(f"write refused: require --apply --confirm {CONFIRM}", file=sys.stderr)
        raise SystemExit(2)

    path = snapshot_path()
    write_snapshot(path, before)
    inserted: dict[str, list[int]] = defaultdict(list)
    patched_items: list[int] = []
    try:
        inserted, patched_items = apply_plan(api, before, plan)
        after = fetch_state(api)
        result = validate(before, after, plan, inserted)
    except Exception:
        if inserted or patched_items:
            rollback(api, before, inserted, patched_items)
        raise
    print(json.dumps({
        "mode": "applied",
        "snapshot": str(path),
        "inserted": {table: len(ids) for table, ids in inserted.items()},
        "patched_existing_release_items": len(patched_items),
        "validation": result,
    }, ensure_ascii=False, indent=2))


if __name__ == "__main__":
    main()
