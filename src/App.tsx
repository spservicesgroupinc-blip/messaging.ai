import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Check,
  Code,
  Edit3,
  Hash,
  Lock,
  LogOut,
  Menu,
  MessageSquare,
  Plus,
  RefreshCw,
  Search,
  Send,
  Trash2,
  Users,
  X,
} from 'lucide-react';
import { AuthView } from './components/AuthView';
import { ChannelMembersDrawer } from './components/ChannelMembersDrawer';
import { CreateChannelModal } from './components/CreateChannelModal';
import { ThreadDrawer } from './components/ThreadDrawer';
import {
  callSheetsBackend,
  getSavedActiveChannelId,
  getSavedSessionUser,
  saveActiveChannelId,
  saveSessionUser,
} from './services/gasClient';
import {
  formatDateHeader,
  formatTimeShort,
  getInitials,
  type EnrichedMessage,
  type GasResponse,
  type PublicUser,
  type SheetChannel,
  type SheetChannelMember,
} from './utils/sheetsProtocol';

const QUICK_EMOJIS = ['👍', '✅', '🚀', '🎯'];

export default function App() {
  const [currentUser, setCurrentUser] = useState<PublicUser | null>(() =>
    getSavedSessionUser()
  );
  const [workspaceUsers, setWorkspaceUsers] = useState<PublicUser[]>([]);
  const [channels, setChannels] = useState<SheetChannel[]>([]);
  const [memberships, setMemberships] = useState<SheetChannelMember[]>([]);
  const [activeChannelId, setActiveChannelId] = useState<string>(() =>
    getSavedActiveChannelId()
  );
  const [messages, setMessages] = useState<EnrichedMessage[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState<boolean>(Boolean(getSavedSessionUser()));
  const [loadingChannel, setLoadingChannel] = useState<boolean>(false);
  const [syncing, setSyncing] = useState<boolean>(false);

  // Composer state
  const [composerText, setComposerText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [composerError, setComposerError] = useState('');

  // Editing message state
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

  // Search & UI Drawers/Modals
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreateChannelOpen, setIsCreateChannelOpen] = useState(false);
  const [createChannelDefaultPrivate, setCreateChannelDefaultPrivate] = useState(false);
  const [isMembersDrawerOpen, setIsMembersDrawerOpen] = useState(false);
  const [activeThreadMessageId, setActiveThreadMessageId] = useState<string | null>(null);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement | null>(null);
  const activeChannelIdRef = useRef(activeChannelId);
  activeChannelIdRef.current = activeChannelId;

  const currentUserRef = useRef(currentUser);
  currentUserRef.current = currentUser;

  const syncWorkspace = useCallback(
    async (userId: string, explicitChannelId?: string, silent = false) => {
      if (!silent) setSyncing(true);
      const channelAtStart = explicitChannelId || activeChannelIdRef.current;
      try {
        const res = await callSheetsBackend({
          action: 'getBootstrap',
          userId,
          channelId: channelAtStart,
        });

        if (!res.ok || !res.user) {
          saveSessionUser(null);
          setCurrentUser(null);
          return;
        }

        setCurrentUser(res.user);
        saveSessionUser(res.user);
        setWorkspaceUsers(res.users || []);
        const nextChannels = res.channels || [];
        setChannels(nextChannels);
        setMemberships(res.memberships || []);

        const currentActiveNow = explicitChannelId || activeChannelIdRef.current;
        const resolvedChannelId =
          currentActiveNow &&
          nextChannels.some((c) => c.channel_id === currentActiveNow)
            ? currentActiveNow
            : nextChannels[0]?.channel_id || '';

        if (resolvedChannelId !== activeChannelIdRef.current) {
          activeChannelIdRef.current = resolvedChannelId;
          setActiveChannelId(resolvedChannelId);
          saveActiveChannelId(resolvedChannelId);
        }

        if (
          res.messages &&
          (!channelAtStart || channelAtStart === activeChannelIdRef.current)
        ) {
          setMessages(res.messages);
        }
      } catch (err) {
        console.error('Workspace sync error:', err);
      } finally {
        setLoadingWorkspace(false);
        if (!silent) setSyncing(false);
      }
    },
    []
  );

  // Initial session bootstrap
  useEffect(() => {
    const saved = getSavedSessionUser();
    if (saved) {
      void syncWorkspace(saved.user_id, getSavedActiveChannelId());
    } else {
      setLoadingWorkspace(false);
    }
  }, [syncWorkspace]);

  // Subscribe to Server-Sent Events (/api/events) + periodic background sync for real-time updates
  useEffect(() => {
    if (!currentUser) return;

    const eventSource = new EventSource('/api/events');
    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type && data.type !== 'connected' && currentUserRef.current) {
          void syncWorkspace(currentUserRef.current.user_id, undefined, true);
        }
      } catch {
        // ignore parse errors
      }
    };

    const interval = window.setInterval(() => {
      if (currentUserRef.current) {
        void syncWorkspace(currentUserRef.current.user_id, undefined, true);
      }
    }, 5000);

    return () => {
      eventSource.close();
      window.clearInterval(interval);
    };
  }, [currentUser, syncWorkspace]);

  const handleSelectChannel = async (channelId: string) => {
    if (!currentUser) return;
    activeChannelIdRef.current = channelId;
    setActiveChannelId(channelId);
    saveActiveChannelId(channelId);
    setActiveThreadMessageId(null);
    setMobileSidebarOpen(false);
    setLoadingChannel(true);
    try {
      const res = await callSheetsBackend({
        action: 'getMessages',
        userId: currentUser.user_id,
        channelId,
      });
      if (res.ok && res.messages) {
        setMessages(res.messages);
      }
    } finally {
      setLoadingChannel(false);
    }
  };

  const handleAuthenticated = (res: GasResponse) => {
    if (!res.user) return;
    setCurrentUser(res.user);
    saveSessionUser(res.user);
    setWorkspaceUsers(res.users || []);
    const nextChannels = res.channels || [];
    setChannels(nextChannels);
    setMemberships(res.memberships || []);
    const firstChannelId = nextChannels[0]?.channel_id || '';
    activeChannelIdRef.current = firstChannelId;
    setActiveChannelId(firstChannelId);
    saveActiveChannelId(firstChannelId);
    if (firstChannelId) {
      void syncWorkspace(res.user.user_id, firstChannelId);
    }
  };

  const handleSignOut = () => {
    saveSessionUser(null);
    setCurrentUser(null);
    setMessages([]);
    setActiveThreadMessageId(null);
    setIsMembersDrawerOpen(false);
  };

  const handleSendMessage = async (e?: React.FormEvent) => {
    e?.preventDefault();
    if (!currentUser || !activeChannelId) return;
    const content = composerText.trim();
    if (!content || sendingMessage) return;

    setComposerError('');
    setSendingMessage(true);
    try {
      const res = await callSheetsBackend({
        action: 'sendMessage',
        userId: currentUser.user_id,
        channelId: activeChannelId,
        content,
      });

      if (!res.ok) {
        setComposerError(res.error || 'Failed to send message.');
        return;
      }

      setComposerText('');
      if (res.messages) {
        setMessages(res.messages);
      }
      setTimeout(() => {
        messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
      }, 40);
    } finally {
      setSendingMessage(false);
    }
  };

  const handleSendThreadReply = async (content: string, parentMessageId: string) => {
    if (!currentUser || !activeChannelId) return;
    const res = await callSheetsBackend({
      action: 'sendMessage',
      userId: currentUser.user_id,
      channelId: activeChannelId,
      parentMessageId,
      content,
    });
    if (res.ok && res.messages) {
      setMessages(res.messages);
    }
  };

  const handleSaveEditedMessage = async (messageId: string) => {
    if (!currentUser || !editingContent.trim()) return;
    const res = await callSheetsBackend({
      action: 'editMessage',
      userId: currentUser.user_id,
      messageId,
      content: editingContent.trim(),
    });
    if (res.ok && res.messages) {
      setMessages(res.messages);
      setEditingMessageId(null);
      setEditingContent('');
    }
  };

  const handleDeleteMessage = async (messageId: string) => {
    if (!currentUser) return;
    const res = await callSheetsBackend({
      action: 'deleteMessage',
      userId: currentUser.user_id,
      messageId,
    });
    if (res.ok && res.messages) {
      setMessages(res.messages);
      if (activeThreadMessageId === messageId) {
        setActiveThreadMessageId(null);
      }
    }
  };

  const handleToggleReaction = async (messageId: string, emoji: string) => {
    if (!currentUser) return;
    const res = await callSheetsBackend({
      action: 'toggleReaction',
      userId: currentUser.user_id,
      messageId,
      emoji,
    });
    if (res.ok && res.messages) {
      setMessages(res.messages);
    }
  };

  const handleCreateChannel = async (params: {
    name: string;
    description: string;
    isPrivate: boolean;
    memberEmails: string[];
  }) => {
    if (!currentUser) return { ok: false, error: 'Not signed in' };
    const res = await callSheetsBackend({
      action: 'createChannel',
      userId: currentUser.user_id,
      name: params.name,
      description: params.description,
      isPrivate: params.isPrivate,
      memberEmails: params.memberEmails,
    });

    if (res.ok && res.channel) {
      activeChannelIdRef.current = res.channel.channel_id;
      setActiveChannelId(res.channel.channel_id);
      saveActiveChannelId(res.channel.channel_id);
      if (res.channels) setChannels(res.channels);
      if (res.memberships) setMemberships(res.memberships);
      setMessages([]);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleOpenDirectMessage = async (targetUserId: string) => {
    if (!currentUser) return;
    setMobileSidebarOpen(false);
    const res = await callSheetsBackend({
      action: 'openDirectMessage',
      userId: currentUser.user_id,
      targetUserId,
    });
    if (res.ok && res.channel) {
      activeChannelIdRef.current = res.channel.channel_id;
      setActiveChannelId(res.channel.channel_id);
      saveActiveChannelId(res.channel.channel_id);
      if (res.channels) setChannels(res.channels);
      if (res.memberships) setMemberships(res.memberships);
      setMessages(res.messages || []);
    }
  };

  const handleAddMemberToActiveChannel = async (email: string) => {
    if (!currentUser || !activeChannelId) return { ok: false, error: 'Invalid state' };
    const res = await callSheetsBackend({
      action: 'addChannelMember',
      userId: currentUser.user_id,
      channelId: activeChannelId,
      email,
    });
    if (res.ok) {
      if (res.memberships) setMemberships(res.memberships);
      if (res.channels) setChannels(res.channels);
      return { ok: true };
    }
    return { ok: false, error: res.error };
  };

  const handleRemoveMemberFromActiveChannel = async (targetUserId: string) => {
    if (!currentUser || !activeChannelId) return;
    const res = await callSheetsBackend({
      action: 'removeChannelMember',
      userId: currentUser.user_id,
      channelId: activeChannelId,
      targetUserId,
    });
    if (res.ok) {
      if (res.memberships) setMemberships(res.memberships);
      if (res.channels) setChannels(res.channels);
    }
  };

  const insertFormatSnippet = (prefix: string, suffix = prefix) => {
    setComposerText((prev) => `${prev}${prefix}text${suffix}`);
  };

  const publicChannels = useMemo(
    () => channels.filter((c) => !c.is_private && !c.dm_participants),
    [channels]
  );

  const privateChannels = useMemo(
    () => channels.filter((c) => c.is_private && !c.dm_participants),
    [channels]
  );

  const activeChannel = useMemo(
    () => channels.find((c) => c.channel_id === activeChannelId) || channels[0],
    [channels, activeChannelId]
  );

  const getChannelDisplayName = useCallback(
    (channel?: SheetChannel): string => {
      if (!channel) return 'general';
      if (channel.dm_participants && currentUser) {
        const ids = channel.dm_participants.split(',').map((s) => s.trim());
        const partnerId = ids.find((id) => id !== currentUser.user_id) || currentUser.user_id;
        const partner = workspaceUsers.find((u) => u.user_id === partnerId);
        return partner ? partner.full_name : 'Direct Message';
      }
      return channel.name;
    },
    [currentUser, workspaceUsers]
  );

  const rootMessages = useMemo(() => {
    const roots = messages.filter((m) => !m.parent_message_id);
    const q = searchQuery.trim().toLowerCase();
    if (!q) return roots;
    return roots.filter(
      (m) =>
        m.content.toLowerCase().includes(q) ||
        m.user_name.toLowerCase().includes(q)
    );
  }, [messages, searchQuery]);

  const activeThreadRootMessage = useMemo(
    () =>
      activeThreadMessageId
        ? messages.find((m) => m.message_id === activeThreadMessageId) || null
        : null,
    [messages, activeThreadMessageId]
  );

  const activeChannelMemberCount = useMemo(() => {
    if (!activeChannel) return 0;
    if (!activeChannel.is_private) return workspaceUsers.length;
    const ids = new Set(
      memberships
        .filter((m) => m.channel_id === activeChannel.channel_id)
        .map((m) => m.user_id)
    );
    if (activeChannel.created_by && activeChannel.created_by !== 'system') {
      ids.add(activeChannel.created_by);
    }
    return ids.size;
  }, [activeChannel, memberships, workspaceUsers]);

  if (loadingWorkspace) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50 text-slate-600">
        <div className="flex items-center gap-3 text-sm font-medium">
          <RefreshCw className="h-4 w-4 animate-spin text-blue-600" />
          <span>Loading Relay Workspace...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-white text-slate-900">
      {/* Mobile Sidebar Backdrop */}
      {mobileSidebarOpen && (
        <div
          className="fixed inset-0 z-30 bg-slate-950/50 lg:hidden"
          onClick={() => setMobileSidebarOpen(false)}
        />
      )}

      {/* Workspace Navigation Sidebar */}
      <aside
        aria-label="Workspace navigation"
        className={`fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform lg:static lg:translate-x-0 ${
          mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        {/* Workspace Header */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3.5">
          <div className="min-w-0">
            <div className="truncate text-sm font-bold tracking-tight text-white">
              Relay Workspace
            </div>
            <div className="truncate text-xs text-slate-400">
              {currentUser.role_title || 'Team Member'}
            </div>
          </div>
        </div>

        {/* Channels & Direct Messages Scroll Area */}
        <div className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
          {/* Public Channels */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="text-xs font-semibold text-slate-400">Channels</span>
              <button
                type="button"
                onClick={() => {
                  setCreateChannelDefaultPrivate(false);
                  setIsCreateChannelOpen(true);
                }}
                aria-label="Create new channel"
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            <div className="space-y-0.5">
              {publicChannels.map((ch) => {
                const isActive = activeChannel?.channel_id === ch.channel_id;
                return (
                  <button
                    key={ch.channel_id}
                    type="button"
                    onClick={() => handleSelectChannel(ch.channel_id)}
                    className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <Hash className="h-3.5 w-3.5 shrink-0 opacity-80" />
                    <span className="truncate">{ch.name}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Private Channels */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="text-xs font-semibold text-slate-400">Private Channels</span>
              <button
                type="button"
                onClick={() => {
                  setCreateChannelDefaultPrivate(true);
                  setIsCreateChannelOpen(true);
                }}
                aria-label="Create private channel"
                className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
            {privateChannels.length === 0 ? (
              <button
                type="button"
                onClick={() => {
                  setCreateChannelDefaultPrivate(true);
                  setIsCreateChannelOpen(true);
                }}
                className="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200"
              >
                <Lock className="h-3.5 w-3.5 shrink-0 opacity-70" />
                <span>Add private channel...</span>
              </button>
            ) : (
              <div className="space-y-0.5">
                {privateChannels.map((ch) => {
                  const isActive = activeChannel?.channel_id === ch.channel_id;
                  return (
                    <button
                      key={ch.channel_id}
                      type="button"
                      onClick={() => handleSelectChannel(ch.channel_id)}
                      className={`flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                        isActive
                          ? 'bg-blue-600 text-white'
                          : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                      }`}
                    >
                      <Lock className="h-3.5 w-3.5 shrink-0 opacity-80" />
                      <span className="truncate">{ch.name}</span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Direct Messages */}
          <div>
            <div className="flex items-center justify-between px-2 pb-1.5">
              <span className="text-xs font-semibold text-slate-400">Direct Messages</span>
              <span className="font-mono text-xs tabular-nums text-slate-500">
                {workspaceUsers.length}
              </span>
            </div>
            <div className="space-y-0.5">
              {workspaceUsers.map((u) => {
                const sortedPair = [currentUser.user_id, u.user_id].sort().join(',');
                const isActiveDm = activeChannel?.dm_participants === sortedPair;
                return (
                  <button
                    key={u.user_id}
                    type="button"
                    onClick={() => handleOpenDirectMessage(u.user_id)}
                    className={`flex w-full items-center justify-between gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors ${
                      isActiveDm
                        ? 'bg-blue-600 text-white'
                        : 'text-slate-300 hover:bg-slate-800/80 hover:text-white'
                    }`}
                  >
                    <div className="flex min-w-0 items-center gap-2">
                      <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded bg-slate-700 text-[10px] font-semibold text-white">
                        {getInitials(u.full_name)}
                      </div>
                      <span className="truncate">
                        {u.full_name}
                        {u.user_id === currentUser.user_id ? ' (you)' : ''}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Current User Profile Bar */}
        <div className="border-t border-slate-800 bg-slate-950/50 p-3">
          <div className="flex items-center justify-between gap-2">
            <div className="flex min-w-0 items-center gap-2.5">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-xs font-bold text-white">
                {getInitials(currentUser.full_name)}
              </div>
              <div className="min-w-0">
                <div className="truncate text-xs font-semibold text-white">
                  {currentUser.full_name}
                </div>
                <div className="truncate text-[11px] text-slate-400">
                  {currentUser.email}
                </div>
              </div>
            </div>
            <button
              type="button"
              onClick={handleSignOut}
              aria-label="Sign out"
              title="Sign out"
              className="rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex min-w-0 flex-1 flex-col">
        {/* Top Channel Header */}
        <header className="flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6">
          {/* Left: Channel Breadcrumb & Metadata */}
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileSidebarOpen(true)}
              aria-label="Open navigation sidebar"
              className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="min-w-0">
              <div className="flex items-center gap-1.5">
                {activeChannel?.dm_participants ? (
                  <Users className="h-4 w-4 shrink-0 text-slate-600" />
                ) : activeChannel?.is_private ? (
                  <Lock className="h-4 w-4 shrink-0 text-slate-700" />
                ) : (
                  <Hash className="h-4 w-4 shrink-0 text-slate-600" />
                )}
                <h1 className="truncate text-sm font-bold text-slate-900">
                  {getChannelDisplayName(activeChannel)}
                </h1>
                <span aria-hidden="true" className="text-slate-300">
                  &middot;
                </span>
                <span className="font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap shrink-0">
                  {activeChannelMemberCount}{' '}
                  {activeChannelMemberCount === 1 ? 'member' : 'members'}
                </span>
              </div>
              {activeChannel?.description && (
                <p className="hidden truncate text-xs text-slate-500 sm:block">
                  {activeChannel.description}
                </p>
              )}
            </div>
          </div>

          {/* Center: Search Messages */}
          <div className="relative hidden w-64 md:block">
            <Search className="pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400" />
            <input
              type="search"
              aria-label="Search channel messages"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Filter messages..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none"
            />
          </div>

          {/* Right: Actions */}
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => syncWorkspace(currentUser.user_id, activeChannelId)}
              aria-label="Refresh messages"
              className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${syncing ? 'animate-spin text-blue-600' : ''}`} />
              <span className="hidden sm:inline">Refresh</span>
            </button>

            <button
              type="button"
              onClick={() => setIsMembersDrawerOpen((prev) => !prev)}
              className={`flex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
                isMembersDrawerOpen
                  ? 'border-blue-600 bg-blue-50 text-blue-700'
                  : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
              }`}
            >
              <Users className="h-3.5 w-3.5" />
              <span>Members</span>
            </button>
          </div>
        </header>

        {/* Body Split: Message Stream + Optional Right Drawer */}
        <div className="flex min-h-0 flex-1 overflow-hidden">
          <main className="flex min-w-0 flex-1 flex-col bg-white">
            {/* Message Stream */}
            <div className="flex-1 overflow-y-auto px-4 py-6 sm:px-6">
              {loadingChannel ? (
                <div className="space-y-4 py-8">
                  {[1, 2, 3].map((n) => (
                    <div key={n} className="flex animate-pulse items-start gap-3">
                      <div className="h-9 w-9 rounded-lg bg-slate-200" />
                      <div className="flex-1 space-y-2">
                        <div className="h-3 w-36 rounded bg-slate-200" />
                        <div className="h-4 w-2/3 rounded bg-slate-100" />
                      </div>
                    </div>
                  ))}
                </div>
              ) : rootMessages.length === 0 ? (
                <div className="mx-auto my-12 max-w-md rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-center">
                  <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white">
                    {activeChannel?.is_private ? (
                      <Lock className="h-5 w-5" />
                    ) : (
                      <Hash className="h-5 w-5" />
                    )}
                  </div>
                  <h2 className="mt-3 text-base font-bold text-slate-900">
                    {searchQuery
                      ? 'No messages match your filter'
                      : `Welcome to ${
                          activeChannel?.dm_participants
                            ? getChannelDisplayName(activeChannel)
                            : `#${getChannelDisplayName(activeChannel)}`
                        }`}
                  </h2>
                  <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
                    {searchQuery
                      ? 'Try clearing the search filter in the top bar.'
                      : activeChannel?.is_private
                      ? 'This is the start of a private channel. Only invited members can view and post messages here.'
                      : 'This is the beginning of the channel. Type a message below to start the conversation.'}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  {rootMessages.map((msg, index) => {
                    const prevMsg = index > 0 ? rootMessages[index - 1] : null;
                    const currentDay = formatDateHeader(msg.created_at);
                    const prevDay = prevMsg ? formatDateHeader(prevMsg.created_at) : '';
                    const showDateHeader = currentDay !== prevDay;
                    const isOwn = msg.user_id === currentUser.user_id;
                    const isEditing = editingMessageId === msg.message_id;
                    const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;

                    return (
                      <React.Fragment key={msg.message_id}>
                        {showDateHeader && (
                          <div className="relative flex items-center py-2">
                            <div className="flex-grow border-t border-slate-200" />
                            <span className="mx-4 shrink-0 text-xs font-medium text-slate-500">
                              {currentDay}
                            </span>
                            <div className="flex-grow border-t border-slate-200" />
                          </div>
                        )}

                        <article className="group flex items-start gap-3.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50">
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white">
                            {getInitials(msg.user_name)}
                          </div>

                          <div className="min-w-0 flex-1">
                            {/* Metadata Header (Clean unboxed text with separators) */}
                            <div className="flex flex-wrap items-baseline gap-1.5 text-xs">
                              <span className="font-bold text-slate-900">{msg.user_name}</span>
                              {msg.user_role && (
                                <>
                                  <span aria-hidden="true" className="text-slate-400">
                                    &middot;
                                  </span>
                                  <span className="text-slate-500">{msg.user_role}</span>
                                </>
                              )}
                              <span aria-hidden="true" className="text-slate-400">
                                &middot;
                              </span>
                              <time
                                dateTime={msg.created_at}
                                className="font-mono tabular-nums text-slate-500"
                              >
                                {formatTimeShort(msg.created_at)}
                              </time>
                              {isEdited && (
                                <span className="text-slate-400">(edited)</span>
                              )}
                            </div>

                            {/* Message Body or Edit Mode */}
                            {isEditing ? (
                              <div className="mt-2 space-y-2">
                                <textarea
                                  rows={2}
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none"
                                />
                                <div className="flex items-center gap-2">
                                  <button
                                    type="button"
                                    onClick={() => handleSaveEditedMessage(msg.message_id)}
                                    className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700"
                                  >
                                    <Check className="h-3.5 w-3.5" />
                                    Save Changes
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(null);
                                      setEditingContent('');
                                    }}
                                    className="flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50"
                                  >
                                    <X className="h-3.5 w-3.5" />
                                    Cancel
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                                {msg.content}
                              </p>
                            )}

                            {/* Reactions & Thread Reply Controls */}
                            <div className="mt-2 flex flex-wrap items-center gap-2">
                              {Object.entries(msg.reactions || {}).map(([emoji, userIds]) => {
                                const hasReacted = userIds.includes(currentUser.user_id);
                                return (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.message_id, emoji)}
                                    className={`flex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors tabular-nums ${
                                      hasReacted
                                        ? 'border-blue-300 bg-blue-50 text-blue-800'
                                        : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                                    }`}
                                  >
                                    <span>{emoji}</span>
                                    <span className="font-mono">{userIds.length}</span>
                                  </button>
                                );
                              })}

                              <button
                                type="button"
                                onClick={() => setActiveThreadMessageId(msg.message_id)}
                                aria-label={`Reply in thread to "${msg.content.slice(0, 24)}"`}
                                className="flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 tabular-nums"
                              >
                                <MessageSquare className="h-3.5 w-3.5" />
                                <span>
                                  {msg.reply_count > 0
                                    ? `${msg.reply_count} ${
                                        msg.reply_count === 1 ? 'reply' : 'replies'
                                      }`
                                    : 'Reply in thread'}
                                </span>
                              </button>

                              {/* Quick emoji bar */}
                              <div className="flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100">
                                {QUICK_EMOJIS.map((emoji) => (
                                  <button
                                    key={emoji}
                                    type="button"
                                    onClick={() => handleToggleReaction(msg.message_id, emoji)}
                                    aria-label={`React with ${emoji}`}
                                    className="rounded px-1.5 py-0.5 text-xs hover:bg-slate-200/70"
                                  >
                                    {emoji}
                                  </button>
                                ))}
                              </div>

                              {/* Author Edit/Delete actions */}
                              {isOwn && !isEditing && (
                                <div className="flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingMessageId(msg.message_id);
                                      setEditingContent(msg.content);
                                    }}
                                    aria-label={`Edit message "${msg.content.slice(0, 20)}"`}
                                    className="rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700"
                                  >
                                    <Edit3 className="h-3.5 w-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteMessage(msg.message_id)}
                                    aria-label={`Delete message "${msg.content.slice(0, 20)}"`}
                                    className="rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                                  >
                                    <Trash2 className="h-3.5 w-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        </article>
                      </React.Fragment>
                    );
                  })}
                  <div ref={messagesEndRef} />
                </div>
              )}
            </div>

            {/* Message Composer Footer */}
            <div className="border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6">
              {composerError && (
                <div
                  role="alert"
                  className="mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800"
                >
                  {composerError}
                </div>
              )}

              <form
                onSubmit={handleSendMessage}
                className="overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-600"
              >
                {/* Formatting Helper Bar */}
                <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5">
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => insertFormatSnippet('`')}
                      aria-label="Insert inline code"
                      className="flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900"
                    >
                      <Code className="h-3.5 w-3.5" />
                      <span>Code</span>
                    </button>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Press <kbd className="font-mono font-semibold">Enter</kbd> to send
                  </div>
                </div>

                <div className="flex items-end gap-2 p-2.5">
                  <textarea
                    rows={2}
                    aria-label="Message input"
                    value={composerText}
                    onChange={(e) => setComposerText(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault();
                        void handleSendMessage();
                      }
                    }}
                    placeholder={`Message ${
                      activeChannel?.dm_participants
                        ? getChannelDisplayName(activeChannel)
                        : `#${getChannelDisplayName(activeChannel)}`
                    }`}
                    className="max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none"
                  />
                  <button
                    type="submit"
                    disabled={!composerText.trim() || sendingMessage}
                    aria-label="Send message"
                    className="flex items-center gap-1.5 rounded-lg bg-blue-600 px-4 py-2 text-xs font-semibold text-white transition-colors hover:bg-blue-700 disabled:opacity-40 whitespace-nowrap shrink-0"
                  >
                    <span>Send</span>
                    <Send className="h-3.5 w-3.5" />
                  </button>
                </div>
              </form>
            </div>
          </main>

          {/* Conditional Right Panel: Thread Drawer or Channel Access Drawer */}
          {activeThreadRootMessage && (
            <ThreadDrawer
              rootMessage={activeThreadRootMessage}
              allMessages={messages}
              channelDisplayName={
                activeChannel?.dm_participants
                  ? getChannelDisplayName(activeChannel)
                  : `#${getChannelDisplayName(activeChannel)}`
              }
              onClose={() => setActiveThreadMessageId(null)}
              onSendReply={handleSendThreadReply}
            />
          )}

          {!activeThreadRootMessage && isMembersDrawerOpen && activeChannel && (
            <ChannelMembersDrawer
              channel={activeChannel}
              memberships={memberships}
              workspaceUsers={workspaceUsers}
              currentUserId={currentUser.user_id}
              onClose={() => setIsMembersDrawerOpen(false)}
              onAddMember={handleAddMemberToActiveChannel}
              onRemoveMember={handleRemoveMemberFromActiveChannel}
            />
          )}
        </div>
      </div>

      {/* Modals */}
      <CreateChannelModal
        isOpen={isCreateChannelOpen}
        defaultPrivate={createChannelDefaultPrivate}
        onClose={() => setIsCreateChannelOpen(false)}
        workspaceUsers={workspaceUsers}
        currentUserId={currentUser.user_id}
        onCreateChannel={handleCreateChannel}
      />
    </div>
  );
}
