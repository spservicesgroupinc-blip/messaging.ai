import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { createEmptySheetsDatabase, executeSheetAction } from './sheetsProtocol';

function backend(options: { busy?: boolean; lockError?: boolean; flushError?: boolean } = {}) {
  const state = { released: 0, flushed: 0, cleared: 0, reads: [] as string[], writes: [] as string[] };
  const seed = executeSheetAction(createEmptySheetsDatabase(), { action: 'signup', fullName: 'Test User', email: 'test@example.test', password: 'test123' }).db;
  const tables: Record<string, unknown[][]> = {};
  const sheets: Record<string, unknown> = {};
  const context = vm.createContext({
    LockService: { getScriptLock: () => ({
      waitLock: () => { if (options.busy || options.lockError) throw Error('Lock timeout'); },
      tryLock: () => { if (options.lockError) throw Error('Lock service unavailable'); return !options.busy; },
      releaseLock: () => { state.released++; },
    }) },
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({ getSheetByName: (name: string) => sheets[name] }),
      flush: () => { state.flushed++; if (options.flushError) throw Error('Flush failed'); },
    },
    ContentService: { MimeType: { JSON: 'json' }, createTextOutput: (body: string) => ({ setMimeType: () => JSON.parse(body) }) },
  });
  vm.runInContext(readFileSync(new URL('../../Code.gs', import.meta.url), 'utf8'), context);
  for (const [name, headers] of Object.entries(context.SHEET_SCHEMAS as Record<string, string[]>)) {
    tables[name] = [headers, ...seed[name as keyof typeof seed].map(row => headers.map(key => row[key as keyof typeof row]))];
    sheets[name] = {
      getLastRow: () => tables[name].length,
      appendRow: (row: unknown[]) => { tables[name].push(row); },
      clearContents: () => { state.cleared++; tables[name] = []; },
      getRange: (r: number, c: number, rows: number, cols: number) => ({
        getValues: () => { state.reads.push(name); return tables[name].slice(r - 1, r - 1 + rows).map(row => row.slice(c - 1, c - 1 + cols)); },
        setValues: (values: unknown[][]) => {
          state.writes.push(name);
          values.forEach((row, i) => { tables[name][r - 1 + i] ??= []; row.forEach((value, j) => { tables[name][r - 1 + i][c - 1 + j] = value; }); });
        },
      }),
    };
  }
  return { state, tables, context, userId: seed.Users[0].user_id };
}

test('Apps Script returns a retryable JSON response when another execution owns the lock', () => {
  const { context, state } = backend({ busy: true });
  const result = context.handleRequest({ action: 'ping' });
  assert.equal(result.ok, false);
  assert.equal(result.code, 'LOCK_BUSY');
  assert.equal(state.released, 0);
});

test('Apps Script catches lock service failures as JSON', () => {
  const { context, state } = backend({ lockError: true });
  assert.equal(context.handleRequest({ action: 'ping' }).ok, false);
  assert.equal(state.released, 0);
});

test('reaction and message edits update one row without clearing the message sheet', () => {
  const { context, tables, userId, state } = backend();
  const first = context.handleRequest({ action: 'sendMessage', userId, channelId: 'ch_general', content: 'First' });
  context.handleRequest({ action: 'sendMessage', userId, channelId: 'ch_general', content: 'Second' });
  const secondRow = [...tables.Messages[2]];
  const messageId = first.messages[0].message_id;
  const reaction = context.handleRequest({ action: 'toggleReaction', userId, messageId, emoji: '👍' });
  assert.equal(reaction.ok, true);
  assert.deepEqual(reaction.messages[0].reactions['👍'], [userId]);
  const edit = context.handleRequest({ action: 'editMessage', userId, messageId, content: 'Edited' });
  assert.equal(edit.ok, true);
  assert.equal(edit.messages[0].content, 'Edited');
  assert.deepEqual(Array.from(tables.Messages[2]), secondRow);
  assert.equal(state.cleared, 0);
  assert.equal(state.flushed, 4);
  assert.equal(state.released, 4);
});

test('flush failure still releases the lock and returns an error', () => {
  const { context, state, userId } = backend({ flushError: true });
  const result = context.handleRequest({ action: 'sendMessage', userId, channelId: 'ch_general', content: 'Test' });
  assert.equal(result.ok, false);
  assert.equal(state.released, 1);
});

test('handler failures flush pending writes before releasing the lock', () => {
  const { context, state } = backend();
  context.handleSendMessage = () => { throw Error('Handler failed'); };
  assert.equal(context.handleRequest({ action: 'sendMessage' }).ok, false);
  assert.equal(state.flushed, 1);
  assert.equal(state.released, 1);
});

test('table snapshots avoid duplicate reads and are discarded between requests', () => {
  const { context, state } = backend();
  assert.equal(context.handleRequest({ action: 'ping' }).ok, true);
  assert.equal(state.reads.filter(name => name === 'Channels').length, 1);
  assert.equal(context.handleRequest({ action: 'ping' }).ok, true);
  assert.equal(state.reads.filter(name => name === 'Channels').length, 2);
  assert.equal(state.flushed, 0);
});

test('downloadable Apps Script matches the deployable source', () => {
  assert.equal(readFileSync(new URL('../data/appsScriptCode.ts', import.meta.url), 'utf8'), readFileSync(new URL('../../Code.gs', import.meta.url), 'utf8'));
});
