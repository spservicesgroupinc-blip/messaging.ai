import type { GasRequestPayload, GasResponse, PublicUser } from '../utils/sheetsProtocol';

const SESSION_USER_STORAGE_KEY = 'relay_session_user';
const ACTIVE_CHANNEL_STORAGE_KEY = 'relay_active_channel_id';

export function getSavedSessionUser(): PublicUser | null {
  try {
    const raw = localStorage.getItem(SESSION_USER_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicUser;
    if (parsed && parsed.user_id && parsed.email) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

export function saveSessionUser(user: PublicUser | null): void {
  try {
    if (user) {
      localStorage.setItem(SESSION_USER_STORAGE_KEY, JSON.stringify(user));
    } else {
      localStorage.removeItem(SESSION_USER_STORAGE_KEY);
    }
  } catch {
    // ignore storage errors
  }
}

export function getSavedActiveChannelId(): string {
  try {
    return localStorage.getItem(ACTIVE_CHANNEL_STORAGE_KEY) || '';
  } catch {
    return '';
  }
}

export function saveActiveChannelId(channelId: string): void {
  try {
    if (channelId) {
      localStorage.setItem(ACTIVE_CHANNEL_STORAGE_KEY, channelId);
    } else {
      localStorage.removeItem(ACTIVE_CHANNEL_STORAGE_KEY);
    }
  } catch {
    // ignore
  }
}

export async function callSheetsBackend(
  payload: GasRequestPayload,
  signal?: AbortSignal
): Promise<GasResponse> {
  const timeout = AbortSignal.timeout(30000);
  const requestSignal = signal ? AbortSignal.any([signal, timeout]) : timeout;
  for (let attempt = 0; ; attempt++) {
    const res = await fetch('/api/gas', {
      signal: requestSignal,
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('Unable to connect. Please try again.');
    const result = (await res.json()) as GasResponse;
    // A lock rejection guarantees the write never started. Never retry uncertain writes.
    if (result.ok || result.code !== 'LOCK_BUSY' || attempt >= 1) return result;
  }
}
