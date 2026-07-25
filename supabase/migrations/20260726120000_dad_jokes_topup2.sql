insert into brainstorming_items (question, option_a, option_b, option_c, option_d, correct_option, answer, category, difficulty, display_order)
select 'What do you call a bunch of rabbits hopping backwards in a line?', 'A Receding Hare-line', 'A Bunny Retreat', 'A Hop-back Parade', 'Reverse Rabbit Row', 'a', '"Hare" (rabbit) + "line" sounds just like a "receding hairline".', 'Dad Jokes & One-Liners', 'Medium', 239
where not exists (select 1 from brainstorming_items where question like 'What do you call a bunch of rabbits hopping backwards%');
