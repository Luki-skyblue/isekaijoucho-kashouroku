# Song model migration drafts

These SQL files are additive **drafts** for human review. They have not been
applied to Supabase and must not be executed as part of the current task.

Suggested review/apply order after explicit approval:

1. Confirm the already-applied prerequisite
   `sql/song_references/001_create_song_reference_and_availability_tables.sql`.
2. Apply `sql/song_references/002_document_current_availability_semantics.sql`.
3. Apply `001_add_song_group_work_fields.sql`.
4. Apply `002_add_song_version_fields_and_credits.sql`.
5. Apply `003_add_song_model_verification.sql`.

None of the files backfills production data, changes existing verification
history, or removes legacy columns. Data migration is intentionally a later,
separately reviewed phase described in
[`docs/song-model-redesign-draft.md`](../../docs/song-model-redesign-draft.md).
