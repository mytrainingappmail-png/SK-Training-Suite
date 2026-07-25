-- The user's real/main company is SKE001 (Siddharth & Kunal Enterprise) —
-- Realty Smartz (RSPL001) was only ever a test/demo company. Move the
-- Live Quiz premium add-on flag off the demo company and onto the real one.
update companies set live_quiz_enabled = false where id = '3b74953b-d4b1-46d5-99c4-0f8efa959277'; -- RSPL001
update companies set live_quiz_enabled = true  where id = 'b259bfa8-bf5b-464f-b9a5-008d00efa1e4'; -- SKE001
