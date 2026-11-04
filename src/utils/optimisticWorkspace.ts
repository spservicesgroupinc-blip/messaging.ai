import { enrichMessagesForChannel, executeSheetAction, toPublicUser, type EnrichedMessage, type GasRequestPayload, type GasResponse, type PublicUser, type SheetsDatabase } from './sheetsProtocol';

const MUTATIONS = new Set(['sendMessage', 'editMessage', 'deleteMessage', 'toggleReaction', 'createChannel', 'editChannel', 'deleteChannel', 'addChannelMember', 'removeChannelMember', 'openDirectMessage', 'updateUserStatus', 'createCalendarEvent', 'deleteCalendarEvent']);
export interface OptimisticAction {
  id: string;
  payload: GasRequestPayload;
  createdAt: string;
  status: 'pending' | 'failed';
  error?: string;
  channelId?: string;
}
export interface WorkspaceSnapshot {
  users: PublicUser[];
  channels: SheetsDatabase['Channels'];
  memberships: SheetsDatabase['ChannelMembers'];
  calendarEvents: SheetsDatabase['CalendarEvents'];
  byChannel: Record<string, EnrichedMessage[]>;
  failures: OptimisticAction[];
  pendingCount: number;
  backupFailed: boolean;
}
type BackupStorage = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
const TEXT_FIELDS = ['userId', 'channelId', 'targetUserId', 'email', 'content', 'messageId', 'parentMessageId', 'emoji', 'name', 'description', 'statusText', 'roleTitle', 'title', 'start_time', 'end_time', 'timezone', 'location', 'eventId'] as const;

// Only mutation fields enter local backups; credentials and arbitrary stored fields do not.
function mutationPayload(input: unknown): GasRequestPayload | null {
  if (!input || typeof input !== 'object') return null;
  const value = input as Record<string, unknown>;
  if (typeof value.action !== 'string' || !MUTATIONS.has(value.action)) return null;
  const payload: GasRequestPayload = { action: value.action as GasRequestPayload['action'] };
  for (const field of TEXT_FIELDS) {
    if (value[field] === undefined) continue;
    if (typeof value[field] !== 'string') return null;
    payload[field] = value[field];
  }
  if (value.isPrivate !== undefined) {
    if (typeof value.isPrivate !== 'boolean') return null;
    payload.isPrivate = value.isPrivate;
  }
  if (value.memberEmails !== undefined) {
    if (!Array.isArray(value.memberEmails) || !value.memberEmails.every(email => typeof email === 'string')) return null;
    payload.memberEmails = [...value.memberEmails];
  }
  if (value.attendee_emails !== undefined) {
    if (!Array.isArray(value.attendee_emails) || !value.attendee_emails.every(email => typeof email === 'string')) return null;
    payload.attendee_emails = [...value.attendee_emails];
  }
  return payload;
}

/** Confirmed data plus replayable local actions: an old response cannot erase newer intent. */
export class OptimisticWorkspace {
  private base: SheetsDatabase;
  private projected: SheetsDatabase;
  private operations: OptimisticAction[] = [];
  private aliases = new Map<string, string>();
  private loaded = new Set<string>();
  private listeners = new Set<() => void>();
  private snapshot!: WorkspaceSnapshot;
  private backupFailed = false;
  private key: string;

  constructor(private user: PublicUser | null, private storage?: BackupStorage) {
    this.base = { Users: user ? [{ ...user, password_hash: '' }] : [], Channels: [], ChannelMembers: [], Messages: [], CalendarEvents: [] };
    this.projected = this.base;
    this.key = 'relay_actions_v1:' + encodeURIComponent(user?.user_id ?? '');
    if (user) this.restore();
    this.publish();
  }
  subscribe = (listener: () => void) => { this.listeners.add(listener); return () => { this.listeners.delete(listener); }; };
  getSnapshot = () => this.snapshot;
  hasMessages = (id: string) => this.loaded.has(id) || this.isProvisional(id);
  isProvisional = (id: string) => id.startsWith('local_') && !this.aliases.has(id);
  resolve = (id: string) => this.aliases.get(id) ?? id;
  private local = (id: string) => [...this.aliases].find(([, server]) => server === id)?.[0] ?? id;

  private execute(db: SheetsDatabase, operation: OptimisticAction) {
    let index = 0;
    return executeSheetAction(db, operation.payload, operation.createdAt, prefix => `local_${operation.id}_${prefix}_${index++}`);
  }
  submit(payload: GasRequestPayload): { operation?: OptimisticAction; response: GasResponse } {
    const cleanPayload = mutationPayload(payload);
    if (!cleanPayload || cleanPayload.userId !== this.user?.user_id) return { response: { ok: false, error: 'This action must wait for the server.' } };
    if (payload.messageId && this.snapshot.byChannel[payload.channelId ?? '']?.some(message => message.message_id === payload.messageId && message.delivery)) {
      return { response: { ok: false, error: 'Wait until this message is confirmed before changing it.' } };
    }
    const operation: OptimisticAction = { id: crypto.randomUUID(), payload: cleanPayload, createdAt: new Date().toISOString(), status: 'pending' };
    const result = this.execute(this.projected, operation);
    if (!result.response.ok) return { response: result.response };
    operation.channelId = result.response.channel?.channel_id;
    this.operations.push(operation);
    this.persist(); this.publish();
    return { operation, response: result.response };
  }
  request(operation: OptimisticAction): GasRequestPayload {
    const payload = { ...operation.payload };
    if (['createChannel', 'openDirectMessage', 'updateUserStatus'].includes(payload.action)) delete payload.channelId;
    else if (payload.channelId) {
      if (this.isProvisional(payload.channelId)) throw Error('This conversation could not be created. Your message is kept below.');
      payload.channelId = this.resolve(payload.channelId);
    }
    return payload;
  }
  applyResponse(response: GasResponse, channelId?: string) {
    this.merge(response, channelId);
    this.publish();
  }
  private merge(response: GasResponse, channelId?: string) {
    if (response.users) this.base.Users = response.users.map(user => ({ ...user, password_hash: '' }));
    else if (response.user) this.base.Users = [...this.base.Users.filter(user => user.user_id !== response.user!.user_id), { ...response.user, password_hash: '' }];
    if (response.channels) this.base.Channels = response.channels.map(channel => ({ ...channel, channel_id: this.local(channel.channel_id) }));
    if (response.memberships) this.base.ChannelMembers = response.memberships.map(member => ({ ...member, channel_id: this.local(member.channel_id) }));
    const id = this.local(response.channel?.channel_id ?? channelId ?? '');
    if (response.channel && !this.base.Channels.some(channel => channel.channel_id === id)) this.base.Channels.push({ ...response.channel, channel_id: id });
    if (response.messages && id) {
      this.base.Messages = [...this.base.Messages.filter(message => message.channel_id !== id), ...response.messages.filter(message => this.local(message.channel_id) === id).map(({ delivery: _delivery, ...message }) => ({ ...message, channel_id: id }))];
      this.loaded.add(id);
    }
    if (response.calendarEvents) {
      this.base.CalendarEvents = response.calendarEvents.map(event => ({ ...event, channel_id: this.local(event.channel_id) }));
    }
    if (response.deletedEventId) {
      const deleted = this.local(response.deletedEventId);
      this.base.CalendarEvents = this.base.CalendarEvents.filter(event => event.event_id !== deleted);
    }
  }
  confirm(operation: OptimisticAction, response: GasResponse) {
    if (operation.channelId && response.channel && operation.channelId !== response.channel.channel_id) this.aliases.set(operation.channelId, response.channel.channel_id);
    this.merge(response, operation.payload.channelId);
    this.operations = this.operations.filter(item => item.id !== operation.id);
    this.persist(); this.publish();
  }
  fail(operation: OptimisticAction, error: string) {
    operation.status = 'failed'; operation.error = error;
    this.persist(); this.publish();
  }
  dismiss(id: string) {
    this.operations = this.operations.filter(item => item.id !== id);
    this.persist(); this.publish();
  }
  clear() {
    this.operations = []; this.aliases.clear();
    try { this.storage?.removeItem(this.key); } catch { /* Clear in-memory state even if storage is unavailable. */ }
    this.publish();
  }
  private publish() {
    let db = this.base;
    const deliveries = new Map<string, 'sending' | 'failed'>();
    for (const operation of this.operations) {
      if (operation.status === 'failed' && operation.payload.action !== 'sendMessage') continue;
      const result = this.execute(db, operation);
      if (!result.response.ok) continue;
      db = result.db;
      if (result.response.message) deliveries.set(result.response.message.message_id, operation.status === 'failed' ? 'failed' : 'sending');
    }
    this.projected = db;
    const byChannel: Record<string, EnrichedMessage[]> = {};
    for (const channel of db.Channels) {
      if (this.loaded.has(channel.channel_id) || db.Messages.some(message => message.channel_id === channel.channel_id)) {
        byChannel[channel.channel_id] = enrichMessagesForChannel(db.Messages, channel.channel_id)
          .map(message => ({ ...message, delivery: deliveries.get(message.message_id) }))
          // Server timestamps arrive later than submission times; queued sends stay last.
          .sort((a, b) => Number(Boolean(a.delivery)) - Number(Boolean(b.delivery)) || a.created_at.localeCompare(b.created_at));
      }
    }
    this.snapshot = { users: db.Users.map(toPublicUser), channels: db.Channels, memberships: db.ChannelMembers, calendarEvents: db.CalendarEvents, byChannel, failures: this.operations.filter(operation => operation.status === 'failed'), pendingCount: this.operations.filter(operation => operation.status === 'pending').length, backupFailed: this.backupFailed };
    this.listeners.forEach(listener => listener());
  }
  private persist() {
    if (!this.user) return;
    try {
      if (!this.storage) throw Error('Storage unavailable');
      if (this.operations.length || this.aliases.size) this.storage.setItem(this.key, JSON.stringify({ operations: this.operations, aliases: [...this.aliases] }));
      else this.storage.removeItem(this.key);
      this.backupFailed = false;
    } catch { this.backupFailed = true; }
  }
  private restore() {
    try {
      const saved = JSON.parse(this.storage?.getItem(this.key) ?? 'null');
      if (!saved) return;
      if (Array.isArray(saved.aliases)) this.aliases = new Map(saved.aliases.filter((pair: unknown) => Array.isArray(pair) && pair.length === 2 && pair.every(value => typeof value === 'string')));
      if (Array.isArray(saved.operations)) {
        for (const item of saved.operations) {
          if (!item || typeof item.id !== 'string' || typeof item.createdAt !== 'string' || !Number.isFinite(Date.parse(item.createdAt))) continue;
          const payload = mutationPayload(item.payload);
          if (!payload || payload.userId !== this.user?.user_id) continue;
          this.operations.push({ id: item.id, payload, createdAt: item.createdAt, status: 'failed', error: typeof item.error === 'string' ? item.error : 'The connection closed before confirmation. Check the conversation before sending again.' });
        }
      }
    } catch { this.backupFailed = true; }
  }
}
