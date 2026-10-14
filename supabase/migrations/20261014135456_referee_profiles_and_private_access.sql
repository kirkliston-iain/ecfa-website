alter table public.referees add column photo_url text, add column about text, add column survey_answers jsonb not null default '[]'::jsonb;
alter table public.referees add constraint referee_survey_answers_array check (jsonb_typeof(survey_answers) = 'array');

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('referee-photos','referee-photos',true,5242880,array['image/jpeg','image/png','image/webp']) on conflict(id) do nothing;
create policy "public referee photos" on storage.objects for select to anon,authenticated using(bucket_id='referee-photos');
create policy "admins upload referee photos" on storage.objects for insert to authenticated with check(bucket_id='referee-photos' and exists(select 1 from public.admin_profiles where id=(select auth.uid())));
create policy "admins delete referee photos" on storage.objects for delete to authenticated using(bucket_id='referee-photos' and exists(select 1 from public.admin_profiles where id=(select auth.uid())));

create table private.referee_access_codes (
 referee_id uuid primary key references public.referees(id) on delete cascade,
 code_hash bytea not null unique,
 created_at timestamptz not null default now()
);
create table private.referee_sessions (
 token_hash bytea primary key,
 referee_id uuid not null references private.referee_access_codes(referee_id) on delete cascade,
 expires_at timestamptz not null
);
create index referee_sessions_referee_idx on private.referee_sessions(referee_id);
alter table private.referee_access_codes enable row level security;
alter table private.referee_sessions enable row level security;
revoke all on private.referee_access_codes,private.referee_sessions from public,anon,authenticated;

create function public.issue_referee_access_code(p_referee_id uuid, p_revoke boolean default false)
returns text language plpgsql security definer set search_path='' as $$
declare code text;
begin
 if auth.uid() is null or not exists(select 1 from public.admin_profiles where id=auth.uid()) then raise exception 'Administrator access required.'; end if;
 if not exists(select 1 from public.referees where id=p_referee_id) then raise exception 'Referee not found.'; end if;
 delete from private.referee_sessions where referee_id=p_referee_id;
 delete from private.referee_access_codes where referee_id=p_referee_id;
 if p_revoke then return null; end if;
 code := encode(extensions.gen_random_bytes(16),'hex');
 insert into private.referee_access_codes(referee_id,code_hash) values(p_referee_id,extensions.digest(code,'sha256'));
 return code;
end $$;
revoke all on function public.issue_referee_access_code(uuid,boolean) from public,anon;
grant execute on function public.issue_referee_access_code(uuid,boolean) to authenticated;

create function public.referee_code_login(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare ref uuid; token text;
begin
 if length(trim(p_code)) <> 32 then raise exception 'Invalid login code.'; end if;
 select referee_id into ref from private.referee_access_codes where code_hash=extensions.digest(lower(trim(p_code)),'sha256');
 if ref is null then raise exception 'Invalid login code.'; end if;
 token := encode(extensions.gen_random_bytes(32),'hex');
 delete from private.referee_sessions where expires_at<now();
 insert into private.referee_sessions(token_hash,referee_id,expires_at) values(extensions.digest(token,'sha256'),ref,now()+interval '12 hours');
 return jsonb_build_object('token',token);
end $$;
revoke all on function public.referee_code_login(text) from public;
grant execute on function public.referee_code_login(text) to anon,authenticated;

create function private.current_referee_session()
returns uuid language sql security definer set search_path='' as $$
 select referee_id from private.referee_sessions
 where token_hash=extensions.digest(coalesce(current_setting('request.headers',true)::jsonb->>'x-ecfa-referee-session',''),'sha256') and expires_at>now()
$$;
revoke all on function private.current_referee_session() from public,anon,authenticated;

create function public.referee_private_dashboard()
returns jsonb language plpgsql security definer set search_path='' as $$
declare ref uuid; ref_name text; current_season text; result jsonb;
begin
 ref:=private.current_referee_session();
 if ref is null then raise exception 'Please sign in with your referee code.'; end if;
 select name into ref_name from public.referees where id=ref;
 select max(season) into current_season from public.competitions;
 with matches as (
 select f.id,f.fixture_date,h.name home,a.name away,f.home_score,f.away_score,
 coalesce((select sum(d.card_count) from public.discipline_records d where d.fixture_id=f.id and d.card_type='yellow'),0) yellow,
 coalesce((select sum(d.card_count) from public.discipline_records d where d.fixture_id=f.id and d.card_type='red'),0) red
 from public.fixtures f join public.stages s on s.id=f.stage_id join public.competitions c on c.id=s.competition_id
 join public.teams h on h.id=f.home_team_id join public.teams a on a.id=f.away_team_id
 where f.referee_name=ref_name and f.status='played' and c.season=current_season and not f.hidden_from_public
 ) select jsonb_build_object('referee',ref_name,'season',current_season,'games',count(*),'yellow',coalesce(sum(yellow),0),'red',coalesce(sum(red),0),
 'cards_per_game',case when count(*)=0 then 0 else round(coalesce(sum(yellow+red),0)::numeric/count(*),2) end,
 'matches',coalesce(jsonb_agg(to_jsonb(matches) order by fixture_date desc),'[]'::jsonb)) into result from matches;
 return result;
end $$;
revoke all on function public.referee_private_dashboard() from public;
grant execute on function public.referee_private_dashboard() to anon,authenticated;

create function public.referee_code_logout()
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.referee_sessions where token_hash=extensions.digest(coalesce(current_setting('request.headers',true)::jsonb->>'x-ecfa-referee-session',''),'sha256');
end $$;
revoke all on function public.referee_code_logout() from public;
grant execute on function public.referee_code_logout() to anon,authenticated;
