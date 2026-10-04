# Packet Party

A playful, mobile-friendly networking quiz built from eight supplied question pools. The frontend is static, with Vercel Functions for live rooms and public leaderboards. Deploy this folder to Vercel with **Framework Preset: Other** and no build command.

The **CCST midterm** tab adds a separate 90-card certification review deck from `CCST Networking Reviewer 1.pdf`. It uses the same solo, practice, training, leaderboard, and live multiplayer modes. Progress and public scores are kept separate from the original question pools. See [CCST_REVIEW_NOTES.md](CCST_REVIEW_NOTES.md) for corrected source answers and omitted slides.

## Play

- Browse all 198 distinct questions and reveal the source-marked answers. **Show all 198 questions** in the question bank clears search and filters, then displays the entire deck at once; **Show fewer** returns to the shorter list.
- Play the complete deck in source order or shuffle every question and its choices.
- Open **Practice path** for the full deck in a fixed question order. You can keep the original choice order or turn on **Shuffle answer choices**; each question keeps its shuffled choice positions when you revisit it. It saves your answers and current question on this device, so you can resume later, move backward or forward, skip, or jump straight to any question number. **Reset all progress** clears saved answers, position, and shuffled choice positions after confirmation. Practice path has no timer or leaderboard score.
- Choose **Training loop** for 20 or 30 random questions with unlimited hearts. After each pass, review every miss alongside your answer, the correct answer, and an explanation. Retry only the missed questions, with fresh choice order, until you complete a perfect pass. Training is unranked.
- On a keyboard, press **1–4** to choose a displayed answer in solo, Practice path, and live matches. In Match maker, press 1–4 for a question, then 1–4 for its answer. Number keys still type normally in answer fields and chat.
- Choose 1, 3, 5, or unlimited hearts. Public leaderboards cover **All questions**, **Shuffle run**, **Level up**, and **Boss blitz**, each with a hearts filter and top-score graph. The home page shows a switchable top-three preview.
- Unfinished ranked runs save automatically on this device, one per ranked mode. Use **Continue a run** on the home page or **Continue** in that mode’s setup to pick up the same question, choice order, score, hearts, and power-ups. Boss blitz pauses its timer when you leave, close, or hide the page. Starting a new run in the same mode replaces its saved run; finishing clears it.
- Beginning with this update, completed ranked runs add their final points to a lifetime total on this device. Titles unlock at 0 **Noob**, 1,000 **Beginner**, 5,000 **Intermediate**, 15,000 **Pro**, 40,000 **Packet Hacker**, and 100,000 **Packet Gods** points. The home page shows your title and progress; leaderboard entries show the title earned when that score was posted. Older entries use their run score as a fallback title because lifetime totals were not stored yet.
- In solo question modes, use **Previous answer** or the Backspace key to review answered questions. Browse older and newer answers in the review dialog; this is review only, so scores, answers, and leaderboard eligibility stay intact. Boss blitz pauses while the review dialog is open.
- Turn on **Correct answer first** for a single practice run. The switch resets to off for each new run, and those practice scores are never submitted.
- Try Level up, Boss blitz, Match maker, and Type it out for shorter rounds.
- Build streaks, choose a heart limit, use 50/50 and Shield on each question, request study hints, and wager points before selected hard questions. Power-ups cost earned points: 50/50 costs 70, Shield costs 45, and Freeze costs 60. They can each be used once per question when affordable. Boss blitz offers Freeze, which pauses the clock for four seconds. Shield saves a streak after a wrong answer. The 50/50 power-up crosses out two wrong choices on desktop and mobile.
- Export a completed run as a ghost file and share it with a friend to race their progress offline.
- Host a 10, 20, 30, or 50 question live room for up to 20 players. Friends join by code, answer the same timed questions, and see a shared leaderboard, chat, and reactions. Players can change their saved answer while the question is open; the final saved answer counts. Live rooms also have point-priced 50/50 and Shield, plus one shared four-second Freeze per question. The server checks each purchase against the player's earned points. Study hints are available in live play. A question reveals as soon as everyone answers, or after 25 seconds. Scores, power-up costs, and streaks update publicly on the reveal, so answering early does not give away the result.
- Read a short explanation after every answer in solo and live play, or when revealing an answer in the question bank.
- Install the app on mobile through its browser's install or Add to Home Screen action. The solo deck is available offline after the first visit; public scores and live rooms need a connection.

Solo progress, preferences, and ghosts are stored in the browser on each device. Public scores and live rooms use Vercel Functions and Redis. Players choose a nickname when posting a score or joining a room.

## Question bank

`questions.json` contains 198 distinct questions from 764 valid source entries. A duplicate was removed only when the normalized question, available choices, and marked correct answer all matched. Distinct answer variants were retained. The 22 referenced exhibits are in `exhibits/`.

The original saved course pages are not needed to run the site. The site preserves the question wording, choices, and labeled answers from the supplied files. `explanations.json` adds concise study notes and flags a few source-keyed answers that conflict with standard networking behavior.

## Online setup

The live API is in `api/rooms.mjs` and the score API is in `api/leaderboard.mjs`. In Vercel, connect the free Upstash for Redis integration to the project. The functions read `KV_REST_API_URL` and `KV_REST_API_TOKEN` from server-side environment variables. Never expose the token in browser code. Rooms expire after six hours. Each ranked mode shows its top 50 scores across heart settings, with a separate filter for each setting.

Voice chat, shared deck voting, and a model-backed tutor are not included. Hints remain local, and ghost files can be shared without an account.

## Study space update

- Appearance menu: dark, light, pink, green, blue and purple palettes. Shared semantic answer colors, opaque reading surfaces, larger question line spacing and a calm-motion preference.
- Background particles are capped at 12 on small screens / 26 on larger screens, rendered at 20 fps with a 1.5 DPR cap, and suspended in hidden tabs, reduced-motion mode or data-saver mode.
- Answer feedback labels the correct answer and its explanation, then prompts the learner to explain the concept from memory. 50/50 elimination uses a neutral cross-out without text blur.
- Optional username/password accounts at `/api/account`: scrypt password hashing, secure HttpOnly same-site sessions, recovery keys, rate limits, bounded saves and optimistic revision checks. Cloud saves contain only whitelisted study progress/preferences for both decks; room tokens are excluded. Save/restore are explicit; auto-save is optional per session. Recovery keys must be retained by the player. Public leaderboard names remain independent of account identities.
- Casual co-op rooms: untimed questions, group chat, free once-per-question 50/50, shared solved-question count, no individual ranking or attacks, and host-controlled advance after feedback. The shared count records questions answered correctly by at least one participant, not mastery by every participant.
- Competitive items: Splatter costs 40 points (4 seconds; free wipe); Zap costs 60 and removes at most 20 banked points; Ward costs 35 and blocks an attack. A player can send one attack and receive one attack per question. Attacks cannot target players who have already answered. Hosts can disable playful items. Item spending/damage settles with the round. Every three consecutive correct answers grants a shield for the next round; every five adds 25 points. These are conservative initial balance values, not empirically validated optimums.

### Design and learning references

- Retrieval Practice, feedback guidance: https://www.retrievalpractice.org/feedback — feedback and recall drive the study flow; no claim is made that a particular palette improves memory.
- Duolingo design reference: https://blog.duolingo.com/core-tabs-redesign/ — consistent navigation and playful, legible visual hierarchy.
- W3C reduced motion: https://www.w3.org/WAI/WCAG22/Techniques/css/C39 — optional decoration respects system motion preferences.
- Riot balance philosophy: https://2xko.riotgames.com/en-us/news/dev/2xko-live-balance-philosophy/ — clear counterplay and limited payoff inform the initial item rules; future player feedback should guide adjustments.
