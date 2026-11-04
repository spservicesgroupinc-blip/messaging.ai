import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { executeSheetAction, type GasRequestPayload, type SheetsDatabase } from '../src/utils/sheetsProtocol';

const user = { user_id: 'test-user', email: 'mobile@example.test', full_name: 'Mobile Tester', display_name: 'Mobile', role_title: 'Team member', status_text: '', created_at: '2026-11-04T12:00:00Z', last_seen_at: '2026-11-04T12:00:00Z' };
const teammate = { ...user, user_id: 'teammate', full_name: 'Jordan Smith', email: 'jordan@example.test' };
const channel = { channel_id: 'general', name: 'general', description: 'Team updates and conversations', is_private: false, created_by: 'test-user', created_at: user.created_at, dm_participants: '' };
const planning = { ...channel, channel_id: 'planning', name: 'project-planning' };
const dm = { ...channel, channel_id: 'dm', name: 'Direct message', is_private: true, dm_participants: 'teammate,test-user' };
function messages(id = 'general', count = 25) {
  return Array.from({ length: count }, (_, i) => ({ message_id: id + '-m' + i, channel_id: id, user_id: user.user_id, user_name: user.full_name, user_role: user.role_title, content: `Update ${i + 1} for ${id}: Please review the latest project notes.`, parent_message_id: '', reactions_json: '{}', reactions: {}, reply_count: 0, created_at: `2026-11-04T12:${String(i).padStart(2, '0')}:00Z`, updated_at: '' }));
}
type Interceptor = (payload: Record<string, string>, route: Route) => Promise<boolean | void>;
async function setup(page: Page, intercept?: Interceptor) {
  let database: SheetsDatabase = { Users: [user, teammate].map(person => ({ ...person, password_hash: '' })), Channels: [channel, planning, dm], ChannelMembers: [], Messages: ['general', 'planning', 'dm'].flatMap(id => messages(id)) };
  await page.context().addInitScript(saved => localStorage.setItem('relay_session_user', JSON.stringify(saved)), user);
  await page.route('**/api/events', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"connected","mode":"serverless-polling"}\n\n' }));
  await page.route('**/api/gas', async route => {
    const payload = route.request().postDataJSON();
    if (await intercept?.(payload, route)) return;
    const result = executeSheetAction(database, payload as GasRequestPayload);
    database = result.db;
    await route.fulfill({ json: result.response });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Channels', exact: true, level: 1 })).toBeVisible();
}
async function open(page: Page, name = 'general') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message input', exact: true })).toBeVisible();
}
async function thread(page: Page) {
  await page.getByRole('button', { name: 'Show message actions', exact: true }).and(page.locator(':enabled')).last().click();
  await page.getByRole('button', { name: 'Reply in thread', exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Reply in thread', exact: true })).toBeVisible();
}

test('bottom tabs, teammate search, conversation Back, and browser Back', async ({ page }) => {
  await setup(page);
  await open(page);
  await expect(page.getByRole('navigation', { name: 'Mobile workspace' })).toBeVisible();
  await page.getByRole('button', { name: 'Back to conversations' }).click();
  await expect(page.getByRole('heading', { name: 'Channels', exact: true, level: 1 })).toBeVisible();
  await page.getByRole('button', { name: 'DMs', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Direct messages' })).toBeVisible();
  await page.getByRole('button', { name: 'New message', exact: true }).click();
  await page.getByRole('searchbox', { name: 'Find a teammate' }).fill('Jordan');
  await page.getByRole('button', { name: /Jordan Smith/ }).click();
  await expect(page.getByRole('heading', { name: 'Jordan Smith', exact: true })).toBeVisible();
  await page.goBack();
  await expect(page.getByRole('heading', { name: 'People', exact: true })).toBeVisible();
});

test('channel drafts isolate, restore after reload, clear explicitly, and phone Return inserts a newline', async ({ page }) => {
  let sends = 0;
  await setup(page, async payload => { if (payload.action === 'sendMessage') sends++; });
  await open(page);
  const input = page.getByRole('textbox', { name: 'Message input', exact: true });
  await input.fill('Draft for general'); await input.press('Enter');
  await expect(input).toHaveValue('Draft for general\n'); expect(sends).toBe(0);
  await page.getByRole('button', { name: 'Channels', exact: true }).click();
  await open(page, 'project-planning'); await expect(input).toHaveValue('');
  await input.fill('Planning draft'); await page.reload(); await expect(input).toHaveValue('Planning draft');
  await page.getByRole('button', { name: 'Channels', exact: true }).click(); await open(page);
  await expect(input).toHaveValue('Draft for general\n');
  await page.getByRole('button', { name: 'Clear draft' }).click(); await expect(input).toHaveValue('');
});

test('failed sends keep recoverable text without overwriting a newer main or thread draft', async ({ page }) => {
  await setup(page, async (payload, route) => {
    if (payload.action !== 'sendMessage') return;
    await route.fulfill({ json: { ok: false, error: 'Please try again after reconnecting.' } }); return true;
  });
  await open(page);
  const input = page.getByRole('textbox', { name: 'Message input', exact: true });
  await input.fill('Keep my message'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(input).toHaveValue('');
  await input.fill('Newer draft');
  await expect(page.getByRole('alert')).toContainText('Please try again');
  await page.getByRole('button', { name: 'Restore message draft' }).click();
  await expect(input).toHaveValue('Newer draft\nKeep my message');
  await thread(page);
  const reply = page.getByRole('textbox', { name: 'Reply in thread', exact: true });
  await reply.fill('Keep my reply'); await page.getByRole('button', { name: 'Send thread reply' }).click();
  await expect(reply).toHaveValue('');
  await reply.fill('Newer reply');
  await page.getByRole('button', { name: 'Close thread panel' }).click();
  await expect(page.getByRole('alert')).toContainText('Please try again');
  await page.getByRole('button', { name: 'Restore message draft' }).click();
  await expect(reply).toHaveValue('Newer reply\nKeep my reply');
});

for (const firstFails of [false, true]) test(`a thread reply waits for a pending channel send (${firstFails ? 'failed' : 'successful'} first send)`, async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const sent: string[] = [];
  await setup(page, async (payload, route) => {
    if (payload.action !== 'sendMessage') return;
    sent.push(payload.content);
    if (sent.length === 1) {
      await held;
      if (firstFails) {
        await route.fulfill({ json: { ok: false, error: 'Send failed. Your draft was kept.' } });
        return true;
      }
    }
    await route.fulfill({ json: { ok: true, messages: messages() } });
    return true;
  });
  await open(page);
  await page.getByRole('textbox', { name: 'Message input', exact: true }).fill('Main message');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  await thread(page);
  const reply = page.getByRole('textbox', { name: 'Reply in thread', exact: true });
  await reply.fill('Thread reply');
  await page.getByRole('button', { name: 'Send thread reply' }).click();
  try {
    await expect(reply).toBeEnabled();
    await expect(reply).toHaveValue('');
    await expect(page.getByRole('dialog').getByText('Thread reply', { exact: true })).toBeVisible();
    await expect(page.getByRole('alert')).toHaveCount(0);
    expect(sent).toEqual(['Main message']);
  } finally { release(); }
  await expect(reply).toHaveValue('');
  await expect.poll(() => sent).toEqual(['Main message', 'Thread reply']);
  await page.getByRole('button', { name: 'Close thread panel' }).click();
  await expect(page.getByRole('textbox', { name: 'Message input', exact: true })).toHaveValue('');
  if (firstFails) await expect(page.getByRole('region', { name: 'Changes needing attention' })).toContainText('Main message');
});

test('sign-out cancels queued actions before they reach the backend', async ({ page }) => {
  let release!: () => void;
  const held = new Promise<void>(resolve => { release = resolve; });
  const sent: string[] = [];
  await setup(page, async (payload, route) => {
    if (payload.action !== 'sendMessage') return;
    sent.push(payload.content);
    await held;
    await route.fulfill({ json: { ok: true, messages: messages() } }).catch(() => {});
    return true;
  });
  await open(page);
  await page.getByRole('textbox', { name: 'Message input', exact: true }).fill('In flight');
  await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect.poll(() => sent.length).toBe(1);
  await thread(page);
  await page.getByRole('textbox', { name: 'Reply in thread', exact: true }).fill('Do not send');
  await page.getByRole('button', { name: 'Send thread reply' }).click();
  await expect(page.getByRole('textbox', { name: 'Reply in thread', exact: true })).toHaveValue('');
  await expect(page.getByRole('dialog').getByText('Do not send', { exact: true })).toBeVisible();
  await page.getByRole('button', { name: 'Close thread panel' }).click();
  await page.getByRole('button', { name: 'Channels', exact: true }).click();
  try { await page.getByRole('button', { name: 'Sign out', exact: true }).click(); }
  finally { release(); }
  await expect(page.getByRole('button', { name: 'Sign in to Relay', exact: true })).toBeVisible();
  expect(sent).toEqual(['In flight']);
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('relay_actions_v1:')).length)).toBe(0);
});

test('multiple messages appear and leave the composer free before background saves finish', async ({ page }) => {
  const errors: string[] = [];
  let releaseFirst!: () => void; let releaseSecond!: () => void;
  const first = new Promise<void>(resolve => { releaseFirst = resolve; });
  const second = new Promise<void>(resolve => { releaseSecond = resolve; });
  let sends = 0;
  await setup(page, async payload => {
    if (payload.action !== 'sendMessage') return;
    sends++;
    await (sends === 1 ? first : second);
  });
  await open(page);
  // Observe the action itself; initial document metadata is outside this regression.
  page.on('pageerror', error => errors.push(error.message));
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()); });
  const input = page.getByRole('textbox', { name: 'Message input', exact: true });
  try {
    await input.fill('Instant first'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(input).toHaveValue(''); await expect(input).toBeEnabled();
    await expect(page.getByText('Instant first', { exact: true })).toBeVisible();
    await input.fill('Instant second'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByText('Instant second', { exact: true })).toBeVisible();
    await expect(input).toHaveValue(''); await input.fill('Next unsent draft');
    await page.screenshot({ path: test.info().outputPath('instant-actions.png') });
    expect(sends).toBe(1);
    releaseFirst(); await expect.poll(() => sends).toBe(2);
    await expect(page.getByText('Instant first', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Instant second', { exact: true })).toHaveCount(1);
    await expect(page.locator('article p').filter({ hasText: /^Instant (first|second)$/ })).toHaveText(['Instant first', 'Instant second']);
    expect(errors).toEqual([]);
    await expect(input).toHaveValue('Next unsent draft');
    releaseSecond();
    await expect(page.getByText('Sending…', { exact: true })).toHaveCount(0);
    await expect(page.getByText('Instant first', { exact: true })).toHaveCount(1);
    await expect(page.getByText('Instant second', { exact: true })).toHaveCount(1);
  } finally { releaseFirst(); releaseSecond(); }
});

test('reaction, edit, and delete update immediately and roll back after a background failure', async ({ page }) => {
  let release!: () => void;
  let hold = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await setup(page, async (payload, route) => {
    if (!['toggleReaction', 'editMessage', 'deleteMessage'].includes(payload.action)) return;
    requests.push(payload.action);
    await hold;
    await route.fulfill({ json: { ok: false, error: 'Could not save this change.' } }); return true;
  });
  await open(page);
  const original = 'Update 25 for general: Please review the latest project notes.';
  try {
    await page.getByRole('button', { name: 'Show message actions', exact: true }).last().click();
    await page.getByRole('button', { name: 'React with 👍', exact: true }).click();
    await expect(page.getByRole('button', { name: '👍, 1 reaction', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Show message actions', exact: true }).last().click();
    await page.getByRole('button', { name: 'Edit message', exact: true }).click();
    await page.getByRole('textbox', { name: 'Edit message', exact: true }).fill('Instant edit');
    await page.getByRole('button', { name: 'Save changes', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Edit message', exact: true })).toHaveCount(0);
    await expect(page.getByText('Instant edit', { exact: false })).toBeVisible();
    release();
    await expect(page.getByText(original, { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: '👍, 1 reaction', exact: true })).toHaveCount(0);
    await expect.poll(() => requests.length).toBe(2);
    hold = new Promise<void>(resolve => { release = resolve; });
    await page.getByRole('button', { name: 'Show message actions', exact: true }).last().click();
    await page.getByRole('button', { name: 'Delete message', exact: true }).click();
    await expect(page.getByText(original, { exact: true })).toHaveCount(0);
    release(); await expect(page.getByText(original, { exact: true })).toBeVisible();
  } finally { release(); }
});

test('creating a channel opens it immediately and queued messages use its confirmed ID', async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const requests: Record<string, string>[] = [];
  await setup(page, async payload => {
    if (!['createChannel', 'sendMessage'].includes(payload.action)) return;
    requests.push(payload);
    if (payload.action === 'createChannel') await hold;
  });
  try {
    await page.getByRole('button', { name: 'New channel', exact: true }).click();
    await page.locator('#new-channel-name').fill('instant-channel');
    await page.getByRole('button', { name: 'Create Channel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('heading', { name: 'instant-channel', exact: true }).first()).toBeVisible();
    const input = page.getByRole('textbox', { name: 'Message input', exact: true });
    await input.fill('Message in new channel');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(page.getByText('Message in new channel', { exact: true })).toBeVisible();
    await input.fill('Next channel draft');
    expect(requests.length).toBe(1);
    release();
    await expect.poll(() => requests.length).toBe(2);
    expect(requests[1].channelId).not.toMatch(/^local_/);
    await expect(page.getByText('Sending…', { exact: true })).toHaveCount(0);
    await expect(input).toHaveValue('Next channel draft');
    await page.reload();
    await expect(input).toHaveValue('Next channel draft');
    await expect(page.getByText('Message in new channel', { exact: true })).toHaveCount(1);
  } finally { release(); }
});

test('unconfirmed sends survive reload as recoverable text without automatic resending', async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  let sends = 0;
  await setup(page, async (payload, route) => {
    if (payload.action !== 'sendMessage') return;
    sends++; await hold;
    await route.fulfill({ json: { ok: false, error: 'Connection lost' } }).catch(() => {}); return true;
  });
  try {
    await open(page);
    const input = page.getByRole('textbox', { name: 'Message input', exact: true });
    await input.fill('Retain after reload');
    await page.getByRole('button', { name: 'Send message', exact: true }).click();
    await expect(input).toHaveValue('');
    await page.reload();
    await expect(page.getByRole('region', { name: 'Changes needing attention' })).toContainText('Retain after reload');
    expect(sends).toBe(1);
    await page.getByRole('button', { name: 'Restore message draft', exact: true }).click();
    await expect(input).toHaveValue('Retain after reload');
    expect(sends).toBe(1);
  } finally { release(); }
});

test('private channel creation, members, rename, and deletion respond before background confirmation', async ({ page }) => {
  let release!: () => void;
  const hold = new Promise<void>(resolve => { release = resolve; });
  const requests: string[] = [];
  await setup(page, async payload => {
    if (['getBootstrap', 'getMessages'].includes(payload.action)) return;
    requests.push(payload.action);
    if (payload.action === 'createChannel') await hold;
  });
  try {
    await page.getByRole('button', { name: 'New channel', exact: true }).click();
    await page.getByRole('button', { name: 'Visibility: Private Channel', exact: true }).click();
    await page.locator('#new-channel-name').fill('instant-private');
    await page.getByRole('button', { name: 'Create Channel', exact: true }).click();
    await expect(page.getByRole('heading', { name: 'instant-private', exact: true }).first()).toBeVisible();
    await page.getByRole('button', { name: 'View 1 channel members', exact: true }).click();
    await page.getByRole('dialog').getByRole('button', { name: 'Add', exact: true }).last().click();
    const remove = page.getByRole('button', { name: 'Remove Jordan Smith from channel', exact: true });
    await expect(remove).toBeVisible(); await remove.click(); await expect(remove).toHaveCount(0);
    await page.getByRole('button', { name: 'Close channel access panel', exact: true }).click();
    await page.getByRole('button', { name: 'Channels', exact: true }).click();
    await page.getByRole('button', { name: 'Channel options for instant-private', exact: true }).click();
    await page.getByRole('button', { name: 'Edit channel', exact: true }).click();
    await page.locator('#edit-channel-name').fill('instant-renamed');
    await page.getByRole('button', { name: 'Save Changes', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'instant-renamed', exact: true })).toBeVisible();
    await page.getByRole('button', { name: 'Channel options for instant-renamed', exact: true }).click();
    await page.getByRole('button', { name: 'Delete channel', exact: true }).click();
    await page.getByRole('button', { name: 'Delete Channel', exact: true }).click();
    await expect(page.getByRole('dialog')).toHaveCount(0);
    await page.getByRole('button', { name: 'Channels', exact: true }).click();
    await expect(page.getByRole('button', { name: 'instant-renamed', exact: true })).toHaveCount(0);
    expect(requests).toEqual(['createChannel']);
    release();
    await expect.poll(() => requests).toEqual(['createChannel', 'addChannelMember', 'removeChannelMember', 'editChannel', 'deleteChannel']);
    await expect(page.getByRole('region', { name: 'Changes needing attention' })).toHaveCount(0);
  } finally { release(); }
});

test('late channel reads cannot appear under another channel heading', async ({ page }) => {
  await setup(page, async (payload, route) => {
    if (payload.action !== 'getMessages') return;
    if (payload.channelId === 'general') await new Promise(resolve => setTimeout(resolve, 700));
    await route.fulfill({ json: { ok: true, messages: messages(payload.channelId) } }).catch(() => {}); return true;
  });
  await open(page); await page.getByRole('button', { name: 'Channels', exact: true }).click(); await open(page, 'project-planning');
  await expect(page.getByText('Update 25 for planning: Please review the latest project notes.', { exact: true })).toBeVisible();
  await page.waitForTimeout(800);
  await expect(page.getByRole('heading', { name: 'project-planning', exact: true }).first()).toBeVisible();
  await expect(page.getByText('Update 25 for general: Please review the latest project notes.', { exact: true })).toHaveCount(0);
});

test('offline composing never sends automatically, and sign-out clears local drafts', async ({ page, context }) => {
  let sends = 0;
  await setup(page, async payload => { if (payload.action === 'sendMessage') sends++; }); await open(page);
  await context.setOffline(true);
  const input = page.getByRole('textbox', { name: 'Message input', exact: true });
  await input.fill('Offline draft'); await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeDisabled();
  await context.setOffline(false); await expect(page.getByRole('button', { name: 'Send message', exact: true })).toBeEnabled(); expect(sends).toBe(0);
  await page.getByRole('button', { name: 'Channels', exact: true }).click(); await page.getByRole('button', { name: 'Sign out', exact: true }).click();
  expect(await page.evaluate(() => Object.keys(localStorage).filter(key => key.startsWith('relay_draft_v1:')).length)).toBe(0);
});

test('touch actions are visible, trap focus, dismiss with Escape, and restore focus', async ({ page }) => {
  await setup(page);
  const trigger = page.getByRole('button', { name: 'Channel options for general', exact: true });
  const box = await trigger.boundingBox(); expect(box!.width).toBeGreaterThanOrEqual(44); expect(box!.height).toBeGreaterThanOrEqual(44);
  await trigger.click(); await expect(page.getByRole('dialog', { name: '#general' })).toBeVisible();
  await expect(page.getByRole('navigation', { name: 'Mobile workspace' })).toHaveCount(0);
  await page.keyboard.press('Shift+Tab');
  expect(await page.evaluate(() => Boolean(document.activeElement?.closest('[role="dialog"]')))).toBe(true);
  await page.keyboard.press('Escape'); await expect(page.getByRole('dialog')).toHaveCount(0);
  await expect(trigger).toBeFocused();
});

test('keyboard viewport keeps controls visible and hides bottom tabs', async ({ page }) => {
  await page.context().addInitScript(() => {
    const viewport = Object.assign(new EventTarget(), { height: 844, width: 390, offsetTop: 0, scale: 1 });
    Object.defineProperty(window, 'visualViewport', { value: viewport, configurable: true });
  });
  await setup(page); await open(page);
  await page.getByRole('textbox', { name: 'Message input', exact: true }).focus();
  await page.evaluate(() => { Object.assign(visualViewport!, { height: 420 }); visualViewport!.dispatchEvent(new Event('resize')); });
  await expect(page.getByRole('navigation', { name: 'Mobile workspace' })).toHaveCount(0);
  const button = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox(); expect(button!.y + button!.height).toBeLessThanOrEqual(420);
  await page.evaluate(() => { Object.assign(visualViewport!, { height: 844 }); visualViewport!.dispatchEvent(new Event('resize')); });
  await expect(page.getByRole('navigation', { name: 'Mobile workspace' })).toBeVisible();
});

test('scroll stays put for incoming messages and New messages jumps to latest', async ({ page }) => {
  let count = 25;
  await setup(page, async (payload, route) => {
    if (!['getBootstrap', 'getMessages'].includes(payload.action)) return;
    await route.fulfill({ json: { ok: true, user, users: [user, teammate], channels: [channel, planning, dm], memberships: [], messages: messages(payload.channelId || 'general', count) } }); return true;
  }); await open(page);
  const stream = page.getByTestId('message-stream'); await stream.evaluate(node => { node.scrollTop = 0; node.dispatchEvent(new Event('scroll')); });
  count = 26; await page.getByRole('button', { name: 'Refresh messages', exact: true }).click();
  await expect(page.getByRole('button', { name: 'New messages', exact: true })).toBeVisible();
  expect(await stream.evaluate(node => node.scrollTop)).toBe(0);
  await page.getByRole('button', { name: 'New messages', exact: true }).click();
  await expect(page.getByText('Update 26 for general: Please review the latest project notes.', { exact: true })).toBeVisible();
});

test('layouts and accessibility pass across mobile, landscape, tablet, and desktop', async ({ page }) => {
  await setup(page); await open(page);
  for (const [width, height] of [[320, 568], [390, 844], [768, 1024], [844, 390], [1024, 768], [1440, 900]]) {
    await page.setViewportSize({ width, height });
    await expect.poll(() => page.locator('.workspace-shell').evaluate(node => Math.round(node.getBoundingClientRect().height))).toBe(height);
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(width);
    const button = await page.getByRole('button', { name: 'Send message', exact: true }).boundingBox(); expect(button!.y + button!.height).toBeLessThanOrEqual(height);
    const audit = await new AxeBuilder({ page }).withTags(['wcag2a', 'wcag2aa', 'wcag21aa']).analyze(); expect(audit.violations).toEqual([]);
  }
});
