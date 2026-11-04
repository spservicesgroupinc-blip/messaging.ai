import { useCallback, useEffect, useRef, useState } from 'react';
import { callSheetsBackend, getSavedActiveChannelId, getSavedSessionUser, saveActiveChannelId, saveSessionUser } from '../services/gasClient';
import { drafts } from '../utils/drafts';
import { RequestGate } from '../utils/requestGate';
import type { EnrichedMessage, GasRequestPayload, GasResponse, PublicUser, SheetChannel, SheetChannelMember } from '../utils/sheetsProtocol';

export interface ActionResult { ok: boolean; error?: string }
const EMPTY_MESSAGES: EnrichedMessage[] = [];
export function useWorkspace() {
  const [user, setUser] = useState(getSavedSessionUser);
  const [users, setUsers] = useState<PublicUser[]>([]);
  const [channels, setChannels] = useState<SheetChannel[]>([]);
  const [memberships, setMemberships] = useState<SheetChannelMember[]>([]);
  const [activeId, setActiveId] = useState(getSavedActiveChannelId);
  const [byChannel, setByChannel] = useState<Record<string, EnrichedMessage[]>>({});
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
  const mutations = useRef(new Set<string>());
  const controllers = useRef(new Set<AbortController>());

  const setActive = useCallback((id: string) => {
    activeRef.current = id; setActiveId(id); saveActiveChannelId(id);
  }, []);
  const applyMetadata = useCallback((res: GasResponse) => {
    if (res.channels) setChannels(res.channels);
    if (res.users) setUsers(res.users);
    if (res.memberships) setMemberships(res.memberships);
  }, []);
  const saveMessages = useCallback((id: string, res: GasResponse) => {
    if (res.messages) setByChannel(previous => ({ ...previous, [id]: res.messages!.filter(message => message.channel_id === id) }));
  }, []);
  const invalidate = useCallback(() => {
    gate.current.reset(); read.current?.abort();
    controllers.current.forEach(controller => controller.abort());
    controllers.current.clear();
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
      const res = await callSheetsBackend({ action: 'getBootstrap', userId: current.user_id, channelId: id }, controller.signal);
      if (!gate.current.isCurrent(metadataTicket) || userRef.current?.user_id !== current.user_id) return;
      if (!res.ok || !res.user) {
        if (res.error === 'Session expired. Please sign in again.') { invalidate(); saveSessionUser(null); setUser(null); }
        else setError(res.error || 'Unable to refresh. Please try again.');
        return;
      }
      setUser(res.user); saveSessionUser(res.user); applyMetadata(res); setError('');
      const resolved = res.channels?.some(channel => channel.channel_id === activeRef.current) ? activeRef.current : res.channels?.[0]?.channel_id ?? '';
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
    setActive(id); setLoadingChannel(true); setError('');
    try {
      if (!navigator.onLine) throw Error('You are offline. You can keep writing a draft.');
      const res = await callSheetsBackend({ action: 'getMessages', userId, channelId: id }, controller.signal);
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

  const act = useCallback(async (payload: GasRequestPayload): Promise<GasResponse> => {
    const current = userRef.current;
    if (!current) return { ok: false, error: 'Please sign in.' };
    if (!navigator.onLine) return { ok: false, error: 'You are offline. Reconnect, then try again.' };
    const channelId = payload.channelId ?? activeRef.current;
    const scope = channelId || 'workspace';
    if (mutations.current.has(scope)) return { ok: false, error: 'An action is still in progress. Please try again.' };
    mutations.current.add(scope);
    const metadataTicket = gate.current.begin('workspace');
    const messageTicket = gate.current.begin('messages:' + channelId);
    const controller = new AbortController(); controllers.current.add(controller);
    try {
      const res = await callSheetsBackend({ ...payload, channelId, userId: current.user_id }, controller.signal);
      if (userRef.current?.user_id !== current.user_id || controller.signal.aborted) return { ok: false, error: 'Conversation changed. Your draft was kept.' };
      if (res.ok) {
        if (gate.current.isCurrent(metadataTicket)) applyMetadata(res);
        if (gate.current.isCurrent(messageTicket)) saveMessages(res.channel?.channel_id ?? channelId, res);
      }
      return res.ok ? res : { ...res, error: res.error || 'The action failed. Please try again.' };
    } catch (err) {
      return { ok: false, error: err instanceof Error && err.name !== 'AbortError' ? err.message : 'Connection interrupted. Please try again.' };
    } finally { mutations.current.delete(scope); controllers.current.delete(controller); }
  }, [applyMetadata, saveMessages]);

  const authenticate = (res: GasResponse) => {
    if (!res.user) return;
    invalidate(); userRef.current = res.user; setUser(res.user); saveSessionUser(res.user);
    applyMetadata(res); const id = res.channels?.[0]?.channel_id ?? ''; setActive(id); saveMessages(id, res);
  };
  const signOut = () => {
    if (userRef.current) drafts.clearUser(userRef.current.user_id);
    invalidate(); userRef.current = null; setUser(null); saveSessionUser(null); setActive('');
    setByChannel({}); setChannels([]); setUsers([]); setMemberships([]); setLoading(false); setError('');
  };
  return { user, users, channels, memberships, activeId, messages: byChannel[activeId] ?? EMPTY_MESSAGES,
    loading, loadingChannel, syncing, error, setError, refresh, select, act, authenticate, signOut, setActive };
}
