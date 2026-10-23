# Arcade design direction

Skills applied: local frontend-design, find-skills discovery, and Vercel Web Interface Guidelines (read from upstream without installing dependencies).

References:
- https://skills.sh/vercel-labs/agent-skills/web-design-guidelines
- https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md

Direction: networking arcade with an illustrated packet playground as the signature. Preserve the existing navy / apricot / mint / pink / lavender palette through theme tokens. Existing rounded display type carries headings, Segoe UI handles reading, tabular numerals handle timers and scores.

Home: illustrated play panel → mode grid with compact scoreboard at the side on desktop → scoreboard below modes on mobile. Keep meaningful mode artwork and answer animations.

Shared system: rounded panel geometry, purposeful top-edge accents, consistent form/control sizing, reading-focused question panels and structured explanations. Touch controls retain keyboard alternatives and reduced-motion preferences.

Mobile: a horizontal fruit garden dock replaces the tall card covering questions. Additional bottom scroll space lets controls clear the dock and navigation.

Scope: presentation changes in index.html and arcade.css, plus PWA precache version. No question keys, IDs, gameplay scoring, account logic, or saved progress changed.

Visual review performed on desktop home/mode layouts and mobile home/question bank. This is not an end-to-end gameplay test or a full accessibility certification.
