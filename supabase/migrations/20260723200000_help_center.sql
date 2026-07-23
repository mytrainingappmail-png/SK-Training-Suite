-- ============================================================================
-- HELP CENTER
--
-- A shared, platform-wide guide to using the app — NOT company data. Every
-- company's employees can read it (same "read open to everyone, write
-- restricted to the platform operator" convention as menus/permissions/
-- certificate_templates/learning_paths in 20260722130000_platform_operator_
-- scoping.sql), so one team (SK Enterprise) maintains the documentation and
-- every client company automatically sees the same, current guide.
-- ============================================================================

create table if not exists help_articles (
  id uuid primary key default gen_random_uuid(),
  category text not null default 'general',
  title text not null,
  content_html text not null default '',
  keywords text not null default '',
  display_order int not null default 0,
  status text not null default 'published' check (status in ('draft','published')),
  created_by uuid references employees(id) on delete set null,
  created_by_name text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_help_articles_category on help_articles (category, display_order);

alter table help_articles enable row level security;

create policy help_articles_read on help_articles
  for select using (auth.uid() is not null and (status = 'published' or current_company_is_platform_operator()));

create policy help_articles_write on help_articles
  for insert with check (current_company_is_platform_operator());

create policy help_articles_update on help_articles
  for update using (current_company_is_platform_operator()) with check (current_company_is_platform_operator());

create policy help_articles_delete on help_articles
  for delete using (current_company_is_platform_operator());

-- ============================================================================
-- Seed content — a real starter guide, not placeholder text. Uses $tag$
-- dollar-quoting throughout so English contractions/apostrophes never need
-- manual '' escaping.
-- ============================================================================

insert into help_articles (category, title, display_order, keywords, content_html)
select 'getting_started', 'Logging In', 1, 'login, sign in, company code, employee id, password, forgot password',
$art$<p>Every employee signs in with three things: your <strong>Company Code</strong>, your <strong>Employee ID</strong>, and your <strong>Password</strong> — all set up for you by your admin when your account was created.</p>
<ol>
<li>Go to the login page and enter your Company Code (this is the same for everyone at your organization).</li>
<li>Enter your Employee ID (your personal employee code, e.g. 00002).</li>
<li>Enter your password and click <strong>Login</strong>.</li>
</ol>
<p>Forgot your password? Click <strong>Forgot password?</strong> on the login screen and enter your Company Code and Employee ID. Your admin gets notified instantly and can reset it for you from Employee Management — there is no self-service reset link today, so contact your admin directly if it is urgent.</p>$art$
where not exists (select 1 from help_articles where title = 'Logging In');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'getting_started', 'Understanding Your Dashboard', 2, 'dashboard, home, stats, overview, quick actions',
$art$<p>Your Dashboard is the home screen after login. What you see depends on your role:</p>
<ul>
<li><strong>Employees</strong> see their own learning progress, assigned courses, and upcoming deadlines.</li>
<li><strong>Admins</strong> see company-wide stats: total employees, active learners, courses, completion rate, average score, pending assessments/assignments, plus charts for completion trend, enrollment trend, and training status.</li>
</ul>
<p><strong>Quick Actions</strong> at the bottom of the admin dashboard let you jump straight into common tasks — Create Course, Create Assessment, Assign Course, Issue Certificate, Invite Employee — without digging through menus.</p>
<p>Use the filter bar at the top (Company, Branch, Department, Trainer, Course, Learning Path, date range) to narrow every chart and stat down to exactly the slice you want to see.</p>$art$
where not exists (select 1 from help_articles where title = 'Understanding Your Dashboard');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'courses', 'Creating a Course', 1, 'course, create course, new course, category, publish',
$art$<p>Go to <strong>Admin → Courses</strong> and click <strong>Create Course</strong>.</p>
<ol>
<li>Fill in the course name, description, and pick a category (or leave it uncategorized).</li>
<li>Set the course thumbnail/cover image if you have one.</li>
<li>Save as a draft first if you want to build out the content before publishing, or publish right away.</li>
</ol>
<p>Once created, the course appears in <strong>Course Management</strong>, where you can reorder courses (drag-and-drop or the <strong>Reorder Courses</strong> button, grouped by category), edit details any time, or convert it into a module of another course with <strong>Convert to Module</strong> if it turns out to be a better fit as a lesson inside a bigger course.</p>$art$
where not exists (select 1 from help_articles where title = 'Creating a Course');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'courses', 'Building Course Content (Modules & Lessons)', 2, 'course builder, module, lesson, video, document, quiz lesson, drag and drop, reorder',
$art$<p>Open <strong>Admin → Course Builder</strong> and select a course to start adding content.</p>
<ol>
<li>Click <strong>Add Module</strong> to create a section (e.g. "Week 1 — Introduction").</li>
<li>Inside a module, click <strong>Add Lesson</strong> to add a video, document, or quiz lesson.</li>
<li>Drag lessons by the grip handle to reorder them within or across modules — the whole tree (modules and lessons) supports drag-and-drop, so you can drop a lesson exactly where you want it, including into a different module.</li>
</ol>
<p>If a module has grown into something big enough to stand on its own, use <strong>Convert to Course</strong> on that module — its lessons come along with it as a brand-new, independent course.</p>$art$
where not exists (select 1 from help_articles where title = 'Building Course Content (Modules & Lessons)');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'courses', 'Assigning Courses to Employees', 3, 'enroll, enrollment, assign course, quick action',
$art$<p>There are two quick ways to get an employee into a course:</p>
<ol>
<li>From the Dashboard, use the <strong>Assign Course</strong> quick action.</li>
<li>Or go to <strong>Admin → Enrollments</strong> to enroll one or many employees at once, and track everyone's status (not started / in progress / completed) in one place.</li>
</ol>
<p>Employees see everything assigned to them under <strong>My Courses</strong> and <strong>Continue Learning</strong> in their own sidebar.</p>$art$
where not exists (select 1 from help_articles where title = 'Assigning Courses to Employees');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'assessments', 'Creating an Assessment / Quiz', 1, 'assessment, quiz, question bank, create assessment, questions',
$art$<p>Go to <strong>Admin → Assessment → Create</strong> to set up a new assessment: name it, set a passing score, time limit, and number of attempts allowed.</p>
<p>Add questions either directly on the assessment or by pulling from the shared <strong>Question Bank</strong> (Admin → Question Bank), which lets you reuse the same well-written questions across multiple assessments instead of retyping them each time.</p>
<p>Assessments can stand alone or be attached to a course/lesson so employees hit them naturally as part of their learning path.</p>$art$
where not exists (select 1 from help_articles where title = 'Creating an Assessment / Quiz');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'assessments', 'Assigning Assessments & Reviewing Results', 2, 'assignment, results, scores, pass fail, evaluation rule',
$art$<p><strong>Admin → Assignments</strong> is where you assign an assessment to specific employees, a department, or the whole company, with an optional due date.</p>
<p>Once employees submit, check <strong>Admin → Results</strong> for every attempt: score, pass/fail, and time taken. <strong>Evaluation Rules</strong> control how scores map to pass/fail and grades (e.g. what percentage counts as an A+).</p>$art$
where not exists (select 1 from help_articles where title = 'Assigning Assessments & Reviewing Results');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'certificates', 'Certificate Templates & Issuing Certificates', 1, 'certificate, template, issue certificate, bulk issue, verify certificate',
$art$<p>Design how certificates look under <strong>Admin → Certificate Templates</strong> — logo, signature, wording, and layout.</p>
<p>To issue one certificate, use the <strong>Issue Certificate</strong> quick action from the Dashboard. To issue many at once (e.g. everyone who just passed a course), use <strong>Admin → Bulk Certificate Issue</strong>.</p>
<p>Every issued certificate gets a unique certificate number and can be checked for authenticity anytime under <strong>Admin → Certificate Verification</strong> — useful if an employer or client wants to confirm a certificate is genuine.</p>$art$
where not exists (select 1 from help_articles where title = 'Certificate Templates & Issuing Certificates');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'learning_paths', 'Creating a Learning Path', 1, 'learning path, career path, path courses, path progress',
$art$<p>A Learning Path bundles several courses into one guided journey (e.g. "Real Estate Sales Career Path"). Create one under <strong>Admin → Learning Paths</strong>, then add courses to it in order under <strong>Learning Path Courses</strong>.</p>
<p>Enroll employees under <strong>Learning Path Enrollments</strong>, and track how far along each person is under <strong>Learning Path Progress</strong> — it rolls up completion across every course in the path.</p>$art$
where not exists (select 1 from help_articles where title = 'Creating a Learning Path');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'employees', 'Adding Employees & Assigning Roles', 1, 'employee, add employee, role, permission, permission matrix, invite employee',
$art$<p>Add a new employee under <strong>Admin → Employees</strong> (or the <strong>Invite Employee</strong> quick action) — fill in their name, contact details, branch, department, designation, and set an initial password.</p>
<p>Every employee needs a <strong>Role</strong> (e.g. Super Admin, Admin, HR, Trainer, Employee) to determine what they can see and do. Assign or change a role under <strong>Employee Roles</strong>.</p>
<p>Roles themselves are built from individual permissions under <strong>Admin → Roles</strong> and fine-tuned in the <strong>Permission Matrix</strong> — a grid where you tick exactly which actions (view/create/edit/delete) each role can perform, module by module.</p>$art$
where not exists (select 1 from help_articles where title = 'Adding Employees & Assigning Roles');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'settings', 'Configuring Settings & Theme', 1, 'settings, login attempts, upload size, theme, colors, branding',
$art$<p><strong>Admin → Settings</strong> controls real, functional platform behavior:</p>
<ul>
<li><strong>Max Login Attempts</strong> — how many failed password tries before a lockout.</li>
<li><strong>Max Image Upload (MB)</strong> and <strong>Max Document Upload (MB)</strong> — size limits when adding images/documents to lessons.</li>
</ul>
<p><strong>Admin → Theme</strong> reskins the app's colors — primary, secondary, and sidebar colors apply live to the login page and sidebar across the whole company the moment you save.</p>
<p>For your company's name, logo, and address, use <strong>Admin → Company</strong> instead — that is where branding (not behavior) lives.</p>$art$
where not exists (select 1 from help_articles where title = 'Configuring Settings & Theme');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'reports', 'Understanding Reports', 1, 'reports, export, completion rate, average score',
$art$<p><strong>Admin → Reports</strong> gives you deeper views than the Dashboard: completion by department, top/lowest-performing courses, assessment performance, and attendance — filterable by branch, department, course, and date range, same filters as the Dashboard.</p>
<p>Use these to spot who needs a nudge (low completion, low scores) and which courses are actually landing with your team.</p>$art$
where not exists (select 1 from help_articles where title = 'Understanding Reports');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'support', 'Notifications', 1, 'notification, bell, alerts, unread',
$art$<p>The bell icon in the top header shows real-time updates: new enrollments, submitted assessments, issued certificates, password reset requests, and new support tickets — anything relevant to your role.</p>
<p>Click the bell to see your unread count and the most recent items; click a notification to jump straight to what it is about.</p>$art$
where not exists (select 1 from help_articles where title = 'Notifications');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'support', 'Raising & Managing Support Tickets', 2, 'ticket, complaint, support, billing, subscription, platform support',
$art$<p>There are two kinds of tickets:</p>
<ul>
<li><strong>Employee tickets</strong> — any employee can go to <strong>Support Tickets</strong> in the sidebar to report a problem (a broken video, a confusing lesson, anything) directly to their own company's admin team. Admins handle these under <strong>Admin → Ticket Management</strong>.</li>
<li><strong>Platform Support</strong> — for billing, subscription, or platform-level issues, your company's admin can switch to the <strong>Platform Support</strong> tab inside Ticket Management and raise a ticket straight to the SK Enterprise team running this platform.</li>
</ul>
<p>Either way, raising a ticket sends a real-time in-app notification and an email to the right people, and the full back-and-forth conversation stays attached to that one ticket.</p>$art$
where not exists (select 1 from help_articles where title = 'Raising & Managing Support Tickets');
