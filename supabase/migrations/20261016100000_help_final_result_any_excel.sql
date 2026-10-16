-- Help Center: the Final Result Excel upload no longer needs any layout — update the article.

update help_articles
set content_html = $art$<p>Often a test is taken twice, or a paper is marked outside the app. Final Result can bring all of it together as <strong>one report with feedback</strong>.</p>
<h2>Upload your Excel file — any layout</h2>
<ol>
<li>Open <strong>Final Result</strong> and open the batch folder.</li>
<li>Press <strong>📤 Upload Excel round</strong> and choose your file (.xlsx or .csv) exactly as you already have it — no template, no fixed columns.</li>
<li>The app reads <em>every sheet</em> and finds the tables by itself: names, marks, total, percent, test name, date, remarks, <strong>second / third attempt</strong> columns, and a <strong>Trainee / Feedback</strong> list.</li>
<li>You see what it found: each test becomes a round, each attempt column becomes its own re-attempt round, and the feedback list is shown separately. Untick anything you do not want, change a round's name or date, and set a pass mark if you like.</li>
<li>If a table was missed, open <strong>Something missing? Pick a table yourself</strong>: choose the sheet, the row with the column titles, and which column is which.</li>
<li>Press <strong>Save</strong>.</li>
</ol>
<h2>Combined report</h2>
<ol>
<li>Press <strong>📊 Combined report</strong> in the folder. Every round in the folder — saved live quizzes, exams and uploaded Excel rounds — is lined up per candidate, matched by name.</li>
<li>You see each round's %, the best and average, the change from first to last attempt, and Pass / Not passed.</li>
<li>Write or edit <strong>feedback</strong> for each person; it saves when you click away.</li>
<li>Press <strong>⬇ Download final report (Excel)</strong> — one file: sheet 1 is the final report with feedback, sheet 2 lists every round line by line.</li>
</ol>
<p>Names must match between rounds (capital letters and extra spaces are ignored). A round with the same name as one already in the folder is left unticked so it is not added twice. Removing an uploaded round only removes that round; saved quizzes and exams are never touched.</p>$art$
where title = 'Final Result: Excel Rounds and the Combined Report';
