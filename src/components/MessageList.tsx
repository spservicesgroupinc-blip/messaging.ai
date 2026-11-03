import React, { useMemo } from 'react';
import { Hash, Lock } from 'lucide-react';
import { MessageItem } from './MessageItem';
import {
  formatDateHeader,
  type EnrichedMessage,
  type PublicUser,
  type SheetChannel,
} from '../utils/sheetsProtocol';

const QUICK_EMOJIS = ['??', '?', '??', '??'];

interface MessageListProps {
  messages: EnrichedMessage[];
  currentUser: PublicUser | null;
  loadingChannel: boolean;
  activeChannel: SheetChannel | null;
  searchQuery: string;
  editingMessageId: string | null;
  editingContent: string;
  onEdit: (id: string) => void;
  onSave: (id: string, content: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onToggleReaction: (id: string, emoji: string) => void;
  onOpenThread: (id: string) => void;
  onEditingContentChange: (value: string) => void;
  messagesEndRef: React.RefObject<HTMLDivElement | null>;
}

export const MessageList: React.FC<MessageListProps> = ({
  messages,
  currentUser,
  loadingChannel,
  activeChannel,
  searchQuery,
  editingMessageId,
  editingContent,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onToggleReaction,
  onOpenThread,
  onEditingContentChange,
  messagesEndRef,
}) => {
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

  const isDm = Boolean(activeChannel?.dm_participants);
  const channelName = isDm ? 'Direct Message' : '#' + (activeChannel?.name ?? 'channel');

  if (loadingChannel) {
    return (
      <div className='space-y-4 py-8'>
        {[1, 2, 3].map((n) => (
          <div key={n} className='flex animate-pulse items-start gap-3'>
            <div className='h-9 w-9 rounded-lg bg-slate-200' />
            <div className='flex-1 space-y-2'>
              <div className='h-3 w-36 rounded bg-slate-200' />
              <div className='h-4 w-2/3 rounded bg-slate-100' />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (rootMessages.length === 0) {
    return (
      <div className='mx-auto my-12 max-w-md rounded-xl border border-slate-200 bg-slate-50/70 p-6 text-center'>
        <div className='mx-auto flex h-10 w-10 items-center justify-center rounded-lg bg-slate-900 text-white'>
          {activeChannel?.is_private ? (
            <Lock className='h-5 w-5' />
          ) : (
            <Hash className='h-5 w-5' />
          )}
        </div>
        <h2 className='mt-3 text-base font-bold text-slate-900'>
          {searchQuery ? 'No messages match your filter' : 'Welcome to ' + channelName}
        </h2>
        <p className='mt-1.5 text-xs leading-relaxed text-slate-600'>
          {searchQuery
            ? 'Try clearing the search filter in the top bar.'
            : activeChannel?.is_private
            ? 'This is the start of a private channel. Only invited members can view and post messages here.'
            : 'This is the beginning of the channel. Type a message below to start the conversation.'}
        </p>
      </div>
    );
  }

  return (
    <div className='space-y-5'>
      {rootMessages.map((msg, index) => {
        const prevMsg = index > 0 ? rootMessages[index - 1] : null;
        const isEditing = editingMessageId === msg.message_id;

        return (
          <React.Fragment key={msg.message_id}>
            <MessageItem
              msg={msg}
              prevMsg={prevMsg}
              currentUser={currentUser}
              isEditing={isEditing}
              editingContent={editingContent}
              onEdit={onEdit}
              onSave={(id) => onSave(id, editingContent)}
              onCancelEdit={onCancelEdit}
              onDelete={onDelete}
              onToggleReaction={(emoji) => onToggleReaction(msg.message_id, emoji)}
              onOpenThread={onOpenThread}
              onContentChange={onEditingContentChange}
              quickEmojis={QUICK_EMOJIS}
            />
          </React.Fragment>
        );
      })}
      <div ref={messagesEndRef} />
    </div>
  );
};
