import test from 'node:test';
import assert from 'node:assert/strict';
import { callSheetsBackend } from '../services/gasClient';

test('only an explicit lock rejection retries a write, with a bounded attempt count', async t => {
  for (const [responses, expectedCalls, expectedOk] of [
    [[{ ok: false, code: 'LOCK_BUSY' }, { ok: true }], 2, true],
    [[{ ok: false, code: 'LOCK_BUSY' }, { ok: false, code: 'LOCK_BUSY' }], 2, false],
    [[{ ok: false, error: 'Failed after writing' }], 1, false],
    [[{ ok: true }], 1, true],
  ] as const) {
    let calls = 0;
    t.mock.method(globalThis, 'fetch', async () => Response.json(responses[calls++]));
    assert.equal((await callSheetsBackend({ action: 'sendMessage', content: 'Test' })).ok, expectedOk);
    assert.equal(calls, expectedCalls);
    t.mock.restoreAll();
  }
});

test('network failures do not retry a send that might already have been saved', async t => {
  let calls = 0;
  t.mock.method(globalThis, 'fetch', async () => { calls++; throw Error('Network lost'); });
  await assert.rejects(callSheetsBackend({ action: 'sendMessage', content: 'Test' }), /Network lost/);
  assert.equal(calls, 1);
});
