import { useSyncExternalStore } from 'react';
import { drafts } from '../utils/drafts';

export function useDraft(user: string, channel: string, thread = '') {
  const text = useSyncExternalStore(drafts.subscribe, () => drafts.get(user, channel, thread));
  const saveFailed = useSyncExternalStore(drafts.subscribe, () => drafts.failed(user, channel, thread));
  return {
    text, saveFailed,
    setText: (value: string) => { drafts.set(user, channel, thread, value); },
    clearSent: (value: string) => drafts.clearIfUnchanged(user, channel, thread, value),
  };
}
