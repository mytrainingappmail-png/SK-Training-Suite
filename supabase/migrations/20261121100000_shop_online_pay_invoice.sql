-- Shop: automatic online payment (Razorpay) and the email invoice.
--
-- * Razorpay: a customer can pay an order online (cards, UPI, netbanking, wallets); the order becomes PAID by itself the moment
--   Razorpay confirms the payment (checked on the server with Razorpay's signature, and again by the Razorpay webhook as a safety
--   net if the customer closes the page). UPI / QR with manual confirmation stays available. The owner switches Razorpay on or off.
-- * Invoice: when an order is paid (online, or confirmed by the owner) the customer gets an email with the bill and a link to the
--   order page (tracking, e-book download). The owner can switch it off, add his business details (name, address, GSTIN) and send it again.
--
-- The functions that move money / send mail are for the server only (service role); the customer's browser can never mark an order paid.
-- Additive only.

alter table public.shop_settings add column if not exists razorpay_enabled boolean not null default false;
alter table public.shop_settings add column if not exists send_invoice_email boolean not null default true;
alter table public.shop_settings add column if not exists invoice_details text;     -- business name, address, GSTIN... shown on the invoice
alter table public.shop_settings add column if not exists invoice_subject text;      -- email subject; {order_no} and {shop_name} are filled in
alter table public.shop_settings add column if not exists invoice_message text;      -- the opening words of the invoice email
alter table public.shop_settings add column if not exists public_site_url text;      -- e.g. https://realtrainer.net - used for the link in the invoice email

alter table public.shop_orders add column if not exists razorpay_order_id text;
alter table public.shop_orders add column if not exists razorpay_payment_id text;
alter table public.shop_orders add column if not exists invoice_sent_at timestamptz;
create unique index if not exists idx_shop_orders_rzp_payment on public.shop_orders (razorpay_payment_id) where razorpay_payment_id is not null;

-- the public shop also needs to know whether to offer online payment
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
    'policy_text', st.policy_text, 'thank_you_note', st.thank_you_note, 'razorpay_enabled', st.razorpay_enabled,
    'has_coupons', exists (select 1 from shop_coupons c where c.active and (c.valid_until is null or c.valid_until > now())));
end $$;
revoke all on function public.shop_public_info() from public;
grant execute on function public.shop_public_info() to anon, authenticated;

-- the customer's order page also shows how it was paid
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
    'shipping', o.shipping, 'total', o.total, 'payment_method', o.payment_method, 'payment_utr', o.payment_utr, 'payment_submitted_at', o.payment_submitted_at, 'paid_at', o.paid_at,
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

-- ── server only: start an online payment ──
-- finds the order (order number + secret code or phone) and says what has to be paid
create or replace function public.shop_order_for_payment(p_order_no text, p_secret text)
returns table (id uuid, order_no text, total numeric, status text, customer_name text, phone text, email text, razorpay_order_id text)
language plpgsql stable security definer set search_path = public as $$
declare o shop_orders;
begin
  o := _shop_find_order(p_order_no, p_secret);
  if o.id is null then raise exception 'Order not found.'; end if;
  return query select o.id, o.order_no, o.total, o.status, o.customer_name, o.phone, o.email, o.razorpay_order_id;
end $$;
revoke all on function public.shop_order_for_payment(text, text) from public, anon, authenticated;
grant execute on function public.shop_order_for_payment(text, text) to service_role;

create or replace function public.shop_set_razorpay_order(p_order uuid, p_rzp_order text) returns void
language sql security definer set search_path = public as $$
  update shop_orders set razorpay_order_id = p_rzp_order, payment_method = 'razorpay', updated_at = now() where id = p_order and status in ('awaiting_payment', 'payment_submitted');
$$;
revoke all on function public.shop_set_razorpay_order(uuid, text) from public, anon, authenticated;
grant execute on function public.shop_set_razorpay_order(uuid, text) to service_role;

-- ── server only: Razorpay confirmed a payment ──
-- Safe to call twice (the checkout confirmation and the webhook both call it): the order is marked paid once.
-- The amount must cover the order total; a payment for an order that was cancelled in the meantime is NOT accepted silently - the
-- order gets a note so the owner refunds it in Razorpay.
create or replace function public.shop_mark_paid_razorpay(p_order uuid, p_payment_id text, p_rzp_order text, p_amount_paise bigint)
returns jsonb
language plpgsql security definer set search_path = public as $$
declare o shop_orders;
begin
  select * into o from shop_orders where id = p_order for update;
  if not found then return jsonb_build_object('ok', false, 'reason', 'order_not_found'); end if;
  if p_amount_paise < round(o.total * 100) then
    update shop_orders set admin_note = 'Online payment ' || p_payment_id || ' was LESS than the order total - check it in Razorpay.', updated_at = now() where id = p_order;
    return jsonb_build_object('ok', false, 'reason', 'amount_too_low', 'order_no', o.order_no);
  end if;
  if o.razorpay_payment_id is not null and o.razorpay_payment_id = p_payment_id then
    return jsonb_build_object('ok', true, 'changed', false, 'order_no', o.order_no, 'status', o.status);   -- already recorded
  end if;
  if o.status = 'cancelled' then
    update shop_orders set admin_note = 'Online payment ' || p_payment_id || ' arrived after this order was cancelled - refund it in Razorpay.', razorpay_payment_id = p_payment_id, updated_at = now() where id = p_order;
    return jsonb_build_object('ok', false, 'reason', 'cancelled', 'order_no', o.order_no);
  end if;
  if o.status in ('paid', 'shipped', 'delivered') then
    update shop_orders set admin_note = coalesce(admin_note || E'\n', '') || 'A second payment ' || p_payment_id || ' arrived - refund it in Razorpay if it is a duplicate.', updated_at = now() where id = p_order;
    return jsonb_build_object('ok', true, 'changed', false, 'order_no', o.order_no, 'status', o.status);
  end if;
  update shop_orders set status = 'paid', paid_at = now(), payment_method = 'razorpay', razorpay_payment_id = p_payment_id,
         razorpay_order_id = coalesce(p_rzp_order, razorpay_order_id), payment_utr = coalesce(payment_utr, p_payment_id),
         admin_note = case when admin_note like 'Payment not found%' then null else admin_note end, updated_at = now()
   where id = p_order;
  return jsonb_build_object('ok', true, 'changed', true, 'order_no', o.order_no, 'status', 'paid');
end $$;
revoke all on function public.shop_mark_paid_razorpay(uuid, text, text, bigint) from public, anon, authenticated;
grant execute on function public.shop_mark_paid_razorpay(uuid, text, text, bigint) to service_role;

-- ── server only: everything the invoice email needs ──
create or replace function public.shop_order_invoice_data(p_order uuid) returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare o shop_orders; st shop_settings;
begin
  select * into o from shop_orders where id = p_order;
  if not found then return null; end if;
  select * into st from shop_settings where id;
  return jsonb_build_object(
    'order', to_jsonb(o) - 'payment_proof_path',
    'items', coalesce((select jsonb_agg(to_jsonb(i) order by i.format, i.title) from shop_order_items i where i.order_id = o.id), '[]'::jsonb),
    'settings', jsonb_build_object(
      'shop_name', st.shop_name, 'currency_symbol', st.currency_symbol, 'invoice_details', st.invoice_details, 'public_site_url', st.public_site_url,
      'send_invoice_email', st.send_invoice_email, 'invoice_subject', st.invoice_subject, 'invoice_message', st.invoice_message, 'contact_email', st.contact_email, 'support_phone', st.support_phone, 'whatsapp_number', st.whatsapp_number,
      'thank_you_note', st.thank_you_note));
end $$;
revoke all on function public.shop_order_invoice_data(uuid) from public, anon, authenticated;
grant execute on function public.shop_order_invoice_data(uuid) to service_role;

create or replace function public.shop_mark_invoice_sent(p_order uuid) returns void
language sql security definer set search_path = public as $$
  update shop_orders set invoice_sent_at = now() where id = p_order;
$$;
revoke all on function public.shop_mark_invoice_sent(uuid) from public, anon, authenticated;
grant execute on function public.shop_mark_invoice_sent(uuid) to service_role;
