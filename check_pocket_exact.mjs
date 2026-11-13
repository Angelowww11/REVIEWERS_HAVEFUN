import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
vm.runInThisContext(fs.readFileSync(new URL('./extension/search-match.js',import.meta.url),'utf8'));
const bank=JSON.parse(fs.readFileSync(new URL('./extension/bank-data.json',import.meta.url))).questions;
const {find,normalize}=globalThis.PocketMatch;
for(const q of bank){
  const r=find(bank,q.question,q.deck);
  assert.equal(r.kind,'exact',`${q.deck} #${q.id}`);
  assert(r.questions.some(x=>x.id===q.id));
  assert(r.questions.every(x=>normalize(x.question)===normalize(q.question)));
  const pasted=find(bank,'Question 12\n'+q.question+'\nGroup of answer choices\n'+q.options.join('\n'),q.deck);
  assert.equal(pasted.kind,'exact');
  assert(pasted.questions.some(x=>x.id===q.id));
}
const statement=bank.find(q=>q.deck==='summative4'&&q.question.includes('default route has a /0'));
assert(statement);
assert(find(bank,statement.question,'summative4').questions.every(q=>!q.question.includes('/24')));
assert.equal(find(bank,'routers packets random nonsense not a question','summative4').questions.length,0);
assert(find(bank,'administrative distance','summative4').questions.every(q=>normalize(q.question).includes('administrative distance')));
assert.equal(find(bank,statement.question,'ccst').questions.length,0);
console.log('PASS: all 704 exact questions, pasted choices, question numbers, near-identical wording, literal phrases, and deck isolation');
