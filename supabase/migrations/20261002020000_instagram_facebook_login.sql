alter table public.instagram_connection add column provider text not null default 'instagram' check (provider in ('instagram', 'facebook'));
alter table public.instagram_oauth_states add column provider text not null default 'instagram' check (provider in ('instagram', 'facebook'));

-- The provider is taken from the one-use authorization state, not callback input.
create or replace function public.finish_instagram_connection(p_state_hash text, p_account_id text, p_username text, p_access_token text, p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
declare v_provider text;
begin
  delete from public.instagram_oauth_states where state_hash = p_state_hash and expires_at > now() returning provider into v_provider;
  if not found then raise exception 'expired_instagram_state'; end if;
  insert into public.instagram_connection(id, account_id, username, access_token, expires_at, provider)
    values (true, p_account_id, p_username, p_access_token, p_expires_at, v_provider)
    on conflict (id) do update set connection_id = gen_random_uuid(), account_id = excluded.account_id,
      username = excluded.username, access_token = excluded.access_token, expires_at = excluded.expires_at, provider = excluded.provider,
      posts = '[]'::jsonb, synced_at = null, checked_at = null, sync_lock_until = '-infinity', last_error = null, connected_at = now();
end;
$$;
