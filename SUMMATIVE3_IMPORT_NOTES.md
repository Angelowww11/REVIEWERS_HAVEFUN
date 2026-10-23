# Summative 3 import

The separate Summative 3 deck imports all nine supplied MHTML reviews. It contains **209 unique questions** after removing 947 repeated question/choice/answer sets. 25 repeated-stem groups retain different choices or answer keys. Choice order does not create a new question; different exhibits do.

Correct answers come from Canvas's `correct_answer` labels, including when the student's selected answer was wrong. The importer reads question content only and does not execute saved document scripts.

Two partial final questions were recovered from complete copies in other files. One empty/template region in Q4 was ignored. There are no unresolved answer keys or missing exhibits. The 15 exhibit questions use 12 locally saved image files.

One source-key conflict is retained and flagged: the slow WLAN / dual-band router question is keyed as firmware update in one source version and splitting traffic between 2.4 and 5 GHz in another. The import preserves both labeled keys and does not claim to resolve that disagreement.

The deck has its own practice saves, ranked progress, leaderboards, and live rooms. Training offers 20, 30, or the entire deck. Run `python build_summative3.py` with the original files in `../QUESTION POOLS` to regenerate it; downloaded exhibits are cached by a hash of their source path, with no signed source URLs published.

## PDF follow-up

All 26 pages of `SUMMATIVE 3.pdf` were compared with the bank: 224 question occurrences on pages 1–23 and 36 repeated study-summary occurrences on pages 24–26. One missing statement was added as stable ID 210, bringing the playable deck to **210 questions**. Its answer is **False per the user's explicit instruction**, while page 13, question 146 highlights **True**; the explanation records that disagreement. The PDF also repeats both conflicting WLAN keys for IDs 110 and 168. Other questions, choice variants and visible highlighted keys were already represented; a truncated `acces` on page 18 maps to the existing supplicant question 42. Four occurrences without detectable yellow highlights keep their MHTML labels. This is a source comparison, not a claim that every source answer is technically correct. See `summative3-pdf-audit.json` for the comparison and `summative3-supplement.json` for the reproducible addition.
