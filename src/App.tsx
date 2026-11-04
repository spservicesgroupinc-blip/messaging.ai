import { useCallback, useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AuthView } from './components/AuthView';
import { ChannelMembersDrawer } from './components/ChannelMembersDrawer';
import { CreateChannelModal } from './components/CreateChannelModal';
import { CreateCalendarEventModal } from './components/CreateCalendarEventModal';
import { EditChannelModal } from './components/EditChannelModal';
import { ThreadDrawer } from './components/ThreadDrawer';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { Conversation } from './components/Conversation';
import { CalendarView } from './components/CalendarView';
import { MobileDirectory, MobileTabBar } from './components/MobileNavigation';
import { WorkspaceShell } from './components/WorkspaceShell';
import { ErrorBoundary } from './components/ErrorBoundary';
import { BackgroundChanges } from './components/BackgroundChanges';
import { useWorkspace } from './hooks/useWorkspace';
import { useKeyboardVisible, useMobile, useOnline } from './hooks/useDeviceState';
import { useMobileNavigation } from './hooks/useMobileNavigation';
import { useAnyModal } from './hooks/useModal';
import type { SheetChannel, SheetCalendarEvent, PublicUser } from './utils/sheetsProtocol';

type Overlay = { kind: 'members' } | { kind: 'thread'; id: string } | { kind: 'create'; isPrivate: boolean } | { kind: 'edit' | 'delete'; channel: SheetChannel } | { kind: 'calendar' } | null;
function AppContent() {
  const w = useWorkspace();
  const mobile = useMobile();
  const online = useOnline();
  const keyboard = useKeyboardVisible();
  const anyModal = useAnyModal();
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [query, setQuery] = useState('');
  const closeOverlay = useCallback(() => setOverlay(null), []);
  const [calendarEvents, setCalendarEvents] = useState<SheetCalendarEvent[]>([]);
  const onHistoryConversation = useCallback((id: string) => { void w.select(id); setQuery(''); }, [w.select]);
  const nav = useMobileNavigation(onHistoryConversation, closeOverlay);
  const active = w.channels.find(channel => channel.channel_id === w.activeId);
  const publicChannels = w.channels.filter(channel => !channel.is_private && !channel.dm_participants);
  const privateChannels = w.channels.filter(channel => channel.is_private && !channel.dm_participants);
  const dmChannels = w.channels.filter(channel => Boolean(channel.dm_participants));
  useEffect(() => { if (!w.user) { closeOverlay(); } }, [w.user?.user_id, closeOverlay]);
  const displayName = (channel?: SheetChannel) => {
    if (!channel) return 'Conversation';
    if (!channel.dm_participants) return channel.name;
    const partnerId = channel.dm_participants.split(',').find(id => id !== w.user?.user_id) ?? w.user?.user_id;
    const partner = w.users.find(user => user.user_id === partnerId);
    return partnerId === w.user?.user_id ? 'Saved messages' : partner?.full_name ?? 'Direct message';
  };
  const showOverlay = (next: Exclude<Overlay, null>) => {
    if (mobile && !history.state?.relayOverlay) history.pushState({ ...history.state, relayOverlay: true }, '');
    setOverlay(next);
  };
  const dismissOverlay = () => {
    closeOverlay();
    if (mobile && history.state?.relayOverlay) history.back();
  };
  const choose = async (channel: SheetChannel) => {
    closeOverlay(); setQuery(''); void w.select(channel.channel_id);
    const res = await w.act({ action: 'getCalendarEvents', channelId: channel.channel_id });
    if (res.ok && res.calendarEvents) setCalendarEvents(res.calendarEvents);
    if (mobile) nav.open(channel.channel_id, channel.dm_participants ? 'dms' : 'channels');
  };
  const openPerson = async (id: string) => {
    const result = await w.act({ action: 'openDirectMessage', channelId: '', targetUserId: id });
    if (result.ok && result.channel) {
      w.setActive(result.channel.channel_id); setQuery(''); closeOverlay();
      if (mobile) nav.open(result.channel.channel_id, 'dms');
    } else w.setError(result.error ?? 'Unable to open a direct message.');
  };
  const signOut = () => { closeOverlay(); nav.reset(); setQuery(''); w.signOut(); };
  const create = async (params: { name: string; description: string; isPrivate: boolean; memberEmails: string[] }) => {
    const result = await w.act({ action: 'createChannel', ...params });
    if (result.ok && result.channel) {
      w.setActive(result.channel.channel_id); setQuery('');
      if (mobile) nav.open(result.channel.channel_id, 'channels');
    }
    return result;
  };
  const remove = async (channelId: string) => {
    const result = await w.act({ action: 'deleteChannel', channelId });
    if (result.ok && w.activeId === channelId) {
      const fallback = result.channels?.[0];
      if (fallback) choose(fallback); else { w.setActive(''); if (mobile) nav.showTab('channels'); }
    }
    return result;
  };
  const createCalendarEvent = async (params: {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    timezone: string;
    location: string;
    attendee_emails: string[];
  }) => {
    const result = await w.act({ action: 'createCalendarEvent', channelId: active?.channel_id, ...params });
    if (result.ok && result.calendarEvents) {
      setCalendarEvents(result.calendarEvents);
    }
    return result;
  };
  const deleteCalendarEvent = async (eventId: string) => {
    const result = await w.act({ action: 'deleteCalendarEvent', eventId });
    if (result.ok && result.calendarEvents) {
      setCalendarEvents(result.calendarEvents);
    }
    return result;
  };
  const membershipIds = new Set(w.memberships.filter(member => member.channel_id === active?.channel_id).map(member => member.user_id));
  if (active?.created_by && active.created_by !== 'system') membershipIds.add(active.created_by);
  const memberCount = active?.is_private ? membershipIds.size : w.users.length;
  const root = overlay?.kind === 'thread' ? w.messages.find(message => message.message_id === overlay.id) : null;
  const showConversation = !mobile || Boolean(nav.conversation);

  if (w.loading) return <div role="status" className="flex min-h-dvh items-center justify-center gap-3 bg-slate-50 text-slate-600"><RefreshCw className="animate-spin" size={18} />Loading Relay Workspace…</div>;
  if (!w.user) return <AuthView onAuthenticated={w.authenticate} />;
  return <WorkspaceShell currentUser={w.user} isDirectMessage={Boolean(active?.dm_participants)}
    onHome={() => { if (publicChannels[0]) choose(publicChannels[0]); }}
    onDirectMessages={() => { if (dmChannels[0]) choose(dmChannels[0]); else if (w.users.find(user => user.user_id !== w.user!.user_id)) void openPerson(w.users.find(user => user.user_id !== w.user!.user_id)!.user_id); }}
    onMembers={() => showOverlay({ kind: 'members' })} onCreateChannel={() => showOverlay({ kind: 'create', isPrivate: false })}>
    <Sidebar currentUser={w.user} workspaceUsers={w.users} publicChannels={publicChannels} privateChannels={privateChannels} directMessageChannels={dmChannels} activeChannelId={w.activeId}
      onSelectChannel={id => { const channel = w.channels.find(item => item.channel_id === id); if (channel) choose(channel); }} onOpenDirectMessage={id => void openPerson(id)}
      onCreateChannel={isPrivate => showOverlay({ kind: 'create', isPrivate })} onEditChannel={channel => showOverlay({ kind: 'edit', channel })} onDeleteChannel={channel => showOverlay({ kind: 'delete', channel })}
      onManageChannelMembers={channel => { choose(channel); showOverlay({ kind: 'members' }); }} onSignOut={signOut} />
    <div className="flex min-h-0 min-w-0 flex-1 flex-col">
      <BackgroundChanges failures={w.failures} pendingCount={w.pendingCount} backupFailed={w.backupFailed} onDismiss={w.dismissFailure} onRestore={id => {
        const restored = w.restoreDraft(id);
        const channel = w.channels.find(item => item.channel_id === restored?.channelId);
        if (channel) choose(channel);
        if (restored?.parentMessageId) showOverlay({ kind: 'thread', id: restored.parentMessageId });
      }} />
      {(!online || w.error) && <div role={w.error ? 'alert' : 'status'} className="flex shrink-0 items-center justify-between gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950"><span>{!online ? 'Offline — your drafts stay on this device.' : w.error}</span>{online && <button onClick={() => void w.refresh()} className="touch-target shrink-0 rounded px-2 font-semibold">Retry</button>}</div>}
      {mobile && !showConversation ? <MobileDirectory key={nav.tab} tab={nav.tab} user={w.user} users={w.users} channels={w.channels} onSelect={choose} onPerson={id => void openPerson(id)} onCreate={isPrivate => showOverlay({ kind: 'create', isPrivate })}
        onEdit={channel => showOverlay({ kind: 'edit', channel })} onDelete={channel => showOverlay({ kind: 'delete', channel })} onMembers={channel => { choose(channel); showOverlay({ kind: 'members' }); }} onSignOut={signOut} onPeople={() => nav.showTab('people')} /> : <>
        <Header key={w.activeId} activeChannel={active ?? null} channelDisplayName={displayName(active)} memberCount={memberCount} searchQuery={query} onSearchChange={setQuery} onRefresh={() => void w.refresh()} syncing={w.syncing}
          isMembersDrawerOpen={overlay?.kind === 'members'} onToggleMembers={() => overlay?.kind === 'members' ? dismissOverlay() : showOverlay({ kind: 'members' })}
          onToggleCalendar={() => overlay?.kind === 'calendar' ? dismissOverlay() : showOverlay({ kind: 'calendar' })}
          isCalendarOpen={overlay?.kind === 'calendar'} onBack={nav.back} />
        <div className="flex min-h-0 flex-1 overflow-hidden">
          {active ? <Conversation key={w.user.user_id + ':' + active.channel_id} workspace={w} channel={active} searchQuery={query} onThread={id => showOverlay({ kind: 'thread', id })} /> : <main id="conversation" className="flex-1 p-6"><h1 className="text-xl font-semibold">Choose a conversation</h1><p className="mt-2 text-slate-600">Select or create a channel to get started.</p></main>}
          {overlay?.kind === 'thread' && root && <ThreadDrawer key={root.message_id} rootMessage={root} allMessages={w.messages} channelDisplayName={displayName(active)} currentUserId={w.user.user_id} onClose={dismissOverlay} onSendReply={(content, parentMessageId) => w.act({ action: 'sendMessage', channelId: root.channel_id, content, parentMessageId })} />}
          {overlay?.kind === 'members' && active && <ChannelMembersDrawer channel={active} memberships={w.memberships} workspaceUsers={w.users} currentUserId={w.user.user_id} onClose={dismissOverlay}
            onAddMember={email => w.act({ action: 'addChannelMember', channelId: active.channel_id, email })} onRemoveMember={targetUserId => w.act({ action: 'removeChannelMember', channelId: active.channel_id, targetUserId })} />}
          {overlay?.kind === 'calendar' && active && <CalendarView channelId={active.channel_id} currentUser={w.user} workspaceUsers={w.users} events={calendarEvents}
            onCreateEvent={createCalendarEvent} onDeleteEvent={deleteCalendarEvent} />}
        </div>
      </>}
      {mobile && !keyboard && !overlay && !anyModal && <MobileTabBar tab={nav.tab} onChange={nav.showTab} />}
    </div>
    <CreateChannelModal isOpen={overlay?.kind === 'create'} defaultPrivate={overlay?.kind === 'create' ? overlay.isPrivate : false} onClose={dismissOverlay} workspaceUsers={w.users} currentUserId={w.user.user_id} onCreateChannel={create} />
    <EditChannelModal channel={overlay?.kind === 'edit' || overlay?.kind === 'delete' ? overlay.channel : null} mode={overlay?.kind === 'delete' ? 'delete' : 'edit'} onClose={dismissOverlay} onEditChannel={params => w.act({ action: 'editChannel', ...params })} onDeleteChannel={remove} />
    <CreateCalendarEventModal isOpen={overlay?.kind === 'calendar'} channelId={active?.channel_id ?? ''} currentUser={w.user} workspaceUsers={w.users} onClose={dismissOverlay} onCreateEvent={createCalendarEvent} />
  </WorkspaceShell>;
}
export default function App() { return <ErrorBoundary><AppContent /></ErrorBoundary>; }
