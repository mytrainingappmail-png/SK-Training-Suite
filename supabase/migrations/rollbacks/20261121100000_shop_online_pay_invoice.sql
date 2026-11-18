-- Rollback: removes online payment + invoice support from the shop. Re-apply shop_public_info / shop_get_order from 20261120100000_shop.sql afterwards.
drop function if exists public.shop_mark_invoice_sent(uuid);
drop function if exists public.shop_order_invoice_data(uuid);
drop function if exists public.shop_mark_paid_razorpay(uuid, text, text, bigint);
drop function if exists public.shop_set_razorpay_order(uuid, text);
drop function if exists public.shop_order_for_payment(text, text);
drop index if exists public.idx_shop_orders_rzp_payment;
alter table public.shop_orders drop column if exists invoice_sent_at, drop column if exists razorpay_payment_id, drop column if exists razorpay_order_id;
alter table public.shop_settings drop column if exists public_site_url, drop column if exists invoice_subject, drop column if exists invoice_message, drop column if exists invoice_details, drop column if exists send_invoice_email, drop column if exists razorpay_enabled;
