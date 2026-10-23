# Packet Party refinement notes

## Preserved product requirements

- Three separate decks: original pools (198), certification (99), Summative 3 (212).
- Original question wording, choice variants, exhibits, and source-key warnings; stable IDs.
- Solo ranked all/shuffle/adaptive/blitz, matching, typing, fixed-order practice, mastery training, saved progress, answer history.
- First-answer learning option, randomized play, adjustable hearts, ranked leaderboards and lifetime titles.
- Competitive/cooperative live rooms, adjustable player/question counts, editable answers before reveal, reveal-only scoring and battle items.
- Optional accounts, six themes, installable PWA and touch-friendly matching.

This list describes existing code paths retained by the refinement; it is not an end-to-end test report.

## Changes

- `polish.css` restores theme-aware decorative layers, gentle card motion, answer feedback, softer surfaces and a refined timer panel. Calm mode and OS reduced-motion preferences remain honored.
- Focus breaks preserve the focus countdown; returning from another page resumes an active timer. Manual pause stays paused. No focus rewards accrue during breaks or away time.
- Reset restarts the countdown without deleting earned fruit or partial progress to the next reward. Reward progress is accumulated active focus time.
- Summative 3 focus storage is separate from the original pools. Existing CCST/original focus keys remain unchanged.
- Floating garden has explicit pause and minimize controls; canvas works with keyboard activation and touch.
- All 212 Summative 3 explanations are now concept-specific (211 authored teaching notes plus the explicit disputed QoS explanation). Original/CCST explanations remain intact. Source keys are not silently rewritten.

## Teaching references

- Cisco HSRP FAQ: https://www.cisco.com/c/en/us/support/docs/ip/hot-standby-router-protocol-hsrp/9281-3.html
- Cisco port-based traffic control: https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst3850/software/release/3e/consolidated_guide/configuration_guide/b_consolidated_3850_3e_cg/b_consolidated_3850_3e_cg_chapter_01000110.pdf
- IEEE WLAN working group: https://www.ieee802.org/11/abt80211.html
- Cisco RF reference: https://www.cisco.com/c/en/us/td/docs/wireless/controller/9800/technical-reference/wireless-rf-reference-guide.html

Several source keys are questionable (for example monitoring → RADIUS); notes explain the networking concept and flag the source problem without silently altering the source-based grading. This release does not establish completeness of the entire source PDF; the previous completeness claim remains withdrawn.
