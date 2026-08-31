# Song / work / version model redesign draft

> Reviewed implementation draft. The human decisions in this document's
> approved target sections are reflected in the accompanying additive SQL,
> but none of the SQL has been applied to Supabase. This document does not
> replace the human-confirmed operational rules in `docs/data-rules.md`.

## Goal

Separate three concepts that currently share `songs` columns:

1. **Work** — the underlying musical work, represented by `song_groups`.
2. **Exact version** — a particular performance, arrangement, language, or
   officially named version, represented by `songs`.
3. **Credits** — either work/source metadata or credits specific to an exact
   version.

This preserves the existing 405 songs and their verification history while
giving a safe destination for facts such as the arranger of
`BREATHE(Rearranged ver.)`.

## Recommended target schema

### `song_groups`: work-level metadata

Existing membership remains unchanged: every `songs.song_group_id` identifies
the work to which the exact song/version belongs.

| Column | Meaning | Notes |
|---|---|---|
| `work_provenance` | `original`, `cover`, or `other` | Confirmed work-origin vocabulary. It must not encode collaboration or version type. |
| `work_artist_credit` | Underlying work's credited artist/act | Transitional display-preserving text. |
| `work_vocal_credit` | Underlying work's vocal credit | Not the exact-version vocalist. |
| `work_lyricist_credit` | Underlying work lyricist | Transitional display-preserving text. |
| `work_composer_credit` | Underlying work composer | Transitional display-preserving text. |
| `work_arranger_credit` | Underlying work arranger | Transitional display-preserving text. |
| `base_song_id` | Optional FK to a `songs.id` in this group | Metadata base only; distinct from `is_primary_version`. |

`base_song_id` is nullable. It is appropriate only when a DB row is a useful
base for the work. A safe automatic candidate is a multi-song group with one
song that is both `is_primary_version = true` and legacy
`version_type = 'standard'`. Single-song groups remain NULL; a cover whose
source song is outside this DB, or a group whose historical relationship is
not established, also remains NULL.

The draft uses `ON DELETE RESTRICT` and deferred membership triggers:

```
songs.song_group_id ──> song_groups.id
song_groups.base_song_id ──> songs.id
```

This circular *reference shape* is safe because both relations already exist
only after their rows are created, `base_song_id` starts NULL, and the trigger
requires the chosen song to be in the same group. It does **not** create a
recursive song-to-song lineage.

### `songs`: exact version

Keep these on `songs`:

- `artist_credit` — canonical display string for the exact version.
- `first_*`, `first_full_*`, `tie_up`, `discovery_category`, availability,
  version name, links, releases, and live-setlist relations.
- `performance_context` — `studio`, `live`, or `other`.
- `version_kind` — an application-controlled text value. Preferred initial
  values are `standard`, `rearranged`, `acoustic`, `solo`, `multilingual`,
  `alternate`, and `other`.

`version_name` remains the exact human-facing title such as `Rearranged ver.`
or `SINKA LIVE ver.`. `version_kind` deliberately uses a non-empty text CHECK
rather than a database enum: the existing data has only 40 non-NULL names and
the vocabulary is still evolving. `Twitter`, `SINKA`, and pre-formation are
not new kinds: retain their existing display text in `version_name`, use
`alternate` when a version-kind label is needed, and assign
`performance_context` only when the source establishes studio, live, or other.

### `song_credits`: exact-version credit rows

| Column | Meaning |
|---|---|
| `song_id` | Exact version being credited; FK with `ON DELETE CASCADE` |
| `role` | Initial values: `vocal`, `lyricist`, `composer`, `arranger` |
| `credit_name` | Display-preserving name; initially no creator-master FK |
| `sort_order` | Credit order within a role |
| `note` | Optional scope or qualification |

The database accepts future non-empty roles rather than an enum. The UI and
data rules can maintain a recommended vocabulary while roles such as
`translator`, `additional_lyrics`, `producer`, and `remix` become possible
without DDL.

`artist_credit` remains separate. It is the canonical display credit, while
`song_credits(role = 'vocal')` permits structured version-specific vocal
credits and future creator search.

### Verification and source relations

The recommended first migration is a hybrid, not a rewrite of the existing
append-only `song_field_checks` history.

| Target | Check table | Source relation |
|---|---|---|
| Existing `songs` fields | `song_field_checks` | `song_field_check_sources` |
| `song_groups` work fields | `song_group_field_checks` | `song_group_field_check_sources` |
| `song_credits` rows | `song_credit_checks` | `song_credit_check_sources` |

Each check follows the existing rules: checker type is independent from
certainty; AI and human history is append-only; a snapshot must match the
current value to count as current; SQL NULL in a group field check means
"checked and NULL". Credit checks snapshot the full meaningful credit tuple
(`role`, `credit_name`, `sort_order`) because the row itself cannot represent
an absent credit.

The three explicit source relation tables intentionally reuse
`reference_sources` and retain normal foreign keys. A single polymorphic
`target_type/target_id` source table would be shorter, but would lose database
FK protection across the three target entity types.

All new check/source tables are management-only: RLS enabled, no
anon/authenticated privileges, service role only. `song_credits` is also
management-only in the first migration; a later public UI migration can add a
read policy only after presentation is reviewed. New columns on `song_groups`
follow that table's existing public-data RLS policy.

## Current-to-target mapping

| Current field | Target during transition | Final responsibility |
|---|---|---|
| `songs.song_group_id` | unchanged | Work membership |
| `songs.is_primary_version` | unchanged | Public/UI representative only |
| `songs.song_type` | copied to `song_groups.work_provenance` after review | Work provenance only (`original`, `cover`, `other`) |
| `songs.version_type` | retained; backfilled to `performance_context` + `version_kind` | Legacy compatibility, then deprecated |
| `songs.version_name` | unchanged | Human-facing exact-version name |
| `songs.artist_credit` | unchanged | Exact-version canonical display credit |
| `songs.original_*` | retained; copied to work fields only after reviewed agreement (`original_artist='-'` becomes work NULL) | Legacy/external-source compatibility |
| version-specific `original_*` misuse | no automatic overwrite | Move to `song_credits` after human-reviewed backfill |

No legacy column is dropped, renamed, or made nullable/non-nullable in the
draft migrations.

## Immediate application compatibility

The first three song-model migrations are additive. Existing public and
management pages select only their current legacy fields and do not query
`song_credits`, so applying the schema alone leaves their returned shapes and
RLS access unchanged. The new `song_credits` and verification tables are
management-only until a separately reviewed UI migration introduces reads and
the corresponding public policy. No TypeScript application type change is
required before that UI phase.

## `song_type` migration assessment

The current values are `original` 131, `cover` 246, `collaboration` 16, and
`variant` 12.

| Current value | Proposed group provenance | Estimated handling |
|---|---|---|
| `original` | `original` | 131 rows can be grouped and checked for group consistency |
| `cover` | `cover` | 246 rows can be grouped and checked for group consistency |
| `variant` | Inherit work provenance from group/base | 12 rows; never map `variant` to provenance directly |
| `collaboration` | Inherit when a reviewed same-group base establishes provenance; otherwise human/source review | 16 rows; it combines several meanings |

For `collaboration`, the current audit finds at least these categories:

- **Existing-work collaboration / derived version:** examples include
  `BREATHE(Rearranged ver.)` and the pre-formation `祭壇` entry. These inherit
  the group work provenance.
- **Cover with a collaboration performer or musical isotope:** examples such
  as `異星にいこうね`, `とこしずめ`, and `回想` should normally be `cover` at
  work level.
- **New collaborative work:** examples such as `プロトコール` and `機械の声`
  may be `original`, but require review of the underlying work provenance.
- **Live collaboration without an in-DB base:** `ミラージュコード` cannot be
  inferred from its single current row; it requires a human decision or
  stronger source data.

This means all 12 `variant` rows are heuristic candidates for inheritance, but
the 16 `collaboration` rows must not be bulk-classified solely from their
current `song_type`.

## Version model options

| Option | Design | Benefits | Cost / recommendation |
|---|---|---|---|
| A | One `version_kind` | Smallest migration, easy filtering | Still mixes arrangement, language, and singer composition. Better than current only if labels are clearly editorial. |
| B | Full facets: performance, arrangement, vocal configuration, language, publication | Most precise and queryable | Too many NULLs and migration decisions for 405 rows. Do not start here. |
| C | Preserve only `version_type` | No migration work | Retains the observed semantic collision. Not recommended as the target. |

Recommendation: a pragmatic A-plus approach. Add `performance_context` as the
one fact-like facet (`studio/live/other`), keep `version_kind` as a controlled
editorial label, preserve `version_name`, and use `song_credits` plus
`artist_credit` for singer composition. Initial legacy mapping is: `live` →
`performance_context=live`; `standard` → `version_kind=standard` but does not
by itself prove studio context; `acoustic`/`solo` → corresponding
`version_kind` with context resolved from source; `Twitter`/`SINKA`/
pre-formation → retain display text and use `version_kind=alternate` when
applicable. Add additional facets only after a concrete query/UI need appears.

## Work credit storage options

| Option | Benefits | Problems |
|---|---|---|
| Group text columns | Lowest-risk transition, maps directly from `original_*` | People remain embedded in strings |
| Generic work-credit table | Better roles, order, and future creator search | Adds a second credit table and larger initial migration |
| Group text columns now, structured work credits later | Preserves current values and creates a clear migration path | Temporary duplication |

Recommendation: the third option. Start with group text columns and
verification. `song_credits` solves the immediate exact-version-credit gap.
Later, after a creator master and parsing policy are approved, introduce a
work-credit table and migrate the group text fields incrementally.

## Availability and physical media

The current schema already separates exact-song availability from release
history and can express an unavailable historical physical route:

```
content_type = studio | live | other
media_type   = physical | audio | video | other
is_current   = false
note          = "sold out" / "delisted" / source detail
```

Confirmed meaning of `is_current`:

> A new user can currently acquire or access this exact song/version through
> the recorded route.

This does not claim that an existing owner cannot play an already-owned CD.
Historical release existence remains in `releases`/release items and can also
remain in `song_availabilities` with `is_current = false`.

An `availability_state` column is not necessary for the first migration if the
only product behavior is current/not-current. Add it later only when the UI or
automation must distinguish `sold_out`, `delisted`, `ended`, and `unknown`.
If added, it must be documented as an explanation of a non-current route, not
as ownership tracking.

Under this proposal, `discovery_category` is derived from the current routes
available to a *new* user. A historical physical release alone does not make a
song `cd_album`.

## Phased migration plan

1. **Schema only** — Apply the additive migrations in reviewed order. No data
   values or existing verification rows change.
2. **Inventory snapshots** — Save an immutable before-state for songs, groups,
   checks, source relations, availability, release relations, and live links.
3. **Deterministic backfill** — Populate only group fields whose current
   members agree and whose source value has the required current human check.
   Do not alter legacy `original_*`.
4. **Difference queue** — Produce per-group differences: conflicting source
   values, absent base candidate, live/solo credits in `original_*`, and
   `collaboration` provenance ambiguity. Route these to `NEEDS_HUMAN`.
5. **Exact-credit seeding** — Add `song_credits` only where an exact-version
   credit is independently confirmed (begin with BREATHE and the known
   acoustic/solo examples). Add AI/human checks and reusable sources.
6. **Management UI** — Show work metadata, base song, exact credits, and
   current/stale checks side by side. Keep legacy fields read-only or clearly
   marked during transition.
7. **Public UI** — Read work metadata and exact credits with safe legacy
   fallbacks. Add public `song_credits` read policy only in this phase.
8. **405-song AI verification** — Verify into the target entities while
   retaining all legacy checks. Do not use a blind copy as an AI check.
9. **Legacy reduction** — After a reviewed coverage threshold and a rollback
   window, stop writing legacy fields. Removal requires a separate human
   decision and migration.

## Backfill estimate from the 405-song audit

| Class | Estimate | Treatment |
|---|---:|---|
| Work-provenance safe candidates | 350 referenced groups | Read-only dry-run result. Includes direct original/cover groups and variant-only inheritance where one non-collaboration provenance anchor exists. Work-credit backfill still requires source/status eligibility. |
| Single-song groups with `collaboration` | 14 referenced groups | Human/source review required; the row alone does not distinguish a new work from a cover or live collaboration. |
| Mixed or unresolved work-provenance groups | 17 groups | Read-only dry-run result. Includes the 14 singleton collaboration groups and three mixed-group cases. |
| Multi-version groups with one current primary + standard candidate | 27 groups / 65 songs | All 27 are safe structural base candidates. Each still requires review before production backfill. |
| Derived rows with at least some copied original metadata | 29 of 38 nonprimary rows | Heuristic comparison candidates. |
| Derived rows with all five original fields equal to base, including NULL | 20 of 38 | Strongest auto-copy candidates after required current human checks are verified. |
| Derived rows with all five non-NULL values equal to base | 19 of 38 | Strongest automatic backfill subset. |
| Derived rows with no copied original metadata | 9 of 38 | Human/source review required. |
| `song_type=variant` | 12 rows | All 12 have an inherited work-provenance candidate in the read-only dry-run; no variant row is structurally unresolved. |
| `song_type=collaboration` | 16 rows | 2 are in an existing multi-version group and have an inheritance candidate; 14 singleton rows need human/source classification. |
| Work-credit value agreement | 355 groups | Values agree after translating legacy `original_artist = '-'` to target NULL. This is not yet a source/status-approved backfill set. |
| Work-credit value conflicts | 12 groups | Excluded from automatic work-credit copy. |
| Legacy `original_artist = '-'` | 134 rows | Target work field becomes NULL; the check history distinguishes confirmed NULL from unresearched NULL. |
| Exact-version credit candidates | 38 nonprimary rows | Source review needed before inserting `song_credits`; 8 have a non-NULL legacy credit difference from their base candidate. |
| Orphan groups | 19 groups | Separate cleanup/reuse decision; never delete as part of this backfill. |

The figures are planning estimates, not authorization to apply a bulk update.
The final auto-backfill set must additionally require matching values and
current human checks on the source fields.

## Representative target mappings

### BREATHE / BREATHE(Rearranged ver.)

```
song_group 277
  work_provenance: original
  base_song_id: standard BREATHE row
  work_vocal_credit: ヰ世界情緒
  work lyric/composer/arranger: 香椎モイミ

songs standard BREATHE
  artist_credit: ヰ世界情緒
  performance_context: studio
  version_kind: standard

songs BREATHE(Rearranged ver.)
  artist_credit: ヰ世界情緒 × 春猿火
  performance_context: studio
  version_kind: rearranged
  song_credits: vocal=ヰ世界情緒, vocal=春猿火, arranger=朝比奈健人
```

The version's episode-8 tie-up stays on the rearranged `songs` row. Its work
arranger remains 香椎モイミ; no exact arranger is written into a work field.

### 輪廻: standard / acoustic / solo / live

```
song_group 68
  work provenance: original
  base: standard V.W.P version
  work vocal: V.W.P
  work credits: カンザキイオリ

acoustic row
  performance_context: studio or other only after source review
  version_kind: acoustic
  song_credits: arranger=exact acoustic arranger when independently verified

solo / live rows
  performance_context: live for actual live rows
  version_kind: solo or standard, as appropriate
  artist_credit + song_credits(vocal): exact performers
```

The acoustic arranger and the exact version singers must not overwrite work
vocal/arranger metadata.

### Multilingual versions

The group retains one work/source credit set. The exact multilingual row gets
`version_kind=multilingual`; if verified, `song_credits(role=translator)` or
`song_credits(role=additional_lyrics)` records the version-specific adaptation.
Which role applies is source-dependent and remains a human/source review.

### プロトコール

Keep `artist_credit = V.W.P × V.I.P` on its exact row. Its collaboration-like
display does not decide work provenance. The work provenance must be determined
from the underlying V.I.P work/source and may be `original` or `cover` only
after review. Separator style alone is never a verification conflict.

### ミラージュコード

Keep the live first/availability/tie-up fields on its exact row. The current
single-row group has no verified in-DB base, so `base_song_id` remains NULL.
Work provenance and work metadata require a separate decision; do not infer
them from the live collaboration credit.

## Alternatives rejected for the first phase

- **Move all `original_*` directly to song_groups and drop the songs columns:**
  loses external-cover compatibility and risks destroying existing check
  semantics.
- **One generic polymorphic verification/source table:** fewer tables but no
  normal FK guarantees for heterogeneous targets.
- **Postgres enums for all roles/version labels:** the observed vocabulary is
  evolving; text plus non-empty checks matches the current source-type design.
- **Full creator master now:** valuable eventually, but parsing 405 rows and
  resolving aliases would overshadow the immediate version-credit problem.
- **Full version facet model now:** precise but excessive for 40 named
  versions; introduce additional facets only for concrete query requirements.

## Remaining human decisions

1. Classify only the `collaboration` rows for which no reviewed same-group base
   or sufficient source establishes work provenance.
2. Review automatic base-song candidates before the first production backfill;
   the candidate rule is safe structurally, but does not claim historical truth.
3. Decide a future creator-master and credit parsing policy before attempting
   person-level search or normalization.
4. Decide whether non-current availability reasons need structured
   `availability_state` once a UI needs to distinguish them.

## Confirmed pending data fixes for a later backfill

- `songs.id = 158` — change `tie_up` to the official-equivalent wording
  `『狂気山脈 ネイキッド・ピーク』パイロット主題歌`.
- `songs.id = 68` — retain `first_date = 2021-10-07` under the next-calendar-day
  rule; review the current `first_status` as part of the verified backfill.
