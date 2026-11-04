import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { callSheetsBackend, getSavedActiveChannelId, getSavedSessionUser, saveActiveChannelId, saveSessionUser } from '../services/gasClient';
import { drafts } from '../utils/drafts';
import { RequestGate } from '../utils/requestGate';
import { MutationQueue } from '../utils/mutationQueue';
import { OptimisticWorkspace } from '../utils/optimisticWorkspace';
import type { EnrichedMessage, GasRequestPayload, GasResponse, PublicUser } from '../utils/sheetsProtocol';

export interface ActionResult { ok: boolean; error?: string }
const EMPTY_MESSAGES: EnrichedMessage[] = [];
function createModel(user: PublicUser | null) {
  let storage: Storage | undefined;
  try { storage = window.localStorage; } catch { /* Pending changes remain available in memory. */ }
  return new OptimisticWorkspace(user, storage);
}
export function useWorkspace() {
  const [user, setUser] = useState(getSavedSessionUser);
  const [model, setModel] = useState(() => createModel(user));
  const modelRef = useRef(model); modelRef.current = model;
  const state = useSyncExternalStore(model.subscribe, model.getSnapshot);
  const [activeId, setActiveId] = useState(getSavedActiveChannelId);
  const [loading, setLoading] = useState(Boolean(user));
  const [loadingChannel, setLoadingChannel] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [error, setError] = useState('');
  const userRef = useRef(user);
  userRef.current = user;
  const activeRef = useRef(activeId);
  activeRef.current = activeId;
  const gate = useRef(new RequestGate());
  const read = useRef<AbortController | null>(null);
  const refreshing = useRef(false);
  const mutations = useRef(new MutationQueue());
  const controllers = useRef(new Set<AbortController>());

  const setActive = useCallback((id: string) => {
    activeRef.current = id; setActiveId(id); saveActiveChannelId(id);
  }, []);
  const applyMetadata = useCallback((res: GasResponse) => {
    modelRef.current.applyResponse({ ok: res.ok, channels: res.channels, users: res.users, memberships: res.memberships });
  }, []);
  const saveMessages = useCallback((id: string, res: GasResponse) => {
    if (res.messages) modelRef.current.applyResponse({ ok: res.ok, messages: res.messages }, id);
  }, []);
  const invalidate = useCallback(() => {
    gate.current.reset(); read.current?.abort();
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
    mutations.current = new MutationQueue();
  }, []);

  const refresh = useCallback(async () => {
    const current = userRef.current;
    if (!current || refreshing.current || mutations.current.size) return;
    if (!navigator.onLine || document.hidden) { setLoading(false); return; }
    refreshing.current = true; setSyncing(true);
    const id = activeRef.current;
    const metadataTicket = gate.current.begin('workspace');
    const messageTicket = gate.current.begin('messages:' + id);
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const owner = modelRef.current;
      const res = await callSheetsBackend({ action: 'getBootstrap', userId: current.user_id, channelId: owner.isProvisional(id) ? '' : owner.resolve(id) }, controller.signal);
      if (!gate.current.isCurrent(metadataTicket) || userRef.current?.user_id !== current.user_id) return;
      if (!res.ok || !res.user) {
        if (res.error === 'Session expired. Please sign in again.') { invalidate(); saveSessionUser(null); setUser(null); }
        else setError(res.error || 'Unable to refresh. Please try again.');
        return;
      }
      setUser(res.user); saveSessionUser(res.user); applyMetadata(res); setError('');
      const available = owner.getSnapshot().channels;
      const resolved = available.some(channel => channel.channel_id === activeRef.current) ? activeRef.current : available[0]?.channel_id ?? '';
      if (resolved !== activeRef.current) setActive(resolved);
      if (gate.current.isCurrent(messageTicket) && resolved === (id || resolved)) saveMessages(resolved, res);
    } catch (err) {
      if (!controller.signal.aborted && gate.current.isCurrent(metadataTicket)) setError(err instanceof Error ? err.message : 'Unable to refresh. Please try again.');
    } finally {
      controllers.current.delete(controller); refreshing.current = false;
      if (userRef.current?.user_id === current.user_id) { setLoading(false); setSyncing(false); }
    }
  }, [applyMetadata, invalidate, saveMessages, setActive]);

  useEffect(() => {
    if (!user?.user_id) return;
    const update = () => { if (!document.hidden && navigator.onLine) void refresh(); };
    update();
    const interval = window.setInterval(update, 5000);
    let events: EventSource | null = null;
    const connect = () => {
      events?.close(); events = null;
      if (document.hidden || !navigator.onLine) return;
      events = new EventSource('/api/events');
      events.onmessage = event => {
        try {
          const data = JSON.parse(event.data);
          if (data.mode === 'serverless-polling') { events?.close(); events = null; }
          else if (data.type !== 'connected') update();
        } catch { /* Ignore malformed stream events; polling still refreshes. */ }
      };
    };
    const resume = () => { connect(); update(); };
    connect();
    document.addEventListener('visibilitychange', resume);
    window.addEventListener('online', resume); window.addEventListener('offline', connect);
    return () => {
      clearInterval(interval); events?.close(); invalidate();
      document.removeEventListener('visibilitychange', resume);
      window.removeEventListener('online', resume); window.removeEventListener('offline', connect);
    };
  }, [user?.user_id, refresh, invalidate]);

  const select = useCallback(async (id: string): Promise<ActionResult> => {
    if (!userRef.current) return { ok: false, error: 'Please sign in.' };
    read.current?.abort();
    const controller = new AbortController(); read.current = controller;
    const ticket = gate.current.begin('messages:' + id);
    const userId = userRef.current.user_id;
    const owner = modelRef.current;
    setActive(id); setLoadingChannel(!owner.hasMessages(id)); setError('');
    if (owner.isProvisional(id)) { setLoadingChannel(false); return { ok: true }; }
    try {
      if (!navigator.onLine) throw Error('You are offline. You can keep writing a draft.');
      const res = await callSheetsBackend({ action: 'getMessages', userId, channelId: owner.resolve(id) }, controller.signal);
      if (controller.signal.aborted || !gate.current.isCurrent(ticket) || userRef.current?.user_id !== userId) return { ok: false };
      if (!res.ok) throw Error(res.error || 'Unable to load messages.');
      saveMessages(id, res); return { ok: true };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Unable to load messages.';
      if (!controller.signal.aborted && activeRef.current === id && userRef.current?.user_id === userId) setError(message);
      return { ok: false, error: message };
    } finally {
      if (read.current === controller) setLoadingChannel(false);
    }
  }, [saveMessages, setActive]);

  // Resolve on local acceptance so composers and dialogs stay responsive.
  // Background failures are reported through the recoverable action notices.
  const act = useCallback(async (payload: GasRequestPayload): Promise<GasResponse> => {
    const current = userRef.current;
    if (!current) return { ok: false, error: 'Please sign in.' };
    if (!navigator.onLine) return { ok: false, error: 'You are offline. Reconnect, then try again.' };
    const channelId = payload.channelId ?? (['createChannel', 'openDirectMessage', 'updateUserStatus'].includes(payload.action) ? '' : activeRef.current);
    const owner = modelRef.current;
    const submitted = owner.submit({ ...payload, channelId, userId: current.user_id });
    if (!submitted.operation) return submitted.response;
    const operation = submitted.operation;
    gate.current.begin('workspace'); gate.current.begin('messages:' + channelId);
    const controller = new AbortController(); controllers.current.add(controller);
    void mutations.current.run(async () => {
      try {
        if (controller.signal.aborted || modelRef.current !== owner) return;
        if (!navigator.onLine) throw Error('You are offline. Your change has not been saved.');
        const res = await callSheetsBackend(owner.request(operation), controller.signal);
        if (controller.signal.aborted || modelRef.current !== owner) return;
        // In-flight reads may predate this save; their snapshots must not replace it.
        gate.current.begin('workspace'); gate.current.begin('messages:' + channelId);
        if (res.ok) {
          owner.confirm(operation, res);
          if (res.user) { setUser(res.user); saveSessionUser(res.user); }
        } else owner.fail(operation, res.error || 'This change was not saved. Please try again.');
      } catch (err) {
        if (!controller.signal.aborted && modelRef.current === owner) owner.fail(operation, err instanceof Error ? err.message : 'Unable to confirm this change.');
      } finally {
        controllers.current.delete(controller);
        if (!controller.signal.aborted && modelRef.current === owner && !owner.getSnapshot().channels.some(channel => channel.channel_id === activeRef.current)) setActive(owner.getSnapshot().channels[0]?.channel_id ?? '');
      }
    });
    return submitted.response;
  }, [setActive]);

  const authenticate = (res: GasResponse) => {
    if (!res.user) return;
    invalidate(); userRef.current = res.user; setUser(res.user); saveSessionUser(res.user);
    const next = createModel(res.user); modelRef.current = next; setModel(next);
    applyMetadata(res); const id = res.channels?.[0]?.channel_id ?? ''; setActive(id); saveMessages(id, res);
  };
  const signOut = () => {
    if (userRef.current) drafts.clearUser(userRef.current.user_id);
    modelRef.current.clear();
    invalidate(); userRef.current = null; setUser(null); saveSessionUser(null); setActive('');
    const next = createModel(null); modelRef.current = next; setModel(next);
    setLoading(false); setError('');
  };
  const restoreDraft = (id: string) => {
    const operation = state.failures.find(item => item.id === id);
    if (!user || !operation?.payload.content) return;
    const channelId = state.channels.some(channel => channel.channel_id === operation.payload.channelId) ? operation.payload.channelId! : state.channels.find(channel => channel.channel_id === activeId)?.channel_id ?? state.channels[0]?.channel_id;
    if (!channelId) return;
    const parentMessageId = state.byChannel[channelId]?.some(message => message.message_id === operation.payload.parentMessageId) ? operation.payload.parentMessageId! : '';
    const existing = drafts.get(user.user_id, channelId, parentMessageId);
    drafts.set(user.user_id, channelId, parentMessageId, existing ? existing + '\n' + operation.payload.content : operation.payload.content);
    model.dismiss(id);
    return { channelId, parentMessageId };
  };
  return { user: state.users.find(item => item.user_id === user?.user_id) ?? user, users: state.users, channels: state.channels, memberships: state.memberships, activeId, messages: state.byChannel[activeId] ?? EMPTY_MESSAGES,
    failures: state.failures, pendingCount: state.pendingCount, backupFailed: state.backupFailed, dismissFailure: (id: string) => model.dismiss(id), restoreDraft,
    loading, loadingChannel, syncing, error, setError, refresh, select, act, authenticate, signOut, setActive };
}
