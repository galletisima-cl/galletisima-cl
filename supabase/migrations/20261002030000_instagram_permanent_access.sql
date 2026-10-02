-- Meta may issue Page or System User tokens with both expiration timestamps set to zero.
-- NULL represents that verified absence of expiry; Instagram Login still requires a date.
alter table public.instagram_connection alter column expires_at drop not null;
alter table public.instagram_connection add constraint instagram_expiry_required
  check (expires_at is not null or provider = 'facebook');
