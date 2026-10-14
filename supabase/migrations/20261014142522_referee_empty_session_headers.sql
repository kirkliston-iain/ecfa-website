create or replace function private.current_referee_session()
returns uuid language sql security definer set search_path='' as $$
 select referee_id from private.referee_sessions
 where token_hash=extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-ecfa-referee-session',''),'sha256') and expires_at>now()
$$;
create or replace function public.referee_code_logout()
returns void language plpgsql security definer set search_path='' as $$
begin
 delete from private.referee_sessions where token_hash=extensions.digest(coalesce(nullif(current_setting('request.headers',true),'')::jsonb->>'x-ecfa-referee-session',''),'sha256');
end $$;
