import { readFileSync, writeFileSync } from 'node:fs';

const decks = [
  ['questions', 'explanations', 'Question pools'],
  ['summative3-questions', 'summative3-explanations', 'Summative 3'],
  ['summative4-questions', 'summative4-explanations', 'Summative 4']
];
const normalize = value => String(value ?? '').toLocaleLowerCase().replace(/\s+/g, ' ').trim();
const questions = [];
const explanations = {};
const seen = new Map();
const sourceFiles = new Set();

for (const [file, notesFile, section] of decks) {
  const bank = JSON.parse(readFileSync(new URL(`./${file}.json`, import.meta.url)));
  const notes = JSON.parse(readFileSync(new URL(`./${notesFile}.json`, import.meta.url)));
  for (const question of bank.questions) {
    const key = [normalize(question.question),
      (question.options || []).map(normalize).sort().join('|'),
      (question.correctAnswers || []).map(normalize).sort().join('|')].join('::');
    if (seen.has(key)) { const kept = questions[seen.get(key)]; if (!kept.sections.includes(section)) kept.sections.push(section); continue; }
    seen.set(key, questions.length);
    const id = questions.length + 1;
    const sourceFile = question.sourceFile;
    questions.push({ ...question, id, sourceFile, section, sections: [section], originalId: question.id });
    sourceFiles.add(sourceFile);
    if (notes[question.id]) explanations[id] = notes[question.id];
  }
}

writeFileSync(new URL('./combined-questions.json', import.meta.url), JSON.stringify({
  title: 'All summatives — Packet Party', sourceFiles: [...sourceFiles],
  questionCount: questions.length, questions
}));
writeFileSync(new URL('./combined-explanations.json', import.meta.url), JSON.stringify(explanations));
console.log(`${questions.length} unique questions; ${Object.keys(explanations).length} explanations`);
