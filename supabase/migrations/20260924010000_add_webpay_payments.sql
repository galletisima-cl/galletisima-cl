alter table public.order_items
  add column if not exists size text not null default '';

alter table public.orders
  add column if not exists buyer_name text not null default '',
  add column if not exists buyer_email text not null default '',
  add column if not exists buyer_phone text not null default '',
  add column if not exists payment_status text not null default 'pending'
    check (payment_status in ('pending', 'authorized', 'rejected', 'cancelled', 'failed')),
  add column if not exists payment_provider text not null default 'webpay',
  add column if not exists buy_order text,
  add column if not exists session_id text,
  add column if not exists webpay_token text,
  add column if not exists authorization_code text,
  add column if not exists payment_type_code text,
  add column if not exists card_last_four text,
  add column if not exists installments_number integer,
  add column if not exists accounting_date text,
  add column if not exists transaction_date timestamptz,
  add column if not exists payment_response jsonb,
  add column if not exists paid_at timestamptz,
  add column if not exists email_sent_at timestamptz;

create unique index if not exists idx_orders_buy_order on public.orders(buy_order) where buy_order is not null;
create unique index if not exists idx_orders_webpay_token on public.orders(webpay_token) where webpay_token is not null;
create index if not exists idx_orders_buyer_email on public.orders(buyer_email, created_at desc);

