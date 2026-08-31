-- Allow a checked NULL songs value to be represented directly as SQL NULL.
-- The presence of the song_field_checks row distinguishes a checked NULL from
-- the absence of verification history.

begin;

alter table public.song_field_checks
  alter column checked_value drop not null;

comment on column public.song_field_checks.checked_value is
  'Snapshot of the songs field value at check time. Non-NULL values are stored as jsonb; SQL NULL means the checked field value was NULL.';

commit;
