# Song model migration drafts

Migrations 001–003 are applied production schema. Migrations 004–006 are
additive **drafts** for human review and must not be executed as part of the
current task.

Suggested review/apply order after explicit approval:

1. Confirm the already-applied prerequisite
   `sql/song_references/001_create_song_reference_and_availability_tables.sql`.
2. Confirm applied migrations 001–003 and the availability semantics comment.
3. After a separate review, apply `004_create_entities_and_relationships.sql`.
4. Apply `005_create_structured_credits_and_participations.sql`.
5. Apply `006_separate_metadata_reference_and_origin.sql`.

The draft files do not backfill production data, change existing verification
history, or remove legacy columns. The target responsibility split is described
in [`docs/song-entity-participation-model.md`](../../docs/song-entity-participation-model.md).
