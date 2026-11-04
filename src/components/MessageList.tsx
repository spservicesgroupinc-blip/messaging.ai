import React, { useMemo } from 'react';
import { Hash, LockKeyhole, MessagesSquare, Search } from 'lucide-react';
import { MessageItem } from './MessageItem';
import { type EnrichedMessage, type PublicUser, type SheetChannel } from '../utils/sheetsProtocol';

const QUICK_EMOJIS = ['👍', '✅', '🚀', '🎯'];
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

export const MessageList: React.FC<MessageListProps> = ({ messages, currentUser, loadingChannel, activeChannel, searchQuery, editingMessageId, editingContent, onEdit, onSave, onCancelEdit, onDelete, onToggleReaction, onOpenThread, onEditingContentChange, messagesEndRef }) => {
  const rootMessages = useMemo(() => {
    const roots = messages.filter((m) => !m.parent_message_id);
    const query = searchQuery.trim().toLowerCase();
    return query ? roots.filter((m) => m.content.toLowerCase().includes(query) || m.user_name.toLowerCase().includes(query)) : roots;
  }, [messages, searchQuery]);
  const isDm = Boolean(activeChannel?.dm_participants);
  const ChannelIcon = isDm ? MessagesSquare : activeChannel?.is_private ? LockKeyhole : Hash;

  if (loadingChannel) return (
    <div className='space-y-7 px-4 py-8 sm:px-6' role='status' aria-label='Loading messages' aria-busy='true'>
      {[0, 1, 2, 3].map((number) => <div key={number} className='flex animate-pulse items-start gap-3 motion-reduce:animate-none'>
        <div className='h-9 w-9 shrink-0 rounded-md bg-[#ecefed]' />
        <div className='flex-1 space-y-2'><div className='h-3 w-28 rounded bg-[#e2e8f0]' /><div className='h-3 w-4/5 rounded bg-[#f1f5f9]' /><div className='h-3 w-2/5 rounded bg-[#f1f5f9]' /></div>
      </div>)}
      <span className='sr-only'>Loading messages…</span>
    </div>
  );

  return (
    <div className='pb-5 [overflow-wrap:anywhere]'>
      {searchQuery.trim() ? (
        <div className='flex items-center gap-2 border-b border-[#e2e8f0] px-4 py-4 text-xs text-[#64748b] sm:px-6' role='status'>
          <Search className='h-3.5 w-3.5 shrink-0' /><span>{rootMessages.length} {rootMessages.length === 1 ? 'result' : 'results'} for <strong className='break-all font-medium text-[#353b40]'>“{searchQuery}”</strong></span>
        </div>
      ) : (
        <div className='px-4 pb-3 pt-8 sm:px-6'>
          <div className='mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-[#eef3f0] text-[#426955]'><ChannelIcon className='h-6 w-6' strokeWidth={1.7} /></div>
          <h2 className='text-[23px] font-semibold tracking-[-0.5px] text-[#20252a]'>{isDm ? 'A space to connect' : activeChannel ? activeChannel.name : 'Your workspace'}</h2>
          <p className='mt-1 max-w-2xl text-[13px] leading-5 text-[#72777d]'>
            {isDm ? 'This is the beginning of your direct conversation. Share an update, ask a question, or say hello.' : activeChannel?.description || 'A shared space for conversations, ideas, and keeping your team in the loop.'}
          </p>
          {activeChannel?.is_private && !isDm && <p className='mt-2 flex items-center gap-1.5 text-[11px] text-[#72777d]'><LockKeyhole className='h-3 w-3' />Only invited members can see this channel.</p>}
        </div>
      )}
      {rootMessages.length === 0 && (
        <div role='status' className='px-4 py-10 sm:px-6'>
          <p className='text-sm font-medium text-[#353b40]'>{searchQuery.trim() ? 'No messages found' : 'Start the conversation'}</p>
          <p className='mt-1 text-[13px] leading-5 text-[#72777d]'>{searchQuery.trim() ? 'Try another keyword or clear your search to see all messages.' : 'Send the first message below. Great teamwork starts with a hello.'}</p>
        </div>
      )}
      {rootMessages.map((message, index) => (
        <MessageItem key={message.message_id} msg={message} prevMsg={rootMessages[index - 1] ?? null} currentUser={currentUser} isEditing={editingMessageId === message.message_id} editingContent={editingContent}
          onEdit={onEdit} onSave={(id) => onSave(id, editingContent)} onCancelEdit={onCancelEdit} onDelete={onDelete} onToggleReaction={onToggleReaction} onOpenThread={onOpenThread} onContentChange={onEditingContentChange} quickEmojis={QUICK_EMOJIS} />
      ))}
      <div ref={messagesEndRef} />
    </div>
  );
};
