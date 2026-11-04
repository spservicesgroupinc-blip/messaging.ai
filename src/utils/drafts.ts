const PREFIX = 'relay_draft_v1:';
export class DraftStore {
  private memory = new Map<string, string>();
  private failures = new Set<string>();
  private listeners = new Set<() => void>();
  constructor(private storage?: Pick<Storage, 'getItem' | 'setItem' | 'removeItem' | 'key' | 'length'>) {}
  private key(user: string, channel: string, thread = '') { return PREFIX + [user, channel, thread].map(encodeURIComponent).join(':'); }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  private emit() { this.listeners.forEach(listener => listener()); }
  get(user: string, channel: string, thread = '') {
    const key = this.key(user, channel, thread);
    if (!this.memory.has(key)) {
      try { this.memory.set(key, this.storage?.getItem(key) ?? ''); }
      catch { this.memory.set(key, ''); }
    }
    return this.memory.get(key)!;
  }
  failed(user: string, channel: string, thread = '') { return this.failures.has(this.key(user, channel, thread)); }
  set(user: string, channel: string, thread: string, text: string) {
    const key = this.key(user, channel, thread);
    this.memory.set(key, text);
    try {
      if (!this.storage) throw Error('Storage unavailable');
      if (text) this.storage.setItem(key, text); else this.storage.removeItem(key);
      this.failures.delete(key);
    } catch { this.failures.add(key); }
    this.emit();
    return !this.failures.has(key);
  }
  clearIfUnchanged(user: string, channel: string, thread: string, sentText: string) {
    if (this.get(user, channel, thread) === sentText) this.set(user, channel, thread, '');
  }
  clearUser(user: string) {
    const prefix = PREFIX + encodeURIComponent(user) + ':';
    const keys = new Set([...this.memory.keys()].filter(key => key.startsWith(prefix)));
    try { for (let i = 0; i < (this.storage?.length ?? 0); i++) { const key = this.storage!.key(i); if (key?.startsWith(prefix)) keys.add(key); } } catch { /* Memory remains available. */ }
    for (const key of keys) {
      this.memory.delete(key); this.failures.delete(key);
      try { this.storage?.removeItem(key); } catch { /* Browser may deny storage access. */ }
    }
    this.emit();
  }
}
function browserStorage() { try { return window.localStorage; } catch { return undefined; } }
export const drafts = new DraftStore(typeof window === 'undefined' ? undefined : browserStorage());
