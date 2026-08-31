-- REVIEWED DRAFT — do not apply to Supabase in this task.
--
-- Additive first step for separating work-level metadata from exact song
-- versions. This migration intentionally performs no backfill and does not
-- remove or rename existing songs.original_* columns.

begin;

alter table public.song_groups
  add column work_provenance text,
  add column work_artist_credit text,
  add column work_vocal_credit text,
  add column work_lyricist_credit text,
  add column work_composer_credit text,
  add column work_arranger_credit text,
  add column base_song_id bigint;

alter table public.song_groups
  add constraint song_groups_work_provenance_check
    check (work_provenance is null or work_provenance in ('original', 'cover', 'other')),
  add constraint song_groups_base_song_id_fkey
    foreign key (base_song_id) references public.songs (id) on delete restrict;

comment on column public.song_groups.work_provenance is
  'Work-level provenance. Canonical values are original, cover, and other; NULL means not yet backfilled.';
comment on column public.song_groups.work_artist_credit is
  'Credited artist or act for the underlying work, independent from an exact songs.artist_credit.';
comment on column public.song_groups.work_vocal_credit is
  'Underlying work vocal credit, independent from exact-version vocal credits.';
comment on column public.song_groups.work_lyricist_credit is
  'Underlying work lyricist credit as a transitional display string.';
comment on column public.song_groups.work_composer_credit is
  'Underlying work composer credit as a transitional display string.';
comment on column public.song_groups.work_arranger_credit is
  'Underlying work arranger credit as a transitional display string.';
comment on column public.song_groups.base_song_id is
  'Optional exact songs row used as the metadata base for this work. It is not the same concept as is_primary_version.';

create index song_groups_base_song_idx
  on public.song_groups (base_song_id)
  where base_song_id is not null;

-- A normal CHECK cannot compare song_groups.base_song_id with the referenced
-- songs.song_group_id. Deferred triggers keep the relationship valid while
-- still allowing a group, its base song, and a reassignment to be changed in
-- one transaction.
create function public.enforce_song_group_base_song_membership()
returns trigger
language plpgsql
as $$
begin
  if tg_table_name = 'song_groups' then
    if new.base_song_id is not null and not exists (
      select 1
      from public.songs as song
      where song.id = new.base_song_id
        and song.song_group_id = new.id
    ) then
      raise exception 'song_groups.base_song_id % must belong to song_group %', new.base_song_id, new.id;
    end if;

    return new;
  end if;

  if tg_table_name = 'songs' and new.song_group_id is distinct from old.song_group_id then
    if exists (
      select 1
      from public.song_groups as song_group
      where song_group.base_song_id = new.id
        and song_group.id is distinct from new.song_group_id
    ) then
      raise exception 'base song % cannot be moved outside its song group without updating base_song_id', new.id;
    end if;
  end if;

  return new;
end;
$$;

create constraint trigger song_groups_base_song_membership_check
after insert or update
on public.song_groups
deferrable initially deferred
for each row
execute function public.enforce_song_group_base_song_membership();

create constraint trigger songs_base_song_membership_check
after update
on public.songs
deferrable initially deferred
for each row
execute function public.enforce_song_group_base_song_membership();

-- song_groups already follows the project's public-data RLS/grant policy.
-- This migration adds no new table and deliberately does not alter that policy.
-- The later backfill must convert legacy songs.original_artist = '-' to SQL
-- NULL in work_artist_credit; the legacy sentinel itself is not changed here.

commit;
