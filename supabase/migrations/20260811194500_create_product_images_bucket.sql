insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('product-images', 'product-images', true, 5242880, array['image/webp'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create policy "Public can view product images"
on storage.objects for select
to public
using (bucket_id = 'product-images');

create policy "Admins can upload product images"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'product-images'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "Admins can update product images"
on storage.objects for update
to authenticated
using (
  bucket_id = 'product-images'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
)
with check (
  bucket_id = 'product-images'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);

create policy "Admins can delete product images"
on storage.objects for delete
to authenticated
using (
  bucket_id = 'product-images'
  and (select auth.jwt()->'app_metadata'->>'role') = 'admin'
);
