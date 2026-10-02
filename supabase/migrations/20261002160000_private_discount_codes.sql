-- Coupon codes are read by the checkout server and authenticated administrators.
-- The other storefront settings remain publicly readable.
create policy "Discount rules require admin access"
on public.site_settings as restrictive for select
to anon, authenticated
using (
  key <> 'automatic_discounts'
  or (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);
