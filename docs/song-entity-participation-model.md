# Song entity, credit, and participation model

This is the target design for the next song-model phase. It is deliberately
additive: production currently contains the work/version backfill from the
earlier phase, but the migrations described here are drafts only. No existing
song, work, source, check, or availability history is replaced.

## Four separate facts

| Fact | Storage | Meaning |
|---|---|---|
| Entity | `entities` | A named artist, group, character, voicebank, project, or other subject. |
| Normal relationship | `entity_relationships` | Durable facts such as `V.W.P --member--> ヰ世界情緒` or `夜河世界 --voiced_by--> ヰ世界情緒`. |
| Official credit | `song_group_credits` / `song_credits` | Source-preserving credit text. `entity_id` is optional and never replaces the text. |
| Actual participation | `song_participations` | Entities actually participating in one exact `songs.id` version. |

The distinction is intentional. A `V.W.P` official credit does not prove that
all ordinary V.W.P members sang that particular rendition. Group membership is
only a fallback when no exact participation or individual exact-version credit
is known.

For a character credit, participation can point at the character entity. A
query that needs performer identity may follow an explicitly permitted
`voiced_by` relationship. It must not expand voicebanks such as 星界 or 狐子 to
a provider automatically.

## Credit and participation precedence

For an exact version, resolve vocal identity in this order:

1. `song_participations(participation_role = 'vocal')`
2. Individual `song_credits(role = 'vocal')` whose `entity_id` is resolved
3. Group official credit plus `entity_relationships(member)` as a fallback
4. Unknown / `NEEDS_HUMAN`

Official credits remain display facts even when actual participants differ.
`songs.artist_credit` continues to be the canonical display string during the
transition.

## Work vocal versus exact vocal

`song_group_credits(role = 'vocal')` represents the underlying work vocal set
`O`. Exact `song_participations(role = 'vocal')` represents the version set
`V`. Resolve character-to-performer identity only for relationship types that
are explicitly allowed for identity comparison, then derive rather than store:

| Condition | Derived relation |
|---|---|
| `O = V` | `same` |
| `O` is a proper subset of `V` | `added` |
| `V` is a proper subset of `O` | `reduced` |
| `O` and `V` do not overlap | `replaced` |
| They overlap without either subset relation | `mixed` |
| Either set is unresolved | `unknown` |

`original_includes_isekai` and `version_includes_isekai` are likewise derived
from resolved entity sets. No new hand-maintained `derived` or
`collaboration` label is required.

## Origin and metadata references

`song_groups.base_song_id` was populated from a primary-plus-standard
structural heuristic. It is useful as a legacy transition value but is not a
historical-origin assertion and should receive no new semantic uses.

The proposed split is:

| Target | Meaning |
|---|---|
| `song_groups.metadata_reference_song_id` | Same-group rendition useful for metadata comparison/inheritance. |
| `song_group_origins` | Explicit, sourced historical origin assertion: an in-DB origin song or an external/pre-existing work. |

Both in-DB references are constrained to the same `song_group`. Unknown is
represented by no `song_group_origins` row. This leaves no pressure to pretend
that every work has a single in-DB origin.

`work_provenance` remains a legacy/transitional classification. It is useful
for inventory and compatibility but is not the long-term source of truth for
origin. Future UI labels should derive from origin assertions, external work
facts, and participant sets; until then, preserve the existing field without
rewriting it.

## Representative representations

- **BREATHE:** work vocal `ヰ世界情緒`; exact rearranged participants `ヰ世界情緒` and `春猿火`; exact arranger credit `朝比奈健人`. Derived vocal relation: `added`.
- **星界 duet:** work vocal `星界`; exact participants `星界` and `ヰ世界情緒`. Derived relation: `added`; a voicebank is not expanded to a provider.
- **輪廻 solo:** work vocal `V.W.P`; exact participant `ヰ世界情緒`. When ordinary membership is the approved fallback, derived relation: `reduced`.
- **あわく心模様:** official credits point to `森先化歩` and `夜河世界`; `voiced_by` relations support identity-aware queries to 花譜 and ヰ世界情緒 without destroying character credit text.
- **V.W.P special lineup:** store the verified special lineup in `song_participations`; do not expand the group credit mechanically.
- **ピース！！:** retain official credits and leave origin/metadata reference NULL while no single in-DB origin is established.

## Verification and sources

Existing song, group, and credit histories remain authoritative for their
current entities. Do not copy them mechanically.

When entity data starts to be entered, add entity-specific append-only checks
only for facts that were actually verified:

- `entity_field_checks` for an entity attribute;
- `entity_relationship_checks` for a relationship row;
- `song_participation_checks` for an exact participation row;
- reuse `reference_sources` through normal FK source-relation tables.

This is preferable to introducing one polymorphic check target now. It retains
referential integrity and keeps current/stale snapshot semantics explicit. No
such verification tables are included in the initial entity migration draft:
there is no production entity data to verify yet.

## Draft application order

After separate human approval, apply the following additive drafts after the
already-applied 001–003 song-model migrations:

1. `004_create_entities_and_relationships.sql`
2. `005_create_structured_credits_and_participations.sql`
3. `006_separate_metadata_reference_and_origin.sql`

Then seed only exact, reviewed entity names and relationships; do not parse
composite credits automatically. A future public UI phase can add read policy
and presentation after management review.
