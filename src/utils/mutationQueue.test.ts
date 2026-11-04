import test from 'node:test';
import assert from 'node:assert/strict';
import { MutationQueue } from './mutationQueue';

test('actions run in order and failed actions do not block later submissions', async () => {
  const queue = new MutationQueue();
  const order: string[] = [];
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const first = queue.run(async () => { order.push('send'); await hold; throw Error('Disconnected'); });
  const failed = assert.rejects(first, /Disconnected/);
  const second = queue.run(async () => { order.push('reply'); return 'Sent'; });
  await Promise.resolve();
  assert.deepEqual(order, ['send']);
  assert.equal(queue.size, 2);
  release();
  await failed;
  assert.equal(await second, 'Sent');
  assert.deepEqual(order, ['send', 'reply']);
  assert.equal(queue.size, 0);
});
