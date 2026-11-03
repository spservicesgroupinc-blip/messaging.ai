import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { AuthView } from './components/AuthView';
import { ChannelMembersDrawer } from './components/ChannelMembersDrawer';
import { CreateChannelModal } from './components/CreateChannelModal';
import { ThreadDrawer } from './components/ThreadDrawer';
import { ChannelItem } from './components/ChannelItem';
import { Sidebar } from './components/Sidebar';
import { Header } from './components/Header';
import { MessageItem } from './components/MessageItem';
import { MessageList } from './components/MessageList';
import { Composer } from './components/Composer';
import {
  callSheetsBackend,
  getSavedActiveChannelId,
  getSavedSessionUser,
  saveActiveChannelId,
  saveSessionUser,
} from './services/gasClient';
import {
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

  const [composerText, setComposerText] = useState('');
  const [sendingMessage, setSendingMessage] = useState(false);
  const [composerError, setComposerError] = useState('');

  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editingContent, setEditingContent] = useState('');

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

  useEffect(() => {
    const saved = getSavedSessionUser();
    if (saved) {
      void syncWorkspace(saved.user_id, getSavedActiveChannelId());
    } else {
      setLoadingWorkspace(false);
    }
  }, [syncWorkspace]);

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
    setComposerText((prev) => prev + prefix + 'text' + suffix);
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

  const getChannelDisplayName = (channel?: SheetChannel): string => {
    if (!channel) return 'general';
    if (channel.dm_participants && currentUser) {
      const ids = channel.dm_participants.split(',').map((s) => s.trim());
      const partnerId = ids.find((id) => id !== currentUser.user_id) || currentUser.user_id;
      const partner = workspaceUsers.find((u) => u.user_id === partnerId);
      return partner ? partner.full_name : 'Direct Message';
    }
    return channel.name;
  };

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

  const activeThreadRootMessage = useMemo(
    () =>
      activeThreadMessageId
        ? messages.find((m) => m.message_id === activeThreadMessageId) || null
        : null,
    [messages, activeThreadMessageId]
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

  if (loadingWorkspace) {
    return (
      <div className='flex min-h-screen items-center justify-center bg-slate-50 text-slate-600'>
        <div className='flex items-center gap-3 text-sm font-medium'>
          <RefreshCw className='h-4 w-4 animate-spin text-blue-600' />
          <span>Loading Relay Workspace...</span>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return <AuthView onAuthenticated={handleAuthenticated} />;
  }

  return (
    <div className='flex h-screen w-screen overflow-hidden bg-white text-slate-900'>
      <Sidebar
        currentUser={currentUser}
        workspaceUsers={workspaceUsers}
        publicChannels={publicChannels}
        privateChannels={privateChannels}
        activeChannelId={activeChannelId}
        mobileSidebarOpen={mobileSidebarOpen}
        onSelectChannel={handleSelectChannel}
        onOpenDirectMessage={handleOpenDirectMessage}
        onCreateChannel={(isPrivate) => {
          setCreateChannelDefaultPrivate(isPrivate);
          setIsCreateChannelOpen(true);
        }}
        onSignOut={handleSignOut}
        onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
      />

      <div className='flex min-w-0 flex-1 flex-col'>
        <Header
          activeChannel={activeChannel ?? null}
          channelDisplayName={getChannelDisplayName(activeChannel)}
          memberCount={activeChannelMemberCount}
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          onRefresh={() => syncWorkspace(currentUser.user_id, activeChannelId)}
          syncing={syncing}
          isMembersDrawerOpen={isMembersDrawerOpen}
          onToggleMembers={() => setIsMembersDrawerOpen((prev) => !prev)}
          onToggleMobileSidebar={() => setMobileSidebarOpen((prev) => !prev)}
        />

        <div className='flex min-h-0 flex-1 overflow-hidden'>
          <main className='flex min-w-0 flex-1 flex-col bg-white'>
            <div className='flex-1 overflow-y-auto px-4 py-6 sm:px-6'>
              <MessageList
                messages={rootMessages}
                currentUser={currentUser}
                loadingChannel={loadingChannel}
                activeChannel={activeChannel ?? null}
                searchQuery={searchQuery}
                editingMessageId={editingMessageId}
                editingContent={editingContent}
                onEdit={(id) => {
                  const msg = messages.find((m) => m.message_id === id);
                  setEditingMessageId(id);
                  setEditingContent(msg?.content ?? '');
                }}
                onSave={(id, content) => {
                  setEditingContent(content);
                  handleSaveEditedMessage(id);
                }}
                onCancelEdit={() => {
                  setEditingMessageId(null);
                  setEditingContent('');
                }}
                onDelete={handleDeleteMessage}
                onToggleReaction={handleToggleReaction}
                onOpenThread={(id) => setActiveThreadMessageId(id)}
                onEditingContentChange={setEditingContent}
                messagesEndRef={messagesEndRef}
              />
            </div>

            <Composer
              currentUser={currentUser}
              activeChannelId={activeChannelId}
              activeChannel={activeChannel ?? null}
              composerText={composerText}
              onTextChange={setComposerText}
              onSend={handleSendMessage}
              sendingMessage={sendingMessage}
              composerError={composerError}
              onFormatInsert={insertFormatSnippet}
            />
          </main>

          {activeThreadRootMessage && (
            <ThreadDrawer
              rootMessage={activeThreadRootMessage}
              allMessages={messages}
              channelDisplayName={
                activeChannel?.dm_participants
                  ? getChannelDisplayName(activeChannel)
                  : '#' + getChannelDisplayName(activeChannel)
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
};
