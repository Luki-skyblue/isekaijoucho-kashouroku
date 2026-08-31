-- REVIEWED DRAFT — do not apply to Supabase in this task.
--
-- The reference/availability tables already exist in production. This
-- non-destructive follow-up documents the confirmed meaning of is_current;
-- it does not add availability_state or alter any availability row.

begin;

comment on column public.song_availabilities.is_current is
  'True when a new user can currently acquire or access this exact songs.id/version through the recorded route. False records a historical, currently unavailable route and does not describe whether an existing owner can play a previously acquired physical medium.';

comment on table public.song_availabilities is
  'Exact song/version availability routes, including current routes and historical inaccessible routes. discovery_category is derived from current new-user access, not physical ownership.';

commit;
