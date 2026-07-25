-- Four of the original 15 planned "Dad Jokes" turned out to already
-- exist under "Wordplay & Puns" (correctly skipped as duplicates).
-- Topping the category back up to 15 with fresh ones.

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call an owl that can do magic tricks?', 'Hoodini', 'Wizard Owl', 'Magic Feather', 'Owl-usionist', 'a', '"Houdini" the escape artist, reimagined for a bird — "Hoodini".', 'Dad Jokes & One-Liners', 'Medium', 235
where not exists (select 1 from brainstorming_items where question like 'What do you call an owl that can do magic tricks%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a factory that makes just okay products?', 'A Satisfactory', 'An Okay-tory', 'A Mediocre Mill', 'Average Industries', 'a', '"Satisfactory" quality, made in a "factory" — Satis-factory.', 'Dad Jokes & One-Liners', 'Medium', 236
where not exists (select 1 from brainstorming_items where question like 'What do you call a factory that makes just okay products%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a deer with no eyes?', 'No Eye Deer', 'A Blind Buck', 'A Guess-deer', 'Lost Stag', 'a', 'Say it out loud — "No Eye Deer" sounds exactly like "No idea".', 'Dad Jokes & One-Liners', 'Easy', 237
where not exists (select 1 from brainstorming_items where question like 'What do you call a deer with no eyes%');

insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call two octopuses that look exactly the same?', 'Itenticle', 'Twin Tentacles', 'Copy-pus', 'A Matching Set', 'a', '"Identical" + "tentacle" mashed together — Itenticle.', 'Dad Jokes & One-Liners', 'Medium', 238
where not exists (select 1 from brainstorming_items where question like 'What do you call two octopuses that look exactly the same%');
