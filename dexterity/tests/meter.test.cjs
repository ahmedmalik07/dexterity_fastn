const { test } = require('node:test'), assert = require('node:assert/strict');
const { estimateCost, addUsage } = require('../electron/core.cjs');
const { vocabularyHint } = require('../electron/transcription.cjs');
const { TaskRunner } = require('../electron/task-runner.cjs');

test('cost is estimated only for models with a published rate', () => {
 assert.equal(estimateCost('gemini-2.5-flash', { input: 1e6, output: 0 }), 0.3);
 assert.equal(estimateCost('google/gemini-2.5-flash', { input: 0, output: 1e6 }), 2.5);
 assert.equal(estimateCost('some-unreleased-model', { input: 1e6, output: 1e6 }), null);
 assert.equal(estimateCost('gemini-2.5-flash', undefined), null);
 assert.equal(estimateCost('gemini-2.5-flash', { input: 'many', output: 2 }), null);
});

test('usage totals ignore missing counts instead of guessing them', () => {
 assert.deepEqual(addUsage(undefined, { input: 10, output: 4 }), { input: 10, output: 4 });
 assert.deepEqual(addUsage({ input: 10, output: 4 }, { input: 5, output: 1 }), { input: 15, output: 5 });
 assert.deepEqual(addUsage({ input: 10, output: 4 }, undefined), { input: 10, output: 4 });
});

test('spelling hints carry the user words without letting one recording dominate', () => {
 const hint = vocabularyHint('IRIS, Islamabad\nNADRA;  ');
 for (const word of ['IRIS', 'Islamabad', 'NADRA', 'Dexterity']) assert.ok(hint.includes(word), word);
 assert.ok(hint.includes('never insert one that was not spoken'));
 assert.ok(!vocabularyHint('x'.repeat(60)).includes('x'.repeat(60)));
 assert.ok(vocabularyHint(Array.from({ length: 200 }, (_, i) => 'word' + i).join(',')).split(', ').length <= 100);
});

const context = { controls: [{ id: 'name', name: 'Full name', value: '', actions: ['type'] }], token: 'snapshot' };
const decision = (type = 'none', targetId = '', value = '') => ({ answer: 'Done for you', status: type === 'none' ? 'done' : 'continue', action: { type, targetId, value }, model: 'gemini-2.5-flash', usage: { input: 1000, output: 100 } });

test('a task reports its real time, requests, tokens and estimated cost', async () => {
 const events = []; let calls = 0;
 const runner = new TaskRunner({
  settings: () => ({}), read: async () => ({ ...context, text: String(calls) }),
  act: async () => {}, emit: e => events.push(e), restore: () => {},
  verifier: async () => ({ complete: true, model: 'gemini-2.5-flash', usage: { input: 500, output: 50 } }),
  planner: async () => ++calls === 1 ? decision('type', 'name', 'Alex') : decision()
 });
 await runner.start({ goal: 'Fill my name', mode: 'do' });
 while (runner.run) await new Promise(r => setTimeout(r, 1));
 const finished = events.find(e => e.type === 'task-finished');
 assert.equal(finished.requests, 3, 'two planner calls plus the verifier');
 assert.deepEqual(finished.tokens, { input: 2500, output: 250 });
 assert.ok(Math.abs(finished.cost - (2500 * 0.3 + 250 * 2.5) / 1e6) < 1e-12);
 assert.ok(finished.seconds >= 0);
 assert.ok(events.some(e => e.type === 'task-usage'), 'the meter updates while the task runs');
});

test('the ledger records each performed action and the verification result', async () => {
 const events = []; let calls = 0;
 const runner = new TaskRunner({
  settings: () => ({}), read: async () => ({ ...context, text: String(calls) }),
  act: async () => {}, emit: e => events.push(e), restore: () => {},
  verifier: async () => ({ complete: true }),
  planner: async () => ++calls === 1 ? decision('type', 'name', 'Alex') : decision()
 });
 await runner.start({ goal: 'Fill my name', mode: 'do' });
 while (runner.run) await new Promise(r => setTimeout(r, 1));
 const rows = events.filter(e => e.type === 'task-ledger');
 assert.equal(rows.length, 2);
 assert.equal(rows[0].kind, 'action');
 assert.ok(rows[0].message.includes('Full name') && rows[0].message.includes('Alex'));
 assert.equal(rows[1].kind, 'check');
 assert.equal(rows[1].pass, true);
 assert.deepEqual(events.find(e => e.type === 'task-finished').ledger.map(r => r.kind), ['action', 'check']);
});

test('a failed completion check is written to the ledger before work continues', async () => {
 const events = []; let calls = 0, verifications = 0;
 const runner = new TaskRunner({
  settings: () => ({}), read: async () => ({ ...context, text: String(calls) }),
  act: async () => {}, emit: e => events.push(e), restore: () => {},
  verifier: async () => ++verifications === 1 ? { complete: false, reason: 'Full name is still empty.' } : { complete: true },
  planner: async () => ++calls === 2 ? decision('type', 'name', 'Alex') : decision()
 });
 await runner.start({ goal: 'Fill my name', mode: 'do' });
 while (runner.run) await new Promise(r => setTimeout(r, 1));
 const checks = events.filter(e => e.type === 'task-ledger' && e.kind === 'check');
 assert.equal(checks[0].pass, false);
 assert.ok(checks[0].message.includes('Full name is still empty.'));
 assert.equal(checks.at(-1).pass, true);
});
