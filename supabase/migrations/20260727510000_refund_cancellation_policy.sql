-- Third legal_documents entry, needed alongside Terms/Privacy for payment
-- gateway (Razorpay) activation compliance. Same public-read pattern as
-- 20260724130000_legal_documents.sql.

insert into legal_documents (slug, title, content_html)
select 'refund-and-cancellation', 'Refund & Cancellation Policy',
$doc$<p><em>Last updated: 27 July 2026</em></p>
<p>This Refund &amp; Cancellation Policy applies to companies that subscribe to use this training platform (the "Platform") under a paid plan.</p>

<h3>1. Subscription Cancellation</h3>
<p>1.1. A Subscribing Company may request cancellation of its subscription at any time by contacting the Platform operator (see Contact Us). Cancellation takes effect at the end of the current billing cycle already paid for; access is not withdrawn mid-cycle.</p>
<p>1.2. On cancellation, the Subscribing Company may request an export of its own data within a reasonable period before the account and its data are deleted.</p>

<h3>2. Refunds</h3>
<p>2.1. Fees already paid for the current billing cycle (monthly or yearly, as agreed at subscription) are non-refundable once that cycle has started, except as set out below.</p>
<p>2.2. If a payment was charged in error (e.g. a duplicate charge, or a charge after cancellation was already confirmed), the Subscribing Company is entitled to a full refund of that specific charge. Refund requests should be raised within 7 days of the charge.</p>
<p>2.3. For yearly plans cancelled partway through the year, a pro-rated refund for the unused remaining full months may be issued at the Platform operator's discretion, less any setup or onboarding costs already incurred.</p>
<p>2.4. Approved refunds are processed to the original payment method within 7-10 business days.</p>

<h3>3. Trial &amp; Complimentary Plans</h3>
<p>3.1. Trial and complimentary (no-payment) licenses are not subject to this refund policy, as no payment is collected for them.</p>

<h3>4. How to Request a Cancellation or Refund</h3>
<p>4.1. Send a request from the admin email on file to the contact details listed on the Contact Us page, stating the company name, company code, and reason for the request.</p>

<h3>5. Changes to This Policy</h3>
<p>5.1. This Policy may be updated from time to time; the "Last updated" date above will reflect the most recent revision.</p>

<p><strong>Note: this document is a general starting-point template and has not been reviewed by a lawyer. It should be reviewed by qualified legal counsel and updated to reflect your actual billing and refund practices before being relied upon.</strong></p>$doc$
where not exists (select 1 from legal_documents where slug = 'refund-and-cancellation');
