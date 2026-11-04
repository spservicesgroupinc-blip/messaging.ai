import { test, expect, type Page, type Route } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';

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
  await page.context().addInitScript(saved => localStorage.setItem('relay_session_user', JSON.stringify(saved)), user);
  await page.route('**/api/events', route => route.fulfill({ contentType: 'text/event-stream', body: 'data: {"type":"connected","mode":"serverless-polling"}\n\n' }));
  await page.route('**/api/gas', async route => {
    const payload = route.request().postDataJSON();
    if (await intercept?.(payload, route)) return;
    const id = payload.channelId || 'general';
    await route.fulfill({ json: { ok: true, user, users: [user, teammate], channels: [channel, planning, dm], memberships: [], messages: messages(id), ...(payload.action === 'openDirectMessage' ? { channel: dm, messages: messages('dm') } : {}) } });
  });
  await page.goto('/');
  await expect(page.getByRole('heading', { name: 'Channels', exact: true, level: 1 })).toBeVisible();
}
async function open(page: Page, name = 'general') {
  await page.getByRole('button', { name, exact: true }).click();
  await expect(page.getByRole('textbox', { name: 'Message input', exact: true })).toBeVisible();
}
async function thread(page: Page) {
  await page.getByRole('button', { name: 'Show message actions', exact: true }).last().click();
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

test('failed main and thread sends preserve drafts and show errors', async ({ page }) => {
  await setup(page, async (payload, route) => {
    if (payload.action !== 'sendMessage') return;
    await route.fulfill({ json: { ok: false, error: 'Please try again after reconnecting.' } }); return true;
  });
  await open(page);
  const input = page.getByRole('textbox', { name: 'Message input', exact: true });
  await input.fill('Keep my message'); await page.getByRole('button', { name: 'Send message', exact: true }).click();
  await expect(input).toHaveValue('Keep my message'); await expect(page.getByRole('alert')).toContainText('Please try again');
  await thread(page);
  const reply = page.getByRole('textbox', { name: 'Reply in thread', exact: true });
  await reply.fill('Keep my reply'); await page.getByRole('button', { name: 'Send thread reply' }).click();
  await expect(reply).toHaveValue('Keep my reply'); await expect(page.getByRole('dialog').getByRole('alert')).toContainText('Please try again');
  await page.getByRole('button', { name: 'Close thread panel' }).click(); await thread(page); await expect(reply).toHaveValue('Keep my reply');
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
