# Packet Party

A playful, mobile-friendly networking quiz built from eight supplied question pools. The frontend is static, with Vercel Functions for live rooms and public leaderboards. Deploy this folder to Vercel with **Framework Preset: Other** and no build command.

## Play

- Browse all 198 distinct questions and reveal the source-marked answers.
- Play the complete deck in source order or shuffle every question and its choices.
- Open **Practice path** for the full deck in a fixed question order. You can keep the original choice order or turn on **Shuffle answer choices**; each question keeps its shuffled choice positions when you revisit it. It saves your answers and current question on this device, so you can resume later, move backward or forward, skip, or jump straight to any question number. Practice path has no timer or leaderboard score.
- On a keyboard, press **1–4** to choose a displayed answer in solo, Practice path, and live matches. In Match maker, press 1–4 for a question, then 1–4 for its answer. Number keys still type normally in answer fields and chat.
- Choose 1, 3, 5, or unlimited hearts. Public leaderboards cover **All questions**, **Shuffle run**, **Level up**, and **Boss blitz**, each with a hearts filter and top-score graph. The home page shows a switchable top-three preview.
- Turn on **Correct answer first** for a single practice run. The switch resets to off for each new run, and those practice scores are never submitted.
- Try Level up, Boss blitz, Match maker, and Type it out for shorter rounds.
- Build streaks, protect hearts, unlock one-use power-ups, request offline hints, and wager points before selected hard questions.
- Export a completed run as a ghost file and share it with a friend to race their progress offline.
- Host a live room for up to eight players. Friends join by code, answer the same timed questions, and see a shared leaderboard, chat, and reactions. Players can change their saved answer while the question is open; the final saved answer counts. A question reveals as soon as everyone answers, or after 25 seconds. Scores and streaks update on the reveal, so answering early does not give away the result.
- Read a short explanation after every answer in solo and live play, or when revealing an answer in the question bank.
- Install the app on mobile through its browser's install or Add to Home Screen action. The solo deck is available offline after the first visit; public scores and live rooms need a connection.

Solo progress, preferences, and ghosts are stored in the browser on each device. Public scores and live rooms use Vercel Functions and Redis. Players choose a nickname when posting a score or joining a room.

## Question bank

`questions.json` contains 198 distinct questions from 764 valid source entries. A duplicate was removed only when the normalized question, available choices, and marked correct answer all matched. Distinct answer variants were retained. The 22 referenced exhibits are in `exhibits/`.

The original saved course pages are not needed to run the site. The site preserves the question wording, choices, and labeled answers from the supplied files. `explanations.json` adds concise study notes and flags a few source-keyed answers that conflict with standard networking behavior.

## Online setup

The live API is in `api/rooms.mjs` and the score API is in `api/leaderboard.mjs`. In Vercel, connect the free Upstash for Redis integration to the project. The functions read `KV_REST_API_URL` and `KV_REST_API_TOKEN` from server-side environment variables. Never expose the token in browser code. Rooms expire after six hours. Each ranked mode shows its top 50 scores across heart settings, with a separate filter for each setting.

Voice chat, shared deck voting, and a model-backed tutor are not included. Hints remain local, and ghost files can be shared without an account.
