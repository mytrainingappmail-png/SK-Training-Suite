-- Help Center: live results + Stop/Start for Live Quiz and Exams, and the Final Result Excel round + combined report.

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Live Results and Stop / Start a Candidate', 6, 'live, results, answered, right, wrong, stop, start, pause, resume, indiscipline, host, exam, monitor',
$art$<p>While a Live Quiz or an Exam is running, the host screen shows how every candidate is doing — without waiting for the end.</p>
<h2>What you see</h2>
<ul>
<li><strong>Answered / total</strong> for each candidate, plus how many are <strong>right</strong> and how many <strong>wrong</strong> so far.</li>
<li>In an Exam: marks so far, who is still writing, who has submitted, and the questions most candidates are missing.</li>
<li><strong>Hide marks (projector)</strong> in an Exam keeps the numbers off a screen the whole room can see.</li>
</ul>
<h2>Stop and Start one candidate</h2>
<ol>
<li>Press <strong>⏹ Stop</strong> next to the candidate. You may write a reason; they will see it.</li>
<li>Their screen shows <em>"You are paused"</em> and the system refuses their answers — the quiz or exam keeps going for everyone else.</li>
<li>Press <strong>▶ Start</strong> (Resume) to let them continue.</li>
</ol>
<p>Only people who can edit quizzes see the Stop / Start buttons.</p>$art$
where not exists (select 1 from help_articles where title = 'Live Results and Stop / Start a Candidate');

insert into help_articles (category, title, display_order, keywords, content_html)
select 'live_quiz', 'Final Result: Excel Rounds and the Combined Report', 7, 'final result, excel, xlsx, upload, round, combined, report, feedback, download, folder, batch, two tests',
$art$<p>Often a test is taken twice, or a paper is marked outside the app. Final Result can bring all of it together as <strong>one report with feedback</strong>.</p>
<h2>Upload an Excel round</h2>
<ol>
<li>Open <strong>Final Result</strong> and open the batch folder.</li>
<li>Press <strong>📤 Upload Excel round</strong> and choose your .xlsx file (use <em>Download a sample Excel</em> to see a layout).</li>
<li>Check the column choices — we guess which column is the name, marks, total and so on; change any that are wrong.</li>
<li>Give the round a name and date, optionally a pass mark %, then <strong>Save this round</strong>.</li>
</ol>
<h2>Combined report</h2>
<ol>
<li>Press <strong>📊 Combined report</strong> in the folder. Every round in the folder — saved live quizzes, exams and uploaded Excel rounds — is lined up per candidate, matched by name.</li>
<li>You see each round's %, the best and average, the change from first to last attempt, and Pass / Not passed.</li>
<li>Write <strong>feedback</strong> for each person; it saves when you click away.</li>
<li>Press <strong>⬇ Download final report (Excel)</strong> — one file: sheet 1 is the final report with feedback, sheet 2 lists every round line by line.</li>
</ol>
<p>Names must match between rounds (capital letters and extra spaces are ignored). Removing an uploaded round only removes that round; saved quizzes and exams are never touched.</p>$art$
where not exists (select 1 from help_articles where title = 'Final Result: Excel Rounds and the Combined Report');
