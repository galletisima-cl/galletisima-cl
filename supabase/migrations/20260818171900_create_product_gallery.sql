create table public.product_images (
  id uuid primary key default gen_random_uuid(),
  product_id uuid not null references public.products(id) on delete cascade,
  image_url text not null check (length(trim(image_url)) > 0),
  sort_order smallint not null check (sort_order between 0 and 7),
  created_at timestamptz not null default now(),
  unique (product_id, sort_order)
);

update storage.buckets
set public = true,
    file_size_limit = 5242880,
    allowed_mime_types = array['image/webp']
where id = 'product-images';

create index idx_product_images_product_order
  on public.product_images(product_id, sort_order);

create or replace function public.enforce_product_image_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if (select count(*) from public.product_images where product_id = new.product_id) >= 8 then
    raise exception 'Un producto no puede tener más de 8 imágenes' using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger product_images_limit
before insert on public.product_images
for each row execute function public.enforce_product_image_limit();

insert into public.product_images (product_id, image_url, sort_order)
select id, image_url, 0
from public.products
where length(trim(image_url)) > 0
on conflict (product_id, sort_order) do nothing;

alter table public.product_images enable row level security;

create policy "Public can view active product images"
on public.product_images for select to anon, authenticated
using (
  exists (
    select 1 from public.products
    where products.id = product_images.product_id
      and (products.active = true or (select auth.jwt()->'app_metadata'->>'role') = 'admin')
  )
);

create policy "Admins manage product images"
on public.product_images for all to authenticated
using ((select auth.jwt()->'app_metadata'->>'role') = 'admin')
with check ((select auth.jwt()->'app_metadata'->>'role') = 'admin');

grant select on public.product_images to anon;
grant select, insert, update, delete on public.product_images to authenticated;
