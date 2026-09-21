-- Help Center: Induction, Induction-style Exam tip, Storage & plan limits, Calling App follow-ups.

insert into help_articles (category, title, display_order, keywords, content_html)
select 'getting_started', 'Induction: Day-by-Day Onboarding', 5, 'induction, onboarding, day, test, unlock, new joiner, branch, clone',
$art$<p>Induction is a simple, sequential onboarding programme for new employees.</p>
<h2>For employees</h2>
<ul>
<li>Open <strong>Induction</strong> to see your Days as cards. Read a Day's pages, then mark it complete.</li>
<li>If the Day has a Test, pass it. Attempts follow the Assessment's own rules.</li>
<li>The next Day unlocks only when the previous Day is complete <em>and</em> its test is passed <em>and</em> a new calendar day has begun — so nobody can rush the whole programme in one sitting.</li>
</ul>
<h2>For admins</h2>
<ol>
<li>Go to <strong>Induction</strong> management → add a Day: title, description, thumbnail.</li>
<li>Add sections to the Day: <strong>Page</strong> (text/media) or <strong>Test</strong>. A Test links to an existing Assessment — create it first under Assessments.</li>
<li>Drag to reorder Days. Assign the programme to employees.</li>
<li><strong>Branch-specific content:</strong> use the branch menu to clone a Day to another branch, then edit the copy.</li>
</ol>
<p><strong>Want a single timed paper test instead of day-by-day?</strong> Use the <strong>Exams</strong> tab in Live Quiz — see "Creating and Running an Exam".</p>$art$
where not exists (select 1 from help_articles where title = 'Induction: Day-by-Day Onboarding');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'settings', 'Storage, Upload Limits and Plan Storage', 5, 'storage, gb, upload, video, limit, plan, quota, supabase, youtube',
$art$<p>Every file you upload (videos, images, documents, exam photos) uses storage. Each plan has a storage allowance, so one client cannot use up everyone's space.</p>
<h2>What happens when a limit is reached</h2>
<ul>
<li>An upload that would go past the plan's storage GB is refused with a clear message.</li>
<li>A single file larger than the per-upload limit (50 MB by default) is refused too.</li>
</ul>
<h2>Tip: long videos</h2>
<p>Do not upload 1–2 hour videos. Upload them to <strong>YouTube (unlisted)</strong> or Vimeo and paste the link — the lesson plays the same, and it costs no storage.</p>
<h2>For the platform owner</h2>
<p>Open <strong>License Management</strong> to see total storage used, usage by client and by file type, the database size, and to set the per-upload limit, your Supabase storage size and the warning percentage. Set each plan's storage GB in the Plans tab.</p>$art$
where not exists (select 1 from help_articles where title = 'Storage, Upload Limits and Plan Storage');

update help_articles set content_html = content_html || $art$<h2>Follow-ups</h2>
<p>When you log a call with a "next call" time, that lead appears in <strong>⏰ Follow-ups due today</strong> at the top of your Calling Sheet as soon as the time comes — overdue ones first, in red. Tap <strong>Dial</strong> or <strong>Call &amp; Log</strong> right from the list. Logging a new call re-schedules or clears it.</p>$art$
where title = 'Master Sheet, Distribution and Bulk Upload' and content_html not like '%Follow-ups due today%';
