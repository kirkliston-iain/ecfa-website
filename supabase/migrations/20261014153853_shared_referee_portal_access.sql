create table private.referee_portal_access (id boolean primary key default true check(id),code_hash bytea not null);
create table private.referee_portal_sessions (token_hash bytea primary key,expires_at timestamptz not null);
alter table private.referee_portal_access enable row level security;
alter table private.referee_portal_sessions enable row level security;
revoke all on private.referee_portal_access,private.referee_portal_sessions from public,anon,authenticated;
-- The shared access code is provisioned directly in the private database, never in repository source.
create function private.valid_referee_portal_session()
returns boolean language sql security definer set search_path='' as $$
select exists(select 1 from private.referee_portal_sessions where token_hash=extensions.digest(
coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-ecfa-referee-session',''),'sha256') and expires_at>now())
$$;
revoke all on function private.valid_referee_portal_session() from public,anon,authenticated;
create function public.referee_portal_login(p_code text)
returns jsonb language plpgsql security definer set search_path='' as $$
declare token text;
begin
 if not exists(select 1 from private.referee_portal_access where code_hash=extensions.digest(trim(p_code),'sha256')) then raise exception 'Invalid login code.'; end if;
 token:=encode(extensions.gen_random_bytes(32),'hex');
 delete from private.referee_portal_sessions where expires_at<now();
 insert into private.referee_portal_sessions values(extensions.digest(token,'sha256'),now()+interval '8 hours');
 return jsonb_build_object('token',token);
end $$;
create function public.referee_portal_logout() returns void language sql security definer set search_path='' as $$
delete from private.referee_portal_sessions where token_hash=extensions.digest(
coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-ecfa-referee-session',''),'sha256')
$$;
revoke all on function public.referee_portal_login(text),public.referee_portal_logout() from public;
grant execute on function public.referee_portal_login(text),public.referee_portal_logout() to anon,authenticated;

