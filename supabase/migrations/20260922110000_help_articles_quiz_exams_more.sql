-- Help Center: guides for Live Quiz, Exams, Surveys, Performance Tracker,
-- Calling App and bulk import. Idempotent (skips a title that already exists).

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Running a Live Quiz', 1, 'live quiz, pin, host, join, tv, questions, timer, pause, shuffle',
$art$<p>Live Quiz is a separate product with its own login (Quiz Admin). Trainees never need an account — they join with a PIN.</p>
<ol>
<li>Go to <strong>Quizzes</strong> → <strong>New Quiz</strong>. Add questions (multiple choice, true/false or a click-the-map question). Give each question its own timer, or leave the default.</li>
<li>Turn on <strong>Shuffle questions per participant</strong> and <strong>Shuffle options</strong> so neighbours cannot copy from each other — everyone sees a different order.</li>
<li><strong>Publish</strong> the quiz, then click <strong>Start</strong>. A PIN appears; show it on the TV or share the link.</li>
<li>Trainees open the link, enter the PIN and their name. You start each question from the Host screen.</li>
</ol>
<h2>Good to know</h2>
<ul>
<li><strong>Pause / Resume</strong> works mid-question; an already answered question stays answered after resume.</li>
<li>If a phone hangs or loses network it reconnects and continues from the current question.</li>
<li>Timers and deadlines run on the <strong>server clock</strong>, so a wrong phone clock cannot give anyone extra time.</li>
<li>The host screen shows the score % at the end and can hand out certificates straight from the TV screen.</li>
</ul>$art$
where not exists (select 1 from help_articles where title = 'Running a Live Quiz');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Click-the-Map Questions (Hotspot)', 2, 'map, hotspot, image, zone, circle, rectangle, polygon, bulk marking, draft',
$art$<p>A click-the-map question shows an image (for example a master plan) and asks the trainee to tap the correct spot.</p>
<h2>Marking the correct area</h2>
<ul>
<li>Upload the image, then draw one or more <strong>zones</strong>. A zone can be a <strong>circle</strong>, a <strong>rectangle</strong> or a free-form <strong>polygon</strong> — use the shape that fits the landmark.</li>
<li>A tap inside <em>any</em> zone counts as correct, so one landmark can have several acceptable areas.</li>
<li><strong>Bulk marking:</strong> one map can carry many questions. Open the bulk marker, pick a question from the list and tap its position on the map. You never need a separate map per question.</li>
</ul>
<h2>Saving as draft</h2>
<p>You can save a quiz as a <strong>Draft</strong> even when some map points are not marked yet. The unmarked questions are listed so you can finish later. <strong>Publish</strong> checks everything and tells you exactly what is missing.</p>
<p>Trainees can zoom with + / − and drag to look around before tapping.</p>$art$
where not exists (select 1 from help_articles where title = 'Click-the-Map Questions (Hotspot)');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Merging Quizzes and Removing Duplicates', 3, 'merge, duplicate, questions, source, resync, delete quizzes',
$art$<p>You can merge several quizzes into one (for example one quiz per project into a final test).</p>
<ul>
<li>Merged questions are tagged with their <strong>source project</strong>, so one project's questions can be removed later.</li>
<li><strong>Duplicates are skipped automatically</strong> — a question with the same type and text is added only once. After a merge you see how many duplicates were skipped.</li>
<li>Use the bulk-select on the Quizzes list to delete old test quizzes in one go.</li>
</ul>
<p>If trainees report a question repeating, check for duplicate questions in the quiz first — they are usually copies from overlapping merges.</p>$art$
where not exists (select 1 from help_articles where title = 'Merging Quizzes and Removing Duplicates');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Quiz Certificates', 4, 'certificate, template, watermark, logo, signature, photo, seal, top 3',
$art$<p>Set up the certificate once in <strong>Settings → Certificate</strong>; every quiz and exam uses it.</p>
<ul>
<li>Choose a template, company name and alignment, logo (position and size), title and achievement line.</li>
<li><strong>Watermark:</strong> none, text, or a dedicated watermark <em>image</em>.</li>
<li>Up to two signatories with signature images, an award seal, and an optional candidate photo in a frame.</li>
<li><strong>Who gets one:</strong> everyone who passes, only the top 1, or only the top 3.</li>
</ul>
<p>Turn <strong>Issue certificate</strong> on or off per quiz in the quiz builder. The host downloads a certificate for any passing person from the results screen.</p>$art$
where not exists (select 1 from help_articles where title = 'Quiz Certificates');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Final Result and Batch Folders', 5, 'final result, batch, folder, records, archive, csv, exam',
$art$<p>Keep a batch's final tests together, away from everyday practice sessions.</p>
<ol>
<li>Create a folder in <strong>Final Result → Folders</strong> (for example "Batch 12").</li>
<li>Live Quiz: on <strong>Results</strong>, move the finished session into the folder.</li>
<li>Exam: on the exam's results page use the <strong>📁 folder</strong> menu to pick the same folder.</li>
</ol>
<p>One folder holds both, so a batch's project test and induction test sit side by side. A folder can only be deleted when it is empty. Use <strong>Download CSV</strong> for the Live Quiz sessions in a folder; each exam has its own CSV.</p>$art$
where not exists (select 1 from help_articles where title = 'Final Result and Batch Folders');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'exams', 'Creating and Running an Exam', 1, 'exam, paper test, timer, written answer, photo, induction, pin, start',
$art$<p><strong>Exams</strong> are paper-style tests: the employee sees <em>all</em> questions on one screen and answers in any order, against one timer for the whole paper.</p>
<h2>Create</h2>
<ol>
<li>Open the <strong>Exams</strong> tab → <strong>New Exam</strong>.</li>
<li>Set <strong>Paper time (min)</strong> (for example 60) and the pass %.</li>
<li>Add questions: multiple choice, true/false, click-the-map, or <strong>Written answer</strong> (typed text and/or photo upload).</li>
<li>Keep the shuffle switches on — each employee gets a different question order and option order.</li>
<li><strong>Publish</strong> the exam.</li>
</ol>
<h2>Run</h2>
<ol>
<li>Click <strong>Start</strong>, confirm the minutes, choose <em>now</em>, <em>in X minutes</em> or <em>at a date and time</em>.</li>
<li>Share the link or PIN (the page has a WhatsApp-ready copy button). Employees enter PIN and name.</li>
<li>Watch the live monitor: who joined, who submitted, how many questions each has answered, and tab switches.</li>
<li>Need more time for everyone? Use <strong>Extend time</strong>. Everyone finishes together when the timer ends; employees may also submit early.</li>
</ol>
<p>Answers save automatically, even on a weak connection, and the deadline is enforced by the server.</p>$art$
where not exists (select 1 from help_articles where title = 'Creating and Running an Exam');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'exams', 'Marking Written Answers and Releasing Results', 2, 'marking, grade, written, release results, certificate, csv, hardest questions',
$art$<p>Employees do <strong>not</strong> see any result when they submit. You see everything together once the exam has finished.</p>
<ol>
<li>Click <strong>End exam &amp; show results</strong> (or wait for the timer). The table shows marks, %, pass/fail, rank and tab switches.</li>
<li>Open <strong>View / mark</strong> for a person, read the typed answer and photos, enter marks (up to the question's maximum) and an optional comment. Written answers are marked <strong>by hand only</strong>.</li>
<li>When everything is marked, click <strong>Release results to employees</strong>. Each employee then sees their own answers, the correct answers and marks. You can hide them again any time.</li>
<li>For those who passed, the <strong>↓ Certificate</strong> button appears once their written answers are marked.</li>
</ol>
<p>Also on this page: <strong>Download CSV</strong>, a <strong>folder</strong> menu to file the result in a batch folder, and <strong>Which questions were hardest</strong> to see what needs more training.</p>$art$
where not exists (select 1 from help_articles where title = 'Marking Written Answers and Releasing Results');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'exams', 'Taking an Exam (for employees)', 3, 'employee, exam, join, pin, submit, photo, flag, timer',
$art$<ol>
<li>Open the exam link, or go to <strong>/exam</strong> and enter the PIN and your name.</li>
<li>Wait in the lobby until the exam starts. A single timer at the top counts down for the whole paper.</li>
<li>Scroll through the questions and answer in any order. Tap <strong>Review later</strong> to flag one. The bottom bar shows how many you have answered.</li>
<li>For written questions, type your answer and/or add a photo of your written work (camera or gallery).</li>
<li>Tap <strong>Submit</strong> when you are done — you can submit early. After submitting you cannot change anything.</li>
</ol>
<p>Your answers save automatically. If your internet drops they are kept on your phone and sent when it returns. Please stay on the exam page — leaving the tab is recorded. Your result appears only after your trainer releases it.</p>$art$
where not exists (select 1 from help_articles where title = 'Taking an Exam (for employees)');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'surveys', 'Survey Timing: Duration, Start Timer and Question Timer', 1, 'survey, timer, duration, start, go live, extend, per question',
$art$<p>All survey timing is under your control — nothing is fixed.</p>
<h2>Go Live</h2>
<ul>
<li><strong>Duration</strong> is how long the survey stays open after it starts (not the start time). Pick a preset, type a custom number of minutes, or choose <em>No limit</em>.</li>
<li><strong>Start:</strong> <em>Now</em>, <em>In X min</em>, or <em>At a time</em>. Respondents wait in a lobby with a live countdown.</li>
<li>On the host screen use <strong>Start now</strong> to skip the wait and <strong>Extend time</strong> to add minutes.</li>
</ul>
<h2>Per-question timer</h2>
<p>In the survey builder, each question has an optional ⏱ seconds box (5–3600). When set, the respondent sees a countdown and the survey moves to the next question automatically at zero; required answers are not enforced for a timed-out question.</p>
<h2>Presets</h2>
<p>Edit the duration buttons and the default duration in <strong>Surveys → Settings</strong>.</p>$art$
where not exists (select 1 from help_articles where title = 'Survey Timing: Duration, Start Timer and Question Timer');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'performance_tracker', 'Score, Achievement % and the Report Builder', 1, 'performance tracker, score, weight, achievement, site visit, f2f, report builder, leaderboard',
$art$<p>The Performance Tracker records each salesperson's morning commitment and evening report.</p>
<h2>Score vs Achievement %</h2>
<ul>
<li><strong>Score</strong> = number done × the points you set per unit in Settings. If a site visit is worth 10, then 1 visit = 10, 2 visits = 20, 3 = 30. There is no cap, so doing more always raises the score.</li>
<li><strong>Achievement %</strong> = done ÷ planned. Doing more than planned shows above 100%, capped at 150%.</li>
</ul>
<p>The leaderboard can rank by score, bookings, achievement or a blend — choose it in Settings.</p>
<h2>Report builder</h2>
<p>In <strong>Reports</strong> pick teams, departments, people, the metrics you want (F2F, site visits, revisits, calls, connected, talk time), a date range, and whether to show plan, achievement or both. Export the result when ready.</p>$art$
where not exists (select 1 from help_articles where title = 'Score, Achievement % and the Report Builder');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'calling_app', 'Master Sheet, Distribution and Bulk Upload', 1, 'calling app, master sheet, upload csv, distribute, duplicate, recall, leads',
$art$<p>The Master Sheet is the pool of unassigned leads. Only people with Master Sheet authority see it.</p>
<ol>
<li><strong>Upload:</strong> use <strong>Sample CSV</strong> for the format (Name and Mobile are required). Numbers are tidied automatically ("+91 98765-43210" becomes 9876543210), repeats inside the same file are skipped, and numbers already in the system are listed so you can skip them. Large files upload in batches.</li>
<li><strong>Distribute:</strong> pick employees and how many leads each; the oldest unassigned leads go first. A lead already handed out by someone else at the same moment is never taken back, and each employee is notified with the real count.</li>
<li><strong>Auto-distribution</strong> (Settings) tops up an agent when their batch is worked.</li>
<li><strong>Recall</strong> pulls unworked leads back into the pool; <strong>Duplicates</strong> finds repeated numbers and keeps the oldest entry after you confirm.</li>
</ol>
<p>Lists of any size work — the app reads every lead, not just the first thousand.</p>$art$
where not exists (select 1 from help_articles where title = 'Master Sheet, Distribution and Bulk Upload');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'general', 'Bulk Import of Courses, Categories and Modules (CSV)', 20, 'csv, import, bulk, course, category, module, superadmin',
$art$<p>Super Admins can create many courses, categories and modules at once from a CSV file in <strong>Course Management → Bulk Import</strong>. Download the sample, fill it in, upload, review the preview, then confirm. Rows with problems are listed so you can fix and re-upload.</p>$art$
where not exists (select 1 from help_articles where title = 'Bulk Import of Courses, Categories and Modules (CSV)');
