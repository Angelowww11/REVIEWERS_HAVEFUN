# Packet Party

A playful, mobile-friendly networking quiz built from eight supplied question pools. The site is static: open `index.html` through a local web server or deploy this folder to Vercel with **Framework Preset: Other** and no build command.

## Play

- Browse all 198 distinct questions and reveal the source-marked answers.
- Play the complete deck in source order or shuffle every question and its choices.
- Turn on **Put the correct choice first** in the run setup for easier review.
- Try Level up, Boss blitz, Match maker, and Type it out for shorter rounds.
- Build streaks, protect hearts, unlock one-use power-ups, request offline hints, and wager points before selected hard questions.
- Export a completed run as a ghost file and share it with a friend to race their progress offline.
- Host a live room for up to eight players. Friends join by code, answer the same timed questions, and see a shared leaderboard, chat, and reactions.

Solo progress, preferences, and ghosts are stored in the browser on each device. Live rooms use Vercel Functions and Redis. Players only need a nickname and room code.

## Question bank

`questions.json` contains 198 distinct questions from 764 valid source entries. A duplicate was removed only when the normalized question, available choices, and marked correct answer all matched. Distinct answer variants were retained. The 22 referenced exhibits are in `exhibits/`.

The original saved course pages are not needed to run the site. The site preserves the question wording, choices, and labeled answers from the supplied files.

## Live room setup

The live API is in `api/rooms.mjs`. In Vercel, connect the free Upstash for Redis integration to the project. The function reads `KV_REST_API_URL` and `KV_REST_API_TOKEN` from server-side environment variables. Never expose the token in browser code. Rooms expire after six hours.

Voice chat, shared deck voting, and a model-backed tutor are not included. Hints remain local, and ghost files can be shared without an account.
