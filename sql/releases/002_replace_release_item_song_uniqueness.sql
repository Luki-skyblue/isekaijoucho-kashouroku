-- A release item is one track/item occurrence inside a release component.
-- songs.id is a relation, not this row's identity: the same exact song may
-- legitimately occur in multiple components of one release/package.

begin;

-- Legacy constraint: UNIQUE (release_id, song_id).
-- Its generated backing index is dropped together with the constraint.
alter table public.release_items
  drop constraint if exists release_items_release_id_song_id_key;

-- Position is authoritative only once both component and sort_order are
-- explicitly known. Legacy rows with either value NULL intentionally remain
-- outside this index until their component/position is safely backfilled.
create unique index release_items_component_sort_order_unique_idx
  on public.release_items (release_component_id, sort_order)
  where release_component_id is not null
    and sort_order is not null;

comment on table public.release_items is
  'One track/item occurrence inside a release component. songs.id is a nullable relation and does not define item identity; the same exact song may occur in multiple components or positions.';
comment on index public.release_items_component_sort_order_unique_idx is
  'Prevents duplicate known positions inside a component. Does not constrain song_id, and excludes rows whose component or authoritative sort position is not yet known.';

commit;

-- Rollback before adding duplicate (release_id, song_id) occurrences:
-- begin;
-- drop index if exists public.release_items_component_sort_order_unique_idx;
-- alter table public.release_items
--   add constraint release_items_release_id_song_id_key unique (release_id, song_id);
-- commit;
