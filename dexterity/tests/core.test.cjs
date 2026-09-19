const test = require('node:test'), assert = require('node:assert/strict');
const { parseGuide, toScreenPoint } = require('../electron/core.cjs');
const response = steps => ({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify({ summary: 'Guide', steps }) }] }] });
test('maps coordinates across displays with negative origins', () => { assert.deepEqual(toScreenPoint({ x: .5, y: .25 }, { x: -1920, y: 0, width: 1920, height: 1080 }), { x: -960, y: 270 }); });
test('rejects unknown and out-of-bounds targets', () => { for (const p of [{ x: null, y: .5 }, { x: 1.1, y: .5 }, { x: NaN, y: 0 }]) assert.equal(toScreenPoint(p, {}), null); });
test('discards malformed coordinates without losing guidance', () => { const result = parseGuide(response([{ title: 'Open', detail: 'A menu', x: 2, y: .5 }])); assert.equal(result.steps[0].x, null); assert.equal(result.steps[0].title, 'Open'); });
test('handles refusal and incomplete output', () => { assert.throws(() => parseGuide({ output: [] }), /No guidance/); assert.throws(() => parseGuide({ status: 'incomplete' }), /incomplete/); });
test('rejects invalid step content', () => { assert.throws(() => parseGuide(response([{ title: 1, detail: 'bad', x: null, y: null }])), /Invalid step/); });
