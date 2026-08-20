"use client";

import Link from "next/link";
import { startTransition, useEffect, useMemo, useState } from "react";
import type { ReleaseCard } from "./page";

const preferredReleaseTypeOrder = [
  "album",
  "single",
  "digital_single",
  "ep",
  "cd",
  "compilation",
  "other",
];

function hasValue(value: string | null | undefined) {
  return Boolean(value && value.trim() && value.trim() !== "-");
}

function formatDate(date: string | null) {
  if (!date) {
    return null;
  }

  return date.replaceAll("-", ".");
}

function formatReleaseType(type: string | null) {
  switch (type) {
    case "digital_single":
      return "DIGITAL SINGLE";
    case "single":
      return "SINGLE";
    case "ep":
      return "EP";
    case "album":
      return "ALBUM";
    case "cd":
      return "CD";
    case "compilation":
      return "COMPILATION";
    case "other":
      return "OTHER";
    default:
      return type?.toUpperCase() ?? "RELEASE";
  }
}

function getReleaseTypeLabel(type: string) {
  return formatReleaseType(type);
}

function uniqueReleaseTypes(releases: ReleaseCard[]) {
  const values = Array.from(
    new Set(
      releases
        .map((release) => release.releaseType)
        .filter((type): type is string => Boolean(type))
    )
  );

  return values.sort((a, b) => {
    const aIndex = preferredReleaseTypeOrder.indexOf(a);
    const bIndex = preferredReleaseTypeOrder.indexOf(b);

    if (aIndex !== -1 && bIndex !== -1) {
      return aIndex - bIndex;
    }

    if (aIndex !== -1) {
      return -1;
    }

    if (bIndex !== -1) {
      return 1;
    }

    return a.localeCompare(b, "ja");
  });
}

export default function ReleasesList({
  releases,
}: {
  releases: ReleaseCard[];
}) {
  const releaseTypes = useMemo(() => uniqueReleaseTypes(releases), [releases]);
  const [enabledTypes, setEnabledTypes] = useState<string[]>([]);

  useEffect(() => {
    startTransition(() => {
      setEnabledTypes(releaseTypes);
    });
  }, [releaseTypes]);

  const allTypesEnabled = enabledTypes.length === releaseTypes.length;

  function toggleType(type: string) {
    setEnabledTypes((current) => {
      if (current.includes(type)) {
        return current.filter((item) => item !== type);
      }

      return [...current, type];
    });
  }

  function toggleAllTypes() {
    if (allTypesEnabled) {
      setEnabledTypes([]);
      return;
    }

    setEnabledTypes(releaseTypes);
  }

  const filteredReleases = useMemo(() => {
    return releases.filter((release) => {
      return (
        release.releaseType !== null &&
        enabledTypes.includes(release.releaseType)
      );
    });
  }, [releases, enabledTypes]);

  return (
    <>
      <section className="mt-8 border-y border-black/15 py-5">
        <div className="flex flex-wrap items-center gap-2">
          <p className="section-label mr-2 text-black/45">TYPE FILTER</p>

          <button
            type="button"
            onClick={toggleAllTypes}
            className="border border-black/25 px-2.5 py-1 text-[11px] text-black/60 transition hover:border-black hover:text-black"
          >
            {allTypesEnabled ? "ALL OFF" : "ALL ON"}
          </button>

          {releaseTypes.map((type) => {
            const enabled = enabledTypes.includes(type);

            return (
              <button
                key={type}
                type="button"
                onClick={() => toggleType(type)}
                className={
                  enabled
                    ? "border border-black bg-black px-3 py-1.5 text-xs tracking-[0.08em] text-[#f5f5f2]"
                    : "border border-black/20 px-3 py-1.5 text-xs tracking-[0.08em] text-black/40 transition hover:border-black hover:text-black"
                }
              >
                {getReleaseTypeLabel(type)}
              </button>
            );
          })}
        </div>

        <p className="mt-5 text-xs text-black/45">
          {filteredReleases.length} / {releases.length} RELEASES
        </p>
      </section>

      <section className="mt-8">
        <div className="grid grid-cols-2 gap-x-4 gap-y-9 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
          {filteredReleases.map((release) => {
            const releaseDate = formatDate(release.releaseDate);
            const hasImage = hasValue(release.jacketImageUrl);
            const showEditions = release.editions.length > 1;

            return (
              <Link
                key={`${release.sourceType}-${release.groupId}`}
                href={release.href}
                className="group block"
              >
                <div className="flex aspect-square items-center justify-center overflow-hidden border border-black/10 bg-black/[0.02] transition group-hover:border-black/35">
                  {hasImage ? (
                    <img
                      src={release.jacketImageUrl ?? ""}
                      alt=""
                      loading="lazy"
                      decoding="async"
                      className="max-h-full max-w-full transition group-hover:scale-[1.02]"
                    />
                  ) : (
                    <div className="p-4 text-center">
                      <p className="section-label text-black/25">IMAGE</p>
                      <p className="mt-2 text-xs leading-5 text-black/30">
                        情報がありません。
                      </p>
                    </div>
                  )}
                </div>

                <div className="mt-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[10px] uppercase tracking-[0.12em] text-black/35">
                      {formatReleaseType(release.releaseType)}
                    </span>

                    {releaseDate ? (
                      <span className="text-[10px] tracking-[0.08em] text-black/35">
                        {releaseDate}
                      </span>
                    ) : null}
                  </div>

                  <p className="mt-1.5 break-words text-sm font-medium leading-5 text-black underline-offset-4 group-hover:underline">
                    {release.title}
                  </p>

                  {hasValue(release.tagline) ? (
                    <p className="mt-1 line-clamp-2 text-xs leading-5 text-black/45">
                      {release.tagline}
                    </p>
                  ) : null}

                  {hasValue(release.artistCredit) ? (
                    <p className="mt-1 text-xs leading-5 text-black/40">
                      {release.artistCredit}
                    </p>
                  ) : null}

                  {showEditions ? (
                    <p className="mt-1 text-[10px] tracking-[0.1em] text-black/30">
                      {release.editions.join(" / ")}
                    </p>
                  ) : null}
                </div>
              </Link>
            );
          })}
        </div>

        {filteredReleases.length === 0 ? (
          <p className="border-y border-black/10 py-10 text-sm text-black/45">
            条件に一致する収録作品がありません。
          </p>
        ) : null}
      </section>
    </>
  );
}