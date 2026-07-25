-- Enable the Live Quiz premium add-on for the Realty Smartz Pvt Ltd test
-- company so Phase 1 can be verified live end-to-end, same convention as
-- enabling market_analytics_enabled for testing earlier this session.
update companies set live_quiz_enabled = true where id = '3b74953b-d4b1-46d5-99c4-0f8efa959277';
