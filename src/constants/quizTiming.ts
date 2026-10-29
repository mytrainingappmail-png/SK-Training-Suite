// "Move ahead" live quiz: the host screen ends the quiz by itself once every player has pressed Finish.
// A player who has been gone this long (closed the page, lost signal) no longer holds the quiz back - the others' results should not wait for them.
export const QUIZ_ALL_DONE_AWAY_SECONDS = 120;
// A short pause after the last Finish so the host sees the "everyone finished" note before the results screen takes over.
export const QUIZ_ALL_DONE_PAUSE_SECONDS = 3;
