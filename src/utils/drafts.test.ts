import test from 'node:test';
import assert from 'node:assert/strict';
import { DraftStore } from './drafts';

test('drafts remain isolated by user, channel, and thread and restore after reopening', () => {
  const data = new Map<string, string>();
  const storage = { get length() { return data.size; }, key: (i: number) => [...data.keys()][i], getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => { data.set(k, v); }, removeItem: (k: string) => { data.delete(k); } };
  const store = new DraftStore(storage);
  store.set('u1', 'a', '', 'Channel A');
  store.set('u1', 'a', 'thread', 'Thread');
  store.set('u2', 'a', '', 'Other user');
  const reopened = new DraftStore(storage);
  assert.equal(reopened.get('u1', 'a'), 'Channel A');
  assert.equal(reopened.get('u1', 'b'), '');
  assert.equal(reopened.get('u1', 'a', 'thread'), 'Thread');
  reopened.clearUser('u1');
  assert.equal(new DraftStore(storage).get('u1', 'a'), '');
  assert.equal(new DraftStore(storage).get('u2', 'a'), 'Other user');
});

test('failed storage retains text in memory and reports the save failure', () => {
  const store = new DraftStore({ getItem() { throw Error('blocked'); }, setItem() { throw Error('full'); }, removeItem() {}, key() { return null; }, length: 0 });
  assert.equal(store.set('u', 'a', '', 'Still here'), false);
  assert.equal(store.get('u', 'a'), 'Still here');
});

test('a completed send cannot clear a newer draft', () => {
  const store = new DraftStore();
  store.set('u', 'a', '', 'New text');
  store.clearIfUnchanged('u', 'a', '', 'Sent text');
  assert.equal(store.get('u', 'a'), 'New text');
  store.clearIfUnchanged('u', 'a', '', 'New text');
  assert.equal(store.get('u', 'a'), '');
});
