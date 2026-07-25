-- Two new fun categories: "Corporate Puns" (workplace job-title
-- wordplay, in the spirit of "branch manager") and "Dad Jokes & One-
-- Liners" (classic silly riddles). 15 questions each, same MCQ shape as
-- the existing brainstorming content.

-- ── Corporate Puns ──────────────────────────────────────────────────────────

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a man who spends all day sitting on a tree branch doing paperwork?', 'Branch Manager', 'Tree Surgeon', 'Wood Worker', 'Park Ranger', 'a', 'A play on "branch" — as in a tree branch and a company branch office.', 'Corporate Puns', 'Easy', 200
where not exists (select 1 from brainstorming_items where question like 'What do you call a man who spends all day sitting on a tree branch%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a salesperson who only sells doors?', 'Doorman', 'Handyman', 'Locksmith', 'Carpenter', 'a', '"Door" + "man" = Doorman — the same trick as door-to-door sales.', 'Corporate Puns', 'Easy', 201
where not exists (select 1 from brainstorming_items where question like 'What do you call a salesperson who only sells doors%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the person whose entire job is fixing office chairs?', 'Chairman', 'Seat Technician', 'Furniture Fixer', 'The Boss', 'a', '"Chair" + "man" = Chairman — technically accurate, technically hilarious.', 'Corporate Puns', 'Easy', 202
where not exists (select 1 from brainstorming_items where question like 'What do you call the person whose entire job is fixing office chairs%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the employee in charge of the office coffee supply?', 'Groundskeeper', 'Barista', 'Java Manager', 'Bean Boss', 'a', 'Coffee "grounds" + "keeper" — the real Groundskeeper title just got a promotion.', 'Corporate Puns', 'Medium', 203
where not exists (select 1 from brainstorming_items where question like 'What do you call the employee in charge of the office coffee supply%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What''s the office nickname for an accountant who''s obsessed with counting every last rupee?', 'Bean Counter', 'Penny Pincher', 'Number Cruncher', 'Ledger Legend', 'a', '"Bean Counter" is real slang for an overly detail-focused accountant.', 'Corporate Puns', 'Easy', 204
where not exists (select 1 from brainstorming_items where question like 'What''s the office nickname for an accountant who''s obsessed%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the employee who never disagrees with the boss, ever?', 'A Yes-Man', 'A Pushover', 'The Assistant', 'A Team Player', 'a', 'Classic office slang for someone who always agrees, no matter what.', 'Corporate Puns', 'Easy', 205
where not exists (select 1 from brainstorming_items where question like 'What do you call the employee who never disagrees with the boss%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the overnight employee who''s also a huge superhero fan?', 'Knight Shift Worker', 'Dark Hours Guy', 'The Batman', 'Vampire Employee', 'a', '"Night" shift becomes "Knight" shift for the superhero-obsessed.', 'Corporate Puns', 'Medium', 206
where not exists (select 1 from brainstorming_items where question like 'What do you call the overnight employee who''s also a huge superhero fan%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the intern whose entire job is running the photocopier?', 'Copy Cat', 'Xerox Expert', 'Print Master', 'The Duplicator', 'a', 'A copy machine + an intern who copies everything = Copy Cat.', 'Corporate Puns', 'Easy', 207
where not exists (select 1 from brainstorming_items where question like 'What do you call the intern whose entire job is running the photocopier%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a baker who gets promoted to the company''s top salesperson?', 'The Breadwinner', 'Top Loaf', 'Dough Boss', 'Rising Star', 'a', 'Literally — bread + winner. Sometimes the pun writes itself.', 'Corporate Puns', 'Easy', 208
where not exists (select 1 from brainstorming_items where question like 'What do you call a baker who gets promoted to the company''s top salesperson%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the manager of a loud, chaotic open-plan office?', 'The Zookeeper', 'Traffic Controller', 'The Referee', 'Noise Manager', 'a', 'Because managing that office really does feel like running a zoo.', 'Corporate Puns', 'Medium', 209
where not exists (select 1 from brainstorming_items where question like 'What do you call the manager of a loud, chaotic open-plan office%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the IT person who controls who gets system access?', 'Gatekeeper', 'Password Person', 'The Firewall', 'Access Officer', 'a', 'They quite literally keep the gate to every login.', 'Corporate Puns', 'Easy', 210
where not exists (select 1 from brainstorming_items where question like 'What do you call the IT person who controls who gets system access%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the HR person who steps in every time two coworkers argue?', 'Peacekeeper', 'The Mediator', 'Conflict Manager', 'HR Hero', 'a', 'HR''s unofficial, very real job title on a bad day.', 'Corporate Puns', 'Medium', 211
where not exists (select 1 from brainstorming_items where question like 'What do you call the HR person who steps in every time two coworkers argue%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the person who tracks everyone''s sales numbers on the leaderboard?', 'Scorekeeper', 'The Analyst', 'Sales Tracker', 'The Ranker', 'a', 'They keep the score — literally, every single month.', 'Corporate Puns', 'Easy', 212
where not exists (select 1 from brainstorming_items where question like 'What do you call the person who tracks everyone''s sales numbers on the leaderboard%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the person responsible for logging everyone''s attendance and work hours?', 'Timekeeper', 'The Clock Guy', 'Attendance Officer', 'HR Assistant', 'a', 'Not a metaphor — that''s their literal, actual title.', 'Corporate Puns', 'Easy', 213
where not exists (select 1 from brainstorming_items where question like 'What do you call the person responsible for logging everyone''s attendance%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call the security guard who constantly checks his watch?', 'Watchman', 'Timekeeper', 'The Guard', 'Clock Watcher', 'a', 'A "watch" (timepiece) + "man" — hiding in plain sight the whole time.', 'Corporate Puns', 'Easy', 214
where not exists (select 1 from brainstorming_items where question like 'What do you call the security guard who constantly checks his watch%');

-- ── Dad Jokes & One-Liners ───────────────────────────────────────────────────

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a fish with no eyes?', 'A Fsh', 'A Blindfish', 'A Guess-fish', 'Nemo', 'a', 'Fish — minus the "i" — becomes "Fsh". No eyes, no "i".', 'Dad Jokes & One-Liners', 'Easy', 220
where not exists (select 1 from brainstorming_items where question like 'What do you call a fish with no eyes%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a bear with no teeth?', 'A Gummy Bear', 'A Toothless Bear', 'A Soft Bear', 'An Old Bear', 'a', 'No teeth means everything is gummy for this bear.', 'Dad Jokes & One-Liners', 'Easy', 221
where not exists (select 1 from brainstorming_items where question like 'What do you call a bear with no teeth%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a cow with no legs?', 'Ground Beef', 'A Flat Cow', 'A Stuck Cow', 'Beef Jerky', 'a', 'If it can''t stand up, it''s already... ground beef.', 'Dad Jokes & One-Liners', 'Easy', 222
where not exists (select 1 from brainstorming_items where question like 'What do you call a cow with no legs%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a can opener that doesn''t work?', 'A Can''t Opener', 'A Broken Tool', 'A Can Closer', 'Useless Metal', 'a', '"Can" + "opener" that doesn''t open = a "Can''t" opener.', 'Dad Jokes & One-Liners', 'Easy', 223
where not exists (select 1 from brainstorming_items where question like 'What do you call a can opener that doesn''t work%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a pig that knows karate?', 'A Pork Chop', 'A Ham-fist', 'Bacon Black-belt', 'Kung Fu Piggy', 'a', 'One karate chop from a pig, and it''s a pork "chop".', 'Dad Jokes & One-Liners', 'Easy', 224
where not exists (select 1 from brainstorming_items where question like 'What do you call a pig that knows karate%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a snowman with a six-pack?', 'An Abdominal Snowman', 'A Fit Frosty', 'A Cool Dude', 'An Ice Athlete', 'a', '"Abominable" Snowman becomes "Abdominal" once he starts working out.', 'Dad Jokes & One-Liners', 'Medium', 225
where not exists (select 1 from brainstorming_items where question like 'What do you call a snowman with a six-pack%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a dinosaur that crashes his car?', 'Tyrannosaurus Wrecks', 'A Fossil Fender-bender', 'Dino-destruction', 'Jurassic Crash', 'a', 'Tyrannosaurus Rex, meet Tyrannosaurus "Wrecks".', 'Dad Jokes & One-Liners', 'Medium', 226
where not exists (select 1 from brainstorming_items where question like 'What do you call a dinosaur that crashes his car%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a sleeping dinosaur?', 'A Dino-snore', 'A Nap-o-saurus', 'Sleepy Rex', 'A Fossil Nap', 'a', 'Dinosaur + snore, put together while it naps.', 'Dad Jokes & One-Liners', 'Easy', 227
where not exists (select 1 from brainstorming_items where question like 'What do you call a sleeping dinosaur%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a fake noodle?', 'An Impasta', 'A Fauxdle', 'Faux-getti', 'A Copy-carb', 'a', '"Impostor" + "pasta" = Impasta.', 'Dad Jokes & One-Liners', 'Easy', 228
where not exists (select 1 from brainstorming_items where question like 'What do you call a fake noodle%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call cheese that isn''t yours?', 'Nacho Cheese', 'Not-cho Cheese', 'Borrowed Brie', 'Stolen Cheddar', 'a', '"Not your" cheese sounds exactly like "Nacho" cheese.', 'Dad Jokes & One-Liners', 'Easy', 229
where not exists (select 1 from brainstorming_items where question like 'What do you call cheese that isn''t yours%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a group of disorganized cats?', 'A Cat-astrophe', 'A Meow-ss', 'Feline Chaos', 'A Purr-oblem', 'a', 'A group of cats causing chaos is, quite literally, a "cat-astrophe".', 'Dad Jokes & One-Liners', 'Easy', 230
where not exists (select 1 from brainstorming_items where question like 'What do you call a group of disorganized cats%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call an alligator wearing a vest?', 'An Investigator', 'A Detective Gator', 'A Sneaky Reptile', 'A Suited Croc', 'a', '"In-vest" (wearing a vest) + "-igator" = Investigator.', 'Dad Jokes & One-Liners', 'Medium', 231
where not exists (select 1 from brainstorming_items where question like 'What do you call an alligator wearing a vest%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a boomerang that doesn''t come back?', 'A Stick', 'A Broken Boomerang', 'A One-Way Toy', 'A Dud', 'a', 'If it never comes back... it''s really just a stick.', 'Dad Jokes & One-Liners', 'Easy', 232
where not exists (select 1 from brainstorming_items where question like 'What do you call a boomerang that doesn''t come back%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a bee that can''t make up its mind?', 'A Maybe', 'A Confused Bee', 'An Indecisive Buzz', 'A Waffle-bee', 'a', '"Maybe" sounds just like "May-bee".', 'Dad Jokes & One-Liners', 'Easy', 233
where not exists (select 1 from brainstorming_items where question like 'What do you call a bee that can''t make up its mind%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a belt made entirely of watches?', 'A Waist of Time', 'A Time Strap', 'A Clock Belt', 'A Second Hand', 'a', 'A belt goes around your "waist" — and it''s made of "time".', 'Dad Jokes & One-Liners', 'Medium', 234
where not exists (select 1 from brainstorming_items where question like 'What do you call a belt made entirely of watches%');
