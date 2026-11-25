import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const server=readFileSync(new URL('./api/account.mjs',import.meta.url),'utf8');
const client=readFileSync(new URL('./account.js',import.meta.url),'utf8');
const serverPattern=vm.runInNewContext(server.match(/const DATA_KEY = (\/.*\/);/)[1]);
const clientPattern=vm.runInNewContext(client.match(/const allowed=(\/.*\/);/)[1]);
const keys=[];
for(const deck of ['', 'ccst_notebook_', 'summative3_', 'summative4_', 'combined_']) {
  for(const suffix of ['practice_v1','stats','favorites','heart_limit','ranked_run_all','ranked_run_shuffle','ranked_run_adaptive','ranked_run_blitz','ranked_run_training']) keys.push(`pp_${deck}${suffix}`);
}
keys.push(...['theme','motion','sound','correct_first','hide_answers','explanations_visible','key_idea_visible'].map(x=>`pp_${x}`));
for(const key of keys){assert(serverPattern.test(key),key);assert(clientPattern.test(key),key);}
for(const key of ['password','pp_token','pp_admin','pp_account','__proto__']){assert(!serverPattern.test(key));assert(!clientPattern.test(key));}
// Exercise the actual cloud validator with all deck namespaces together.
const validator=server.slice(server.indexOf('function validateData(')).split(/\r?\n\r?\nexport default/)[0];
const scope={DATA_KEY:serverPattern,ApiError:class extends Error{},data:Object.fromEntries(keys.map(key=>[key,key.endsWith('favorites')?[]:{}]))};
vm.runInNewContext(`${validator}\nvalidateData(data);`,scope);
console.log(`All ${keys.length} study-progress and preference keys pass both cloud filters and the cloud validator. Account secrets remain excluded.`);
