-- Record a team's selection from the Teams list as part of anonymous visit history.
alter table public.web_interactions
  drop constraint if exists web_interactions_action_kind_check;
alter table public.web_interactions
  add constraint web_interactions_action_kind_check
  check (action_kind in ('download', 'view', 'search_result', 'team_selection'));

create or replace function public.record_web_interaction(p_action text, p_item text, p_visit_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare clean_item text;
begin
  clean_item := left(trim(coalesce(p_item, '')), 200);
  if p_action not in ('download', 'view', 'search_result', 'team_selection') or clean_item = '' then return; end if;
  insert into public.web_interactions (action_kind, item_label, web_session_id)
  values (p_action, clean_item, p_visit_id);
end;
$$;
