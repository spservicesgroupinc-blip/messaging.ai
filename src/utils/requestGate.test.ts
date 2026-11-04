import test from 'node:test';
import assert from 'node:assert/strict';
import { RequestGate } from './requestGate';

test('older responses are discarded within their scope', () => {
  const gate = new RequestGate();
  const old = gate.begin('channel-a');
  const latest = gate.begin('channel-a');
  assert.equal(gate.isCurrent(old), false);
  assert.equal(gate.isCurrent(latest), true);
});
test('channels have independent responses and sign-out invalidates every request', () => {
  const gate = new RequestGate();
  const a = gate.begin('a');
  const b = gate.begin('b');
  assert.equal(gate.isCurrent(a), true);
  gate.reset();
  assert.equal(gate.isCurrent(a), false);
  assert.equal(gate.isCurrent(b), false);
});
