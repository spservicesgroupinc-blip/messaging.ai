import test from 'node:test';
import assert from 'node:assert/strict';
import { observeAppViewport } from './appViewport';

function createWindow(withVisualViewport = true) {
  const properties = new Map<string, string>();
  const viewport = Object.assign(new EventTarget(), { height: 844, offsetTop: 0, scale: 1 });
  const target = Object.assign(new EventTarget(), {
    innerHeight: 844,
    visualViewport: withVisualViewport ? viewport : null,
    document: { documentElement: { style: {
      setProperty: (name: string, value: string) => properties.set(name, value),
      removeProperty: (name: string) => properties.delete(name),
    } } },
  });
  return { target: target as unknown as Window, viewport, properties };
}

test('app follows the visible height when the keyboard opens and closes', () => {
  const { target, viewport, properties } = createWindow();
  observeAppViewport(target);
  assert.equal(properties.get('--app-height'), '844px');
  viewport.height = 420;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(properties.get('--app-height'), '420px');
  viewport.height = 844;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(properties.get('--app-height'), '844px');
});

test('app follows viewport panning without reflowing when users pinch zoom', () => {
  const { target, viewport, properties } = createWindow();
  observeAppViewport(target);
  viewport.offsetTop = 80;
  viewport.dispatchEvent(new Event('scroll'));
  assert.equal(properties.get('--app-offset-top'), '80px');
  viewport.scale = 2;
  viewport.height = 200;
  viewport.dispatchEvent(new Event('resize'));
  assert.equal(properties.get('--app-height'), '844px');
});

test('falls back to window height on browsers without VisualViewport', () => {
  const { target, properties } = createWindow(false);
  observeAppViewport(target);
  Object.assign(target, { innerHeight: 390 });
  target.dispatchEvent(new Event('resize'));
  assert.equal(properties.get('--app-height'), '390px');
  assert.equal(properties.get('--app-offset-top'), '0px');
});

test('cleanup removes listeners and viewport overrides', () => {
  const { target, viewport, properties } = createWindow();
  const cleanup = observeAppViewport(target);
  cleanup();
  viewport.height = 420;
  viewport.dispatchEvent(new Event('resize'));
  viewport.dispatchEvent(new Event('scroll'));
  target.dispatchEvent(new Event('resize'));
  assert.equal(properties.size, 0);
});
