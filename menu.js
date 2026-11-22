/* Decorative illustrations only: quiz controls and saved progress stay in app.js. */
(() => {
  const art = {
    all: '<g class="menu-art-stack"><rect x="34" y="20" width="68" height="82" rx="12" transform="rotate(-17 68 61)" fill="var(--surface)"/><rect x="49" y="17" width="68" height="82" rx="12" transform="rotate(8 83 58)" fill="currentColor"/><rect x="56" y="23" width="54" height="66" rx="8" fill="var(--page)"/><path d="M68 42h29M68 53h22M68 64h17"/><circle cx="111" cy="88" r="18" fill="var(--accent)"/><path d="m103 88 6 6 11-13" stroke="var(--accent-ink)"/></g>',
    shuffle: '<g class="menu-art-shuffle"><path d="M26 35h18c29 0 29 50 58 50h20M26 85h18c29 0 29-50 58-50h20" stroke-width="10"/><path d="m110 23 13 12-13 12m0 26 13 12-13 12"/><circle cx="28" cy="35" r="6" fill="var(--accent)"/><circle cx="28" cy="85" r="6" fill="var(--secondary)"/></g>',
    adaptive: '<g class="menu-art-level"><path d="M24 99V80h29V60h29V40h29V20h21" stroke-width="8"/><circle cx="53" cy="47" r="13" fill="var(--accent)"/><path d="m46 47 5 5 9-10" stroke="var(--accent-ink)"/><path d="m111 20 10-10 11 10"/><path d="M109 67v16m-8-8h16" opacity=".6"/></g>',
    blitz: '<g class="menu-art-clock"><circle cx="78" cy="65" r="37" fill="var(--surface)"/><path d="M78 28a37 37 0 0 1 34 52" stroke-width="9"/><path d="M78 43v24l17 8M69 14h18M78 14v11m29 7 8-8"/><path d="m34 44-15 21h17l-11 23" stroke="var(--accent)" stroke-width="6"/><circle cx="78" cy="65" r="4" fill="currentColor"/></g>',
    matching: '<g class="menu-art-match"><path d="M48 41h60M48 84h60" stroke-dasharray="4 7"/><rect x="22" y="22" width="39" height="39" rx="12" fill="var(--surface)"/><rect x="94" y="65" width="39" height="39" rx="12" fill="var(--surface)"/><circle cx="113" cy="41" r="20" fill="currentColor"/><circle cx="42" cy="84" r="20" fill="var(--accent)"/><path d="m33 34 8-6 8 6v12H33zm72 46 8-6 8 6v12h-16" stroke="var(--accent-ink)"/></g>',
    typing: '<g class="menu-art-keys"><rect x="20" y="33" width="43" height="48" rx="12" fill="var(--surface)"/><rect x="70" y="33" width="43" height="48" rx="12" fill="var(--surface)"/><rect x="99" y="66" width="43" height="38" rx="11" fill="currentColor"/><path d="m32 64 10-20 10 20m-16-7h13M84 45h11m-11 10h9m-9 10h11"/><path d="M128 77v13h-17m5-6-6 6 6 6" stroke="var(--accent-ink)"/></g>',
    training: '<g class="menu-art-loop"><path d="M36 48a40 40 0 0 1 74-9m8 34a40 40 0 0 1-74 9" stroke-width="7"/><path d="m110 21 3 23-23-3M44 100l-3-23 23 3"/><circle cx="77" cy="61" r="23" fill="var(--surface)"/><path d="m66 61 8 8 15-18" stroke="var(--accent)" stroke-width="6"/></g>',
    practice: '<g class="menu-art-path"><path d="M18 88h36c29 0 0-56 31-56h46" stroke-dasharray="5 8"/><circle cx="23" cy="88" r="13" fill="var(--surface)"/><circle cx="76" cy="59" r="13" fill="var(--accent)"/><path d="M124 17v32m0-32 24 8-24 8"/><path d="m17 88 4 4 7-9"/></g>'
  };
  document.querySelectorAll('.mode-card[data-mode]').forEach(card => {
    const mode = card.dataset.mode;
    const visual = card.querySelector('.mode-visual');
    if (visual && art[mode]) {
      visual.className = 'mode-visual menu-art';
      visual.innerHTML = `<svg viewBox="0 0 160 120" fill="none" stroke="currentColor" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round" focusable="false">${art[mode]}</svg>`;
    }
  });
})();
