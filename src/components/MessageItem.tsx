import React, { useState } from 'react';
import { Check, Edit3, Ellipsis, MessageSquare, Trash2, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { DateHeader } from './ui/DateHeader';
import { Reactions } from './ui/Reactions';
import { formatDateHeader, formatTimeShort, type EnrichedMessage, type PublicUser } from '../utils/sheetsProtocol';

interface MessageItemProps {
  msg: EnrichedMessage;
  prevMsg: EnrichedMessage | null;
  currentUser: PublicUser | null;
  isEditing: boolean;
  editingContent: string;
  onEdit: (id: string) => void;
  onSave: (id: string) => void;
  onCancelEdit: () => void;
  onDelete: (id: string) => void;
  onToggleReaction: (id: string, emoji: string) => void;
  onOpenThread: (id: string) => void;
  onContentChange: (value: string) => void;
  quickEmojis: string[];
}

function renderMessage(content: string) {
  return content.split(/(\*\*[^*\n]+\*\*|_[^_\n]+_|~~[^~\n]+~~|`[^`\n]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className='font-semibold'>{part.slice(2, -2)}</strong>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <s key={index}>{part.slice(2, -2)}</s>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className='rounded border border-[#e5e7e9] bg-[#f5f6f5] px-1 py-px text-[12px] text-[#a34b48]'>{part.slice(1, -1)}</code>;
    return part;
  });
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, prevMsg, currentUser, isEditing, editingContent, onEdit, onSave, onCancelEdit, onDelete, onToggleReaction, onOpenThread, onContentChange, quickEmojis = ['👍', '✅', '🚀', '🎯'] }) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const showDateHeader = formatDateHeader(msg.created_at) !== (prevMsg ? formatDateHeader(prevMsg.created_at) : '');
  const grouped = !showDateHeader && prevMsg?.user_id === msg.user_id && new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;
  const isOwn = msg.user_id === currentUser?.user_id;
  const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;
  const hasReactions = Object.values(msg.reactions || {}).some((users) => users.length > 0);
  const actionClass = 'flex h-8 w-8 items-center justify-center rounded text-[#72777d] transition-colors hover:bg-[#f1f3f2] hover:text-[#20252a]';

  return (
    <>
      {showDateHeader && <DateHeader date={msg.created_at} />}
      <article onKeyDown={(event) => { if (event.key === 'Escape') setActionsOpen(false); }} className={`group relative flex items-start gap-3 px-4 transition-colors hover:bg-[#f8f9f8] focus-within:bg-[#f8f9f8] sm:px-6 ${grouped ? 'py-0.5' : 'mt-3 py-1.5'}`}>
        {grouped ? (
          <time dateTime={msg.created_at} className='mt-1 w-9 shrink-0 text-center text-[9px] text-[#72777d] opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' aria-label={formatTimeShort(msg.created_at)}>{formatTimeShort(msg.created_at)}</time>
        ) : <Avatar userName={msg.user_name} size='md' />}
        <div className='min-w-0 flex-1'>
          {!grouped && (
            <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
              <span className='text-sm font-semibold text-[#20252a]'>{msg.user_name}</span>
              {msg.user_role && <span className='hidden text-[11px] text-[#72777d] sm:inline'>{msg.user_role}</span>}
              <time dateTime={msg.created_at} className='text-[11px] tabular-nums text-[#72777d]'>{formatTimeShort(msg.created_at)}</time>
            </div>
          )}
          {isEditing ? (
            <div className='mt-1 space-y-2 pb-2'>
              <textarea autoFocus rows={3} aria-label='Edit message' value={editingContent} onChange={(e) => onContentChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onCancelEdit(); }} className='w-full resize-y rounded-md border border-[#a4cbbb] bg-white p-2.5 text-sm leading-[21px] text-[#20252a] outline-none focus:ring-2 focus:ring-[#217a5b]/15' />
              <div className='flex flex-wrap items-center gap-2'>
                <button type='button' onClick={onCancelEdit} className='flex items-center gap-1.5 rounded-md border border-[#d7dcda] bg-white px-3 py-1.5 text-xs font-medium text-[#575e63] hover:bg-[#f1f3f2]'><X className='h-3 w-3' />Cancel</button>
                <button type='button' disabled={!editingContent.trim()} onClick={() => onSave(msg.message_id)} className='flex items-center gap-1.5 rounded-md bg-[#217a5b] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#196347] disabled:opacity-40'><Check className='h-3 w-3' />Save changes</button>
              </div>
            </div>
          ) : (
            <p className='break-words whitespace-pre-wrap text-sm leading-[21px] text-[#353b40] [overflow-wrap:anywhere]'>
              {renderMessage(msg.content)}{isEdited && <span className='ml-1.5 text-[10px] text-[#72777d]'>(edited)</span>}
            </p>
          )}
          {(hasReactions || msg.reply_count > 0) && (
            <div className='mt-1.5 flex flex-wrap items-center gap-2 pb-0.5'>
              {hasReactions && <Reactions reactions={msg.reactions} currentUserId={currentUser?.user_id ?? ''} onToggle={(emoji) => onToggleReaction(msg.message_id, emoji)} quickEmojis={quickEmojis} />}
              {msg.reply_count > 0 && <button type='button' onClick={() => onOpenThread(msg.message_id)} className='inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold text-[#217a5b] hover:bg-[#edf6f1] hover:underline'><MessageSquare className='h-3.5 w-3.5' />{msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}<span className='hidden text-[11px] font-normal text-[#72777d] sm:inline'>View thread</span></button>}
            </div>
          )}
        </div>
        {!isEditing && <button type='button' onClick={() => setActionsOpen(!actionsOpen)} aria-label='Show message actions' aria-expanded={actionsOpen} className='hidden h-7 w-7 shrink-0 items-center justify-center rounded text-[#72777d] hover:bg-[#e8ece9] [@media(hover:none)]:flex'><Ellipsis className='h-4 w-4' /></button>}
        {!isEditing && (
          <div role='group' aria-label={`Actions for ${msg.user_name}'s message`} className={`absolute -top-4 right-3 z-10 flex items-center rounded-md border border-[#e0e4e1] bg-white p-0.5 shadow-sm transition-opacity group-hover:opacity-100 group-focus-within:opacity-100 sm:right-6 ${actionsOpen ? 'opacity-100' : 'opacity-0'}`}>
            {quickEmojis.map((emoji) => <button key={emoji} type='button' title={'React with ' + emoji} aria-label={'React with ' + emoji} onClick={() => onToggleReaction(msg.message_id, emoji)} className={actionClass + ' text-sm'}>{emoji}</button>)}
            <div className='mx-0.5 h-4 border-l border-[#e5e7e9]' />
            <button type='button' onClick={() => onOpenThread(msg.message_id)} aria-label={`Reply in thread to "${msg.content.slice(0, 24)}"`} title='Reply in thread' className={actionClass}><MessageSquare className='h-4 w-4' /></button>
            {isOwn && <>
              <button type='button' onClick={() => onEdit(msg.message_id)} aria-label={`Edit message "${msg.content.slice(0, 20)}"`} title='Edit message' className={actionClass}><Edit3 className='h-4 w-4' /></button>
              <button type='button' onClick={() => onDelete(msg.message_id)} aria-label={`Delete message "${msg.content.slice(0, 20)}"`} title='Delete message' className={actionClass + ' hover:bg-red-50 hover:text-red-600'}><Trash2 className='h-4 w-4' /></button>
            </>}
          </div>
        )}
      </article>
    </>
  );
};
