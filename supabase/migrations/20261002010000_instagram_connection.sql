-- Instagram credentials must never be stored in publicly readable site_settings.
create table public.instagram_connection (
  id boolean primary key default true check (id = true),
  connection_id uuid not null default gen_random_uuid(),
  account_id text not null,
  username text not null,
  access_token text not null,
  expires_at timestamptz not null,
  posts jsonb not null default '[]'::jsonb check (jsonb_typeof(posts) = 'array'),
  synced_at timestamptz,
  checked_at timestamptz,
  sync_lock_until timestamptz not null default '-infinity',
  last_error text,
  connected_at timestamptz not null default now()
);
create table public.instagram_oauth_states (
  state_hash text primary key,
  admin_id uuid not null,
  expires_at timestamptz not null
);
alter table public.instagram_connection enable row level security;
alter table public.instagram_oauth_states enable row level security;
revoke all on public.instagram_connection, public.instagram_oauth_states from public, anon, authenticated;
grant all on public.instagram_connection, public.instagram_oauth_states to service_role;

create function public.finish_instagram_connection(p_state_hash text, p_account_id text, p_username text, p_access_token text, p_expires_at timestamptz)
returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.instagram_oauth_states where state_hash = p_state_hash and expires_at > now();
  if not found then raise exception 'expired_instagram_state'; end if;
  insert into public.instagram_connection(id, account_id, username, access_token, expires_at)
    values (true, p_account_id, p_username, p_access_token, p_expires_at)
    on conflict (id) do update set connection_id = gen_random_uuid(), account_id = excluded.account_id,
      username = excluded.username, access_token = excluded.access_token, expires_at = excluded.expires_at,
      posts = '[]'::jsonb, synced_at = null, checked_at = null, sync_lock_until = '-infinity', last_error = null, connected_at = now();
end;
$$;
create function public.disconnect_instagram() returns void language plpgsql security invoker set search_path = '' as $$
begin
  delete from public.instagram_oauth_states;
  delete from public.instagram_connection;
end;
$$;
revoke all on function public.finish_instagram_connection(text, text, text, text, timestamptz), public.disconnect_instagram() from public, anon, authenticated;
grant execute on function public.finish_instagram_connection(text, text, text, text, timestamptz), public.disconnect_instagram() to service_role;
