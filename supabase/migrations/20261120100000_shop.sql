-- Shop: the platform owner sells books (physical and e-book) to the public, with a cart, coupon codes and UPI / QR payment.
--
-- Everything the shop shows or does is the owner's choice (nothing is built into the app): shop name and wording, UPI id and QR,
-- shipping fee and free-shipping limit, contact details, policy text, order-number prefix, e-book download limit, products, prices,
-- pictures, coupons.
--
-- Payment is by UPI: the customer pays to the owner's UPI id (UPI app button or QR scan), then enters the UTR / transaction id
-- (and may upload a screenshot). The owner checks it in his own UPI app and confirms the order - nothing is marked paid by itself.
--
-- Safety: the browser never sends a price. Prices, stock, shipping and coupons are all worked out here from the products table.
-- The public can only call the functions below; the tables are closed to them. E-book files live in a PRIVATE bucket and are
-- handed out only through the shop-ebook-download edge function (checks the order, its payment and the download limit).
-- Additive only.

-- ── settings (one row) ──
create table if not exists public.shop_settings (
  id boolean primary key default true check (id),
  enabled boolean not null default false,                -- the public shop is visible only when this is on
  shop_name text,
  tagline text,
  intro_text text,
  currency_symbol text not null default '₹',
  accept_upi boolean not null default true,
  upi_id text,
  upi_payee_name text,
  upi_qr_url text,                                       -- the owner's own QR picture (optional; a QR with the exact amount is also made for each order)
  shipping_fee numeric not null default 0 check (shipping_fee >= 0),
  free_shipping_above numeric check (free_shipping_above is null or free_shipping_above >= 0),
  shipping_note text,
  whatsapp_number text,
  contact_email text,
  support_phone text,
  policy_text text,
  thank_you_note text,
  order_prefix text not null default 'ORD',
  phone_country_code text not null default '91',         -- put in front of a customer's 10 digit number for the WhatsApp button
  ebook_download_limit integer check (ebook_download_limit is null or ebook_download_limit > 0) default 5,
  updated_at timestamptz not null default now()
);
insert into public.shop_settings (id) values (true) on conflict do nothing;

-- ── products: one book, up to two formats (physical / e-book) ──
create table if not exists public.shop_products (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  subtitle text,
  description text,
  images text[] not null default '{}',                   -- public picture links, the first one is the cover
  physical_enabled boolean not null default false,
  physical_price numeric check (physical_price is null or physical_price >= 0),
  physical_mrp numeric check (physical_mrp is null or physical_mrp >= 0),
  physical_stock integer,                                -- null = not counted
  ebook_enabled boolean not null default false,
  ebook_price numeric check (ebook_price is null or ebook_price >= 0),
  ebook_mrp numeric check (ebook_mrp is null or ebook_mrp >= 0),
  ebook_file_path text,                                  -- in the private shop-ebooks bucket
  ebook_file_name text,
  featured boolean not null default false,
  active boolean not null default true,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ── coupons ──
create table if not exists public.shop_coupons (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,                             -- always stored in capitals
  description text,
  kind text not null check (kind in ('percent', 'flat')),
  value numeric not null check (value > 0),
  min_order numeric not null default 0 check (min_order >= 0),
  max_discount numeric check (max_discount is null or max_discount > 0),   -- cap for a percent coupon
  applies_to text not null default 'all' check (applies_to in ('all', 'physical', 'ebook')),
  valid_from timestamptz,
  valid_until timestamptz,
  usage_limit integer check (usage_limit is null or usage_limit > 0),
  per_phone_limit integer check (per_phone_limit is null or per_phone_limit > 0) default 1,
  used_count integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ── orders ──
create sequence if not exists public.shop_order_seq start 1001;

create table if not exists public.shop_orders (
  id uuid primary key default gen_random_uuid(),
  order_no text not null unique,
  token text not null,                                   -- the customer's secret for this order
  status text not null default 'awaiting_payment'
    check (status in ('awaiting_payment', 'payment_submitted', 'paid', 'shipped', 'delivered', 'cancelled')),
  customer_name text not null,
  phone text not null,
  email text,
  ship_address text,
  ship_city text,
  ship_state text,
  ship_pincode text,
  has_physical boolean not null default false,
  has_ebook boolean not null default false,
  subtotal numeric not null,
  discount numeric not null default 0,
  coupon_code text,
  shipping numeric not null default 0,
  total numeric not null,
  payment_method text,
  payment_utr text,
  payment_proof_path text,                               -- in the private shop-proofs bucket
  payment_submitted_at timestamptz,
  paid_at timestamptz,
  courier text,
  tracking_no text,
  shipped_at timestamptz,
  delivered_at timestamptz,
  customer_note text,
  admin_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists idx_shop_orders_status on public.shop_orders (status, created_at desc);
create index if not exists idx_shop_orders_phone on public.shop_orders (phone);

create table if not exists public.shop_order_items (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.shop_orders(id) on delete cascade,
  product_id uuid references public.shop_products(id) on delete set null,
  format text not null check (format in ('physical', 'ebook')),
  title text not null,                                   -- what it was called, and its price, when it was bought
  unit_price numeric not null,
  qty integer not null check (qty > 0),
  line_total numeric not null,
  download_count integer not null default 0
);
create index if not exists idx_shop_order_items_order on public.shop_order_items (order_id);

-- ── the tables are closed to the public; only the platform owner's company can read / manage them ──
alter table public.shop_settings enable row level security;
alter table public.shop_products enable row level security;
alter table public.shop_coupons enable row level security;
alter table public.shop_orders enable row level security;
alter table public.shop_order_items enable row level security;

do $$
declare t text;
begin
  foreach t in array array['shop_settings', 'shop_products', 'shop_coupons'] loop
    execute format('drop policy if exists %I on public.%I', t || '_operator_all', t);
    execute format('create policy %I on public.%I for all using (public.current_company_is_platform_operator()) with check (public.current_company_is_platform_operator())', t || '_operator_all', t);
  end loop;
  -- orders: the owner can read them; every change goes through the functions below
  execute 'drop policy if exists shop_orders_operator_read on public.shop_orders';
  execute 'create policy shop_orders_operator_read on public.shop_orders for select using (public.current_company_is_platform_operator())';
  execute 'drop policy if exists shop_order_items_operator_read on public.shop_order_items';
  execute 'create policy shop_order_items_operator_read on public.shop_order_items for select using (public.current_company_is_platform_operator())';
end $$;

-- ── small helpers ──
create or replace function public._shop_digits(p text) returns text
language sql immutable as $$ select regexp_replace(coalesce(p, ''), '\D', '', 'g'); $$;

-- the price list for a cart, worked out from the products table (the browser's prices are never used)
-- p_items: [{ "product_id": uuid, "format": "physical" | "ebook", "qty": n }]
create or replace function public._shop_calc(p_items jsonb, p_code text, p_phone text)
returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare
  st shop_settings; it jsonb; p shop_products; c shop_coupons;
  v_qty integer; v_fmt text; v_price numeric; lines jsonb := '[]'::jsonb;
  v_sub numeric := 0; v_has_phys boolean := false; v_has_ebook boolean := false; v_elig numeric := 0;
  v_disc numeric := 0; v_err text := null; v_ship numeric := 0; v_code text := upper(btrim(coalesce(p_code, '')));
  v_valid_code text := null; v_coupon_id uuid := null; v_used integer;
begin
  select * into st from shop_settings where id;
  if not coalesce(st.enabled, false) then raise exception 'The shop is closed right now.'; end if;
  if p_items is null or jsonb_typeof(p_items) <> 'array' or jsonb_array_length(p_items) = 0 then raise exception 'Your cart is empty.'; end if;
  if jsonb_array_length(p_items) > 30 then raise exception 'There are too many items in the cart.'; end if;
  if (select count(distinct (x->>'product_id') || '|' || (x->>'format')) from jsonb_array_elements(p_items) x) <> jsonb_array_length(p_items) then
    raise exception 'The same item is in the cart twice.';
  end if;

  for it in select * from jsonb_array_elements(p_items) loop
    select * into p from shop_products where id = (it->>'product_id')::uuid and active;
    if not found then raise exception 'An item in your cart is no longer available.'; end if;
    v_fmt := it->>'format';
    v_qty := greatest(1, coalesce((it->>'qty')::integer, 1));
    if v_fmt = 'physical' then
      if not (p.physical_enabled and p.physical_price is not null) then raise exception '"%" is not available as a book.', p.title; end if;
      if v_qty > 20 then raise exception 'You can order at most 20 copies of one book.'; end if;
      if p.physical_stock is not null and p.physical_stock < v_qty then
        raise exception 'Only % cop% of "%" left.', greatest(p.physical_stock, 0), case when p.physical_stock = 1 then 'y' else 'ies' end, p.title;
      end if;
      v_price := p.physical_price; v_has_phys := true;
    elsif v_fmt = 'ebook' then
      if not (p.ebook_enabled and p.ebook_price is not null and p.ebook_file_path is not null) then raise exception '"%" is not available as an e-book.', p.title; end if;
      v_qty := 1; v_price := p.ebook_price; v_has_ebook := true;
    else
      raise exception 'Unknown format in the cart.';
    end if;
    lines := lines || jsonb_build_array(jsonb_build_object('product_id', p.id, 'format', v_fmt, 'title', p.title, 'unit_price', v_price, 'qty', v_qty, 'line_total', v_price * v_qty));
    v_sub := v_sub + v_price * v_qty;
  end loop;

  if v_code <> '' then
    select * into c from shop_coupons where code = v_code and active;
    if not found then
      v_err := 'This coupon code is not valid.';
    elsif c.valid_from is not null and now() < c.valid_from then
      v_err := 'This coupon is not active yet.';
    elsif c.valid_until is not null and now() > c.valid_until then
      v_err := 'This coupon has expired.';
    elsif c.usage_limit is not null and c.used_count >= c.usage_limit then
      v_err := 'This coupon has been fully used.';
    else
      select coalesce(sum((l->>'line_total')::numeric), 0) into v_elig from jsonb_array_elements(lines) l where c.applies_to = 'all' or l->>'format' = c.applies_to;
      if v_elig <= 0 then
        v_err := 'This coupon does not apply to the items in your cart.';
      elsif v_sub < c.min_order then
        v_err := 'This coupon needs an order of at least ' || trim(to_char(c.min_order, 'FM9999999990.##')) || '.';
      else
        v_used := 0;
        if c.per_phone_limit is not null and length(_shop_digits(p_phone)) >= 10 then
          select count(*) into v_used from shop_orders o
           where o.coupon_code = c.code and o.status <> 'cancelled' and right(_shop_digits(o.phone), 10) = right(_shop_digits(p_phone), 10);
        end if;
        if c.per_phone_limit is not null and v_used >= c.per_phone_limit then
          v_err := 'You have already used this coupon.';
        else
          v_disc := case when c.kind = 'percent' then round(v_elig * c.value / 100, 2) else least(c.value, v_elig) end;
          if c.kind = 'percent' and c.max_discount is not null then v_disc := least(v_disc, c.max_discount); end if;
          v_disc := least(v_disc, v_elig);
          v_valid_code := c.code; v_coupon_id := c.id;
        end if;
      end if;
    end if;
  end if;

  if v_has_phys then
    v_ship := coalesce(st.shipping_fee, 0);
    if st.free_shipping_above is not null and (v_sub - v_disc) >= st.free_shipping_above then v_ship := 0; end if;
  end if;

  return jsonb_build_object(
    'lines', lines, 'subtotal', v_sub, 'discount', v_disc, 'shipping', v_ship, 'total', v_sub - v_disc + v_ship,
    'has_physical', v_has_phys, 'has_ebook', v_has_ebook, 'coupon_code', v_valid_code, 'coupon_id', v_coupon_id, 'coupon_error', v_err,
    'free_shipping_above', st.free_shipping_above);
end $$;
revoke all on function public._shop_calc(jsonb, text, text) from public, anon, authenticated;

-- ── what the public shop shows ──
create or replace function public.shop_public_info() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare st shop_settings;
begin
  select * into st from shop_settings where id;
  if not coalesce(st.enabled, false) then return jsonb_build_object('enabled', false); end if;
  return jsonb_build_object(
    'enabled', true, 'shop_name', st.shop_name, 'tagline', st.tagline, 'intro_text', st.intro_text,
    'currency_symbol', st.currency_symbol, 'accept_upi', st.accept_upi, 'upi_id', st.upi_id, 'upi_payee_name', st.upi_payee_name,
    'upi_qr_url', st.upi_qr_url, 'shipping_fee', st.shipping_fee, 'free_shipping_above', st.free_shipping_above, 'shipping_note', st.shipping_note,
    'whatsapp_number', st.whatsapp_number, 'contact_email', st.contact_email, 'support_phone', st.support_phone,
    'policy_text', st.policy_text, 'thank_you_note', st.thank_you_note,
    'has_coupons', exists (select 1 from shop_coupons c where c.active and (c.valid_until is null or c.valid_until > now())));
end $$;
revoke all on function public.shop_public_info() from public;
grant execute on function public.shop_public_info() to anon, authenticated;

create or replace function public.shop_public_products(p_id uuid default null)
returns table (
  id uuid, title text, subtitle text, description text, images text[],
  physical_enabled boolean, physical_price numeric, physical_mrp numeric, physical_stock_left integer, physical_in_stock boolean,
  ebook_enabled boolean, ebook_price numeric, ebook_mrp numeric, featured boolean, display_order integer)
language sql stable security definer set search_path = public as $$
  select p.id, p.title, p.subtitle, p.description, p.images,
         (p.physical_enabled and p.physical_price is not null), p.physical_price, p.physical_mrp,
         case when p.physical_stock is null then null else greatest(p.physical_stock, 0) end,
         (p.physical_stock is null or p.physical_stock > 0),
         (p.ebook_enabled and p.ebook_price is not null and p.ebook_file_path is not null), p.ebook_price, p.ebook_mrp,
         p.featured, p.display_order
    from shop_products p
   where p.active and (select enabled from shop_settings where id)
     and ((p.physical_enabled and p.physical_price is not null) or (p.ebook_enabled and p.ebook_price is not null and p.ebook_file_path is not null))
     and (p_id is null or p.id = p_id)
   order by p.featured desc, p.display_order, p.created_at desc;
$$;
revoke all on function public.shop_public_products(uuid) from public;
grant execute on function public.shop_public_products(uuid) to anon, authenticated;

-- the bill for a cart (items, discount, shipping, total) - shown live in the cart and at checkout
create or replace function public.shop_quote(p_items jsonb, p_coupon text default null, p_phone text default null) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare r jsonb;
begin
  r := _shop_calc(p_items, p_coupon, p_phone);
  return r - 'coupon_id';
end $$;
revoke all on function public.shop_quote(jsonb, text, text) from public;
grant execute on function public.shop_quote(jsonb, text, text) to anon, authenticated;

-- ── placing an order ──
create or replace function public.shop_place_order(p_items jsonb, p_customer jsonb, p_coupon text default null) returns jsonb
language plpgsql security definer set search_path = public as $$
declare
  st shop_settings; r jsonb; v_name text; v_phone text; v_email text; v_addr text; v_city text; v_state text; v_pin text; v_note text;
  v_id uuid := gen_random_uuid(); v_no text; v_token text; l jsonb; v_total numeric; v_rows integer; v_status text := 'awaiting_payment';
begin
  select * into st from shop_settings where id;
  v_name := btrim(coalesce(p_customer->>'name', '')); v_phone := btrim(coalesce(p_customer->>'phone', ''));
  v_email := nullif(btrim(coalesce(p_customer->>'email', '')), ''); v_note := nullif(btrim(coalesce(p_customer->>'note', '')), '');
  v_addr := nullif(btrim(coalesce(p_customer->>'address', '')), ''); v_city := nullif(btrim(coalesce(p_customer->>'city', '')), '');
  v_state := nullif(btrim(coalesce(p_customer->>'state', '')), ''); v_pin := nullif(btrim(coalesce(p_customer->>'pincode', '')), '');
  if length(v_name) < 2 then raise exception 'Please enter your name.'; end if;
  if length(_shop_digits(v_phone)) < 10 then raise exception 'Please enter a valid mobile number.'; end if;
  if v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then raise exception 'That email address does not look right.'; end if;

  r := _shop_calc(p_items, p_coupon, v_phone);
  if btrim(coalesce(p_coupon, '')) <> '' and r->>'coupon_error' is not null then raise exception '%', r->>'coupon_error'; end if;
  if (r->>'has_physical')::boolean then
    if v_addr is null or v_city is null or v_state is null then raise exception 'Please fill in your full delivery address.'; end if;
    if v_pin is null or v_pin !~ '^\d{6}$' then raise exception 'Please enter a 6 digit pincode.'; end if;
  elsif (r->>'has_ebook')::boolean and v_email is null then
    null;  -- an e-book order is downloaded from the order page; the email is optional
  end if;

  -- a little protection against a flood of unpaid orders from one number
  if (select count(*) from shop_orders o where o.status = 'awaiting_payment' and o.created_at > now() - interval '1 hour'
        and right(_shop_digits(o.phone), 10) = right(_shop_digits(v_phone), 10)) >= 5 then
    raise exception 'You already have several unpaid orders. Please pay or cancel one of them first.';
  end if;

  -- take the stock (all or nothing)
  for l in select * from jsonb_array_elements(r->'lines') loop
    if l->>'format' = 'physical' then
      update shop_products set physical_stock = physical_stock - (l->>'qty')::integer, updated_at = now()
       where id = (l->>'product_id')::uuid and physical_stock is not null and physical_stock >= (l->>'qty')::integer;
      get diagnostics v_rows = row_count;
      if v_rows = 0 and exists (select 1 from shop_products where id = (l->>'product_id')::uuid and physical_stock is not null) then
        raise exception 'Sorry, "%" just ran out of stock.', l->>'title';
      end if;
    end if;
  end loop;

  v_total := (r->>'total')::numeric;
  v_no := coalesce(nullif(btrim(st.order_prefix), ''), 'ORD') || nextval('shop_order_seq');
  v_token := replace(gen_random_uuid()::text, '-', '');
  if v_total <= 0 then v_status := 'paid'; end if;   -- nothing to pay (a full-discount coupon)

  insert into shop_orders (id, order_no, token, status, customer_name, phone, email, ship_address, ship_city, ship_state, ship_pincode,
                           has_physical, has_ebook, subtotal, discount, coupon_code, shipping, total, payment_method, customer_note, paid_at)
  values (v_id, v_no, v_token, v_status, v_name, v_phone, v_email,
          case when (r->>'has_physical')::boolean then v_addr end, case when (r->>'has_physical')::boolean then v_city end,
          case when (r->>'has_physical')::boolean then v_state end, case when (r->>'has_physical')::boolean then v_pin end,
          (r->>'has_physical')::boolean, (r->>'has_ebook')::boolean, (r->>'subtotal')::numeric, (r->>'discount')::numeric, r->>'coupon_code',
          (r->>'shipping')::numeric, v_total, case when v_total > 0 then 'upi' end, v_note, case when v_total <= 0 then now() end);
  insert into shop_order_items (order_id, product_id, format, title, unit_price, qty, line_total)
  select v_id, (x->>'product_id')::uuid, x->>'format', x->>'title', (x->>'unit_price')::numeric, (x->>'qty')::integer, (x->>'line_total')::numeric
    from jsonb_array_elements(r->'lines') x;
  if r->>'coupon_code' is not null then update shop_coupons set used_count = used_count + 1 where code = r->>'coupon_code'; end if;

  return jsonb_build_object('order_id', v_id, 'order_no', v_no, 'token', v_token, 'total', v_total, 'status', v_status);
end $$;
revoke all on function public.shop_place_order(jsonb, jsonb, text) from public;
grant execute on function public.shop_place_order(jsonb, jsonb, text) to anon, authenticated;

-- ── the customer's own order (found by the order number plus the secret link code OR the phone number used) ──
create or replace function public._shop_find_order(p_order_no text, p_secret text) returns shop_orders
language plpgsql stable security definer set search_path = public as $$
declare o shop_orders; v_secret text := btrim(coalesce(p_secret, ''));
begin
  if v_secret = '' then return null; end if;
  select * into o from shop_orders s
   where upper(s.order_no) = upper(btrim(coalesce(p_order_no, '')))
     and (s.token = v_secret or (length(_shop_digits(v_secret)) >= 10 and right(_shop_digits(s.phone), 10) = right(_shop_digits(v_secret), 10)));
  if not found then return null; end if;
  return o;
end $$;
revoke all on function public._shop_find_order(text, text) from public, anon, authenticated;

create or replace function public.shop_get_order(p_order_no text, p_secret text) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o shop_orders; v_limit integer; v_ok boolean;
begin
  o := _shop_find_order(p_order_no, p_secret);
  if o.id is null then return null; end if;
  select ebook_download_limit into v_limit from shop_settings where id;
  v_ok := o.status in ('paid', 'shipped', 'delivered');
  return jsonb_build_object(
    'order_no', o.order_no, 'status', o.status, 'customer_name', o.customer_name, 'phone', o.phone, 'email', o.email,
    'ship_address', o.ship_address, 'ship_city', o.ship_city, 'ship_state', o.ship_state, 'ship_pincode', o.ship_pincode,
    'has_physical', o.has_physical, 'has_ebook', o.has_ebook, 'subtotal', o.subtotal, 'discount', o.discount, 'coupon_code', o.coupon_code,
    'shipping', o.shipping, 'total', o.total, 'payment_utr', o.payment_utr, 'payment_submitted_at', o.payment_submitted_at, 'paid_at', o.paid_at,
    'courier', o.courier, 'tracking_no', o.tracking_no, 'shipped_at', o.shipped_at, 'delivered_at', o.delivered_at,
    'admin_note', o.admin_note, 'created_at', o.created_at,
    'items', coalesce((select jsonb_agg(jsonb_build_object(
        'id', i.id, 'format', i.format, 'title', i.title, 'unit_price', i.unit_price, 'qty', i.qty, 'line_total', i.line_total,
        'image', (select p.images[1] from shop_products p where p.id = i.product_id),
        'can_download', (i.format = 'ebook' and v_ok and (v_limit is null or i.download_count < v_limit)),
        'downloads_left', case when i.format = 'ebook' and v_limit is not null then greatest(v_limit - i.download_count, 0) end)
        order by i.format, i.title) from shop_order_items i where i.order_id = o.id), '[]'::jsonb));
end $$;
revoke all on function public.shop_get_order(text, text) from public;
grant execute on function public.shop_get_order(text, text) to anon, authenticated;

create or replace function public.shop_submit_payment(p_order_no text, p_secret text, p_utr text, p_proof_path text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o shop_orders; v_utr text := btrim(coalesce(p_utr, ''));
begin
  o := _shop_find_order(p_order_no, p_secret);
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('awaiting_payment', 'payment_submitted') then raise exception 'This order does not need a payment.'; end if;
  if v_utr !~ '^[A-Za-z0-9]{6,40}$' then raise exception 'Please enter the UTR / transaction id from your UPI app (letters and numbers only).'; end if;
  update shop_orders set payment_utr = v_utr, payment_proof_path = coalesce(nullif(btrim(coalesce(p_proof_path, '')), ''), payment_proof_path),
         status = 'payment_submitted', payment_submitted_at = now(), updated_at = now()
   where id = o.id;
end $$;
revoke all on function public.shop_submit_payment(text, text, text, text) from public;
grant execute on function public.shop_submit_payment(text, text, text, text) to anon, authenticated;

-- gives stock and the coupon use back (used when an order is cancelled)
create or replace function public._shop_release_order(p_order uuid) returns void
language plpgsql security definer set search_path = public as $$
declare i record; o shop_orders;
begin
  select * into o from shop_orders where id = p_order;
  for i in select * from shop_order_items where order_id = p_order and format = 'physical' and product_id is not null loop
    update shop_products set physical_stock = physical_stock + i.qty, updated_at = now() where id = i.product_id and physical_stock is not null;
  end loop;
  if o.coupon_code is not null then update shop_coupons set used_count = greatest(used_count - 1, 0) where code = o.coupon_code; end if;
end $$;
revoke all on function public._shop_release_order(uuid) from public, anon, authenticated;

create or replace function public.shop_cancel_order(p_order_no text, p_secret text) returns void
language plpgsql security definer set search_path = public as $$
declare o shop_orders;
begin
  o := _shop_find_order(p_order_no, p_secret);
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status <> 'awaiting_payment' then raise exception 'This order can no longer be cancelled here. Please contact the shop.'; end if;
  update shop_orders set status = 'cancelled', updated_at = now() where id = o.id;
  perform _shop_release_order(o.id);
end $$;
revoke all on function public.shop_cancel_order(text, text) from public;
grant execute on function public.shop_cancel_order(text, text) to anon, authenticated;

-- ── the owner moves an order along ──
-- p_status: paid | awaiting_payment (payment not received: back to the customer, who can send the right UTR) | shipped | delivered | cancelled
create or replace function public.shop_admin_set_order_status(p_order uuid, p_status text, p_courier text default null, p_tracking text default null, p_note text default null) returns void
language plpgsql security definer set search_path = public as $$
declare o shop_orders;
begin
  if not public.current_company_is_platform_operator() then raise exception 'Only the shop owner can do this.' using errcode = '42501'; end if;
  select * into o from shop_orders where id = p_order;
  if not found then raise exception 'Order not found.'; end if;
  if o.status = 'cancelled' then raise exception 'This order was cancelled.'; end if;

  if p_status = 'paid' then
    if o.status not in ('awaiting_payment', 'payment_submitted') then raise exception 'This order is already paid.'; end if;
    update shop_orders set status = 'paid', paid_at = now(), admin_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), admin_note), updated_at = now() where id = p_order;
  elsif p_status = 'awaiting_payment' then
    if o.status <> 'payment_submitted' then raise exception 'Only a payment that was submitted can be sent back.'; end if;
    update shop_orders set status = 'awaiting_payment', admin_note = nullif(btrim(coalesce(p_note, '')), ''), updated_at = now() where id = p_order;
  elsif p_status = 'shipped' then
    if o.status not in ('paid', 'shipped') then raise exception 'Confirm the payment first.'; end if;
    update shop_orders set status = 'shipped', courier = nullif(btrim(coalesce(p_courier, '')), ''), tracking_no = nullif(btrim(coalesce(p_tracking, '')), ''),
           shipped_at = coalesce(shipped_at, now()), admin_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), admin_note), updated_at = now() where id = p_order;
  elsif p_status = 'delivered' then
    if o.status not in ('paid', 'shipped', 'delivered') then raise exception 'Confirm the payment first.'; end if;
    update shop_orders set status = 'delivered', delivered_at = coalesce(delivered_at, now()), updated_at = now() where id = p_order;
  elsif p_status = 'cancelled' then
    if o.status = 'delivered' then raise exception 'A delivered order cannot be cancelled.'; end if;
    update shop_orders set status = 'cancelled', admin_note = coalesce(nullif(btrim(coalesce(p_note, '')), ''), admin_note), updated_at = now() where id = p_order;
    perform _shop_release_order(p_order);
  else
    raise exception 'Unknown status.';
  end if;
end $$;
revoke all on function public.shop_admin_set_order_status(uuid, text, text, text, text) from public, anon;
grant execute on function public.shop_admin_set_order_status(uuid, text, text, text, text) to authenticated;

-- ── e-book download: only the edge function (service role) may ask; it checks the order, its payment and the limit ──
create or replace function public.shop_authorize_download(p_order_no text, p_secret text, p_item uuid)
returns table (file_path text, file_name text)
language plpgsql security definer set search_path = public as $$
declare o shop_orders; it shop_order_items; p shop_products; v_limit integer;
begin
  o := _shop_find_order(p_order_no, p_secret);
  if o.id is null then raise exception 'Order not found.'; end if;
  if o.status not in ('paid', 'shipped', 'delivered') then raise exception 'The download opens once your payment is confirmed.'; end if;
  select * into it from shop_order_items where id = p_item and order_id = o.id and format = 'ebook';
  if not found then raise exception 'That e-book is not part of this order.'; end if;
  select ebook_download_limit into v_limit from shop_settings where id;
  if v_limit is not null and it.download_count >= v_limit then raise exception 'The download limit for this e-book is over. Please contact the shop.'; end if;
  select * into p from shop_products where id = it.product_id;
  if p.id is null or p.ebook_file_path is null then raise exception 'This e-book file is not available. Please contact the shop.'; end if;
  update shop_order_items set download_count = download_count + 1 where id = it.id;
  return query select p.ebook_file_path, coalesce(nullif(p.ebook_file_name, ''), p.title);
end $$;
revoke all on function public.shop_authorize_download(text, text, uuid) from public, anon, authenticated;
grant execute on function public.shop_authorize_download(text, text, uuid) to service_role;

-- ── picture / file storage ──
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types) values
  ('shop-images', 'shop-images', true, 8388608, array['image/png', 'image/jpeg', 'image/webp', 'image/gif']),
  ('shop-ebooks', 'shop-ebooks', false, 52428800, null),
  ('shop-proofs', 'shop-proofs', false, 5242880, array['image/png', 'image/jpeg', 'image/webp'])
on conflict (id) do update set public = excluded.public, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists shop_images_public_read on storage.objects;
create policy shop_images_public_read on storage.objects for select using (bucket_id = 'shop-images');
drop policy if exists shop_images_operator_write on storage.objects;
create policy shop_images_operator_write on storage.objects for all to authenticated
  using (bucket_id = 'shop-images' and public.current_company_is_platform_operator())
  with check (bucket_id = 'shop-images' and public.current_company_is_platform_operator());

drop policy if exists shop_ebooks_operator_all on storage.objects;
create policy shop_ebooks_operator_all on storage.objects for all to authenticated
  using (bucket_id = 'shop-ebooks' and public.current_company_is_platform_operator())
  with check (bucket_id = 'shop-ebooks' and public.current_company_is_platform_operator());

-- a customer (not signed in) may drop a payment screenshot; only the owner can look at it
drop policy if exists shop_proofs_customer_insert on storage.objects;
create policy shop_proofs_customer_insert on storage.objects for insert to anon, authenticated with check (bucket_id = 'shop-proofs');
drop policy if exists shop_proofs_operator_read on storage.objects;
create policy shop_proofs_operator_read on storage.objects for select to authenticated using (bucket_id = 'shop-proofs' and public.current_company_is_platform_operator());
drop policy if exists shop_proofs_operator_delete on storage.objects;
create policy shop_proofs_operator_delete on storage.objects for delete to authenticated using (bucket_id = 'shop-proofs' and public.current_company_is_platform_operator());
