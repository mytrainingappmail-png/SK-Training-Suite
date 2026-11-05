// "Move ahead" live quiz: the host screen ends the quiz by itself once every player has pressed Finish.
// A player who has been gone this long (closed the page, lost signal) no longer holds the quiz back - the others' results should not wait for them.
export const QUIZ_ALL_DONE_AWAY_SECONDS = 120;
// A short pause after the last Finish so the host sees the "everyone finished" note before the results screen takes over.
export const QUIZ_ALL_DONE_PAUSE_SECONDS = 3;
// "Move ahead" live quiz: when a player's own question timer runs out they are taken to their next question by themselves
// (no need to press Next). This short pause first lets them read "Time's up! Skipped" / their result.
export const QUIZ_AUTO_NEXT_PAUSE_SECONDS = 2;
