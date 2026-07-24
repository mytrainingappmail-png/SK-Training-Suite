-- Legal documents (Terms & Conditions, Privacy Policy) — genuinely
-- public content (needs to be readable by anyone, including a
-- prospective subscribing company or a trainee before they even log in),
-- so RLS read is fully open, not just "any authenticated user" like
-- Help Center. Writes are still restricted to the platform operator.
--
-- Seeded with real starter drafts covering the two audiences this
-- platform actually has (subscribing companies and their trainee
-- employees) - these are a reasonable starting point, NOT a substitute
-- for review by a qualified lawyer before being relied on for real
-- legal protection.

create table if not exists legal_documents (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  title text not null,
  content_html text not null default '',
  updated_at timestamptz not null default now()
);

alter table legal_documents enable row level security;

create policy legal_documents_read on legal_documents
  for select using (true);

create policy legal_documents_write on legal_documents
  for insert with check (current_company_is_platform_operator());

create policy legal_documents_update on legal_documents
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

create policy legal_documents_delete on legal_documents
  for delete using (current_company_is_platform_operator());

insert into legal_documents (slug, title, content_html)
select 'terms-of-service', 'Terms & Conditions',
$doc$<p><em>Last updated: 24 July 2026</em></p>
<p>These Terms &amp; Conditions ("Terms") govern the use of this training platform (the "Platform") by (a) companies that subscribe to use the Platform ("Subscribing Companies") and (b) individual employees/trainees who are given access by a Subscribing Company ("Trainees"). By accessing or using the Platform, you agree to these Terms.</p>

<h3>1. For Subscribing Companies</h3>
<p>1.1. A Subscribing Company is responsible for all activity under its account, including the accuracy of data it uploads (employee records, course content, assessments, certificates, branding assets) and for maintaining the confidentiality of admin credentials.</p>
<p>1.2. Subscription fees, billing cycles, and plan entitlements are as agreed at the time of subscription. Non-payment may result in suspension or downgrade of access.</p>
<p>1.3. The Subscribing Company warrants that it has the right to upload and use all content (courses, branding, employee data) it places on the Platform, and will not upload unlawful, infringing, or defamatory material.</p>
<p>1.4. The Subscribing Company is responsible for obtaining any consents required from its own employees/Trainees for their data to be processed on the Platform.</p>

<h3>2. For Trainees</h3>
<p>2.1. A Trainee's access is provided by, and remains subject to the policies of, their employing Subscribing Company. Account credentials are personal and must not be shared.</p>
<p>2.2. Course content, assessments, and certificates are provided for genuine training purposes. Attempting to circumvent assessment integrity (e.g. sharing answers, impersonating another Trainee) may result in results being invalidated and access restricted.</p>
<p>2.3. Trainees retain no ownership rights in course content, branded materials, or certificate templates provided through the Platform.</p>

<h3>3. Acceptable Use</h3>
<p>3.1. The Platform must not be used to upload malicious code, attempt unauthorized access to other companies' data, or otherwise interfere with the Platform's operation.</p>
<p>3.2. Data belonging to one Subscribing Company is not accessible to another Subscribing Company; each company's data is logically isolated.</p>

<h3>4. Intellectual Property</h3>
<p>4.1. The Platform's own software, design, and underlying technology remain the property of its operator. Course content, branding, and data uploaded by a Subscribing Company remain that company's property.</p>

<h3>5. Limitation of Liability</h3>
<p>5.1. The Platform is provided "as is". To the maximum extent permitted by applicable law, the Platform operator disclaims liability for indirect, incidental, or consequential damages arising from use of the Platform, including data loss, business interruption, or reliance on training outcomes.</p>
<p>5.2. Nothing in these Terms excludes liability that cannot be excluded under applicable law.</p>

<h3>6. Termination</h3>
<p>6.1. Either party may terminate a subscription per the agreed subscription terms. On termination, the Subscribing Company may request export of its own data within a reasonable period before deletion.</p>

<h3>7. Changes to These Terms</h3>
<p>7.1. These Terms may be updated from time to time. Continued use of the Platform after an update constitutes acceptance of the revised Terms.</p>

<h3>8. Governing Law</h3>
<p>8.1. These Terms are governed by the laws of India, without regard to conflict-of-law principles.</p>

<p><strong>Note: this document is a general starting-point template and has not been reviewed by a lawyer. It should be reviewed by qualified legal counsel before being relied upon, and updated to reflect your specific business, jurisdiction, and subscription agreements.</strong></p>$doc$
where not exists (select 1 from legal_documents where slug = 'terms-of-service');

insert into legal_documents (slug, title, content_html)
select 'privacy-policy', 'Privacy Policy',
$doc$<p><em>Last updated: 24 July 2026</em></p>
<p>This Privacy Policy explains what personal data this training platform (the "Platform") collects, why, and how it is protected — for both Subscribing Companies and their Trainees.</p>

<h3>1. What We Collect</h3>
<p>Employee/Trainee records (name, employee code, email, phone, department, branch, designation), login credentials, course progress, assessment results and scores, certificates issued, attendance records, and any content a Subscribing Company chooses to upload (branding assets, course material, company address/contact details).</p>

<h3>2. Why We Collect It</h3>
<p>To operate the Platform's core functions: authenticating users, tracking learning progress, issuing certificates, generating reports for company admins, and enabling company-specific branding.</p>

<h3>3. Who Can See It</h3>
<p>Data is logically isolated per Subscribing Company — one company's employees and data are not visible to another company. Within a company, visibility follows that company's own role/permission configuration (e.g. a manager may see their team's progress; an employee sees only their own).</p>

<h3>4. Data Storage &amp; Security</h3>
<p>Data is stored using industry-standard hosted database and file storage infrastructure, protected by access controls and encryption in transit. No system is perfectly secure, and this Policy does not guarantee absolute security.</p>

<h3>5. Data Retention</h3>
<p>Data is retained for as long as the Subscribing Company's subscription is active, plus a reasonable period thereafter to allow data export, unless a shorter period is required by law or agreed separately.</p>

<h3>6. Your Rights</h3>
<p>Trainees who wish to access, correct, or request deletion of their personal data should contact their employing Subscribing Company's admin, who administers their account. Subscribing Companies may contact the Platform operator directly for data export or deletion requests.</p>

<h3>7. Cookies &amp; Local Storage</h3>
<p>The Platform uses browser local storage/session tokens to keep you signed in. No third-party advertising trackers are used.</p>

<h3>8. Changes to This Policy</h3>
<p>This Policy may be updated from time to time; the "Last updated" date above will reflect the most recent revision.</p>

<p><strong>Note: this document is a general starting-point template and has not been reviewed by a lawyer. It should be reviewed by qualified legal counsel before being relied upon, and updated to reflect your specific data practices and applicable data protection law (e.g. India's DPDP Act).</strong></p>$doc$
where not exists (select 1 from legal_documents where slug = 'privacy-policy');
