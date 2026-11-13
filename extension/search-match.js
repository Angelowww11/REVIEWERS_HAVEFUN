/* Match complete question wording before considering a literal phrase search. */
globalThis.PocketMatch = (() => {
  const normalize = text => String(text || '').normalize('NFKC').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
  function find(bank, raw, deck) {
    const scoped = bank.filter(q => deck === 'all' || q.deck === deck);
    const cleaned = String(raw).replace(/^\s*Question\s+\d+\s*(?:[.:)\-]\s*)?/i, '').trim();
    const stem = cleaned.split(/group\s+of\s+answer\s+choices/i)[0].trim();
    const query = normalize(stem), full = normalize(cleaned);
    if (!query) return {kind:'empty', questions:[]};
    let exact = scoped.filter(q => normalize(q.question) === query);
    // Pasting the whole question plus its options should still find that question.
    if (!exact.length) {
      const prefixed = scoped.filter(q => {
        const wording = normalize(q.question);
        return wording.length > 20 && full.startsWith(wording + ' ');
      });
      const longest = Math.max(0, ...prefixed.map(q => normalize(q.question).length));
      exact = prefixed.filter(q => normalize(q.question).length === longest);
    }
    if (exact.length) {
      // Same wording can have different choices. Use pasted choices to select the variant.
      const scored = exact.map(q => ({q, score:q.options.filter(o => {
        const choice = normalize(o);
        return choice && (' '+full+' ').includes(' '+choice+' ') && !(' '+query+' ').includes(' '+choice+' ');
      }).length}));
      const best = Math.max(...scored.map(r=>r.score));
      return {kind:'exact', questions:scored.filter(r=>r.score===best).map(r=>r.q)};
    }
    return {kind:'phrase', questions:scoped.filter(q => (' '+normalize(q.question)+' ').includes(' '+query+' '))};
  }
  return {find, normalize};
})();
