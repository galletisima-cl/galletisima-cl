-- Preserve the discounts applied at checkout even when promotions later change.
alter table public.orders
  add column if not exists discount_amount integer not null default 0 check (discount_amount >= 0),
  add column if not exists shipping_discount integer not null default 0 check (shipping_discount >= 0),
  add column if not exists applied_discounts jsonb not null default '[]'::jsonb check (jsonb_typeof(applied_discounts) = 'array');

-- Rules use site_settings, whose existing policies allow only admins to write.
-- No promotions are enabled by this migration.
