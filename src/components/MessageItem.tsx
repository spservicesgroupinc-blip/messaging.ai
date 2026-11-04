import React, { useState } from 'react';
import { Check, Edit3, Ellipsis, MessageSquare, Trash2, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { DateHeader } from './ui/DateHeader';
import { Reactions } from './ui/Reactions';
import { ActionSheet } from './ui/ActionSheet';
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
  actionError?: string;
  pending?: boolean;
}

function renderMessage(content: string) {
  return content.split(/(\*\*[^*\n]+\*\*|_[^_\n]+_|~~[^~\n]+~~|`[^`\n]+`)/g).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**')) return <strong key={index} className='font-semibold'>{part.slice(2, -2)}</strong>;
    if (part.startsWith('_') && part.endsWith('_')) return <em key={index}>{part.slice(1, -1)}</em>;
    if (part.startsWith('~~') && part.endsWith('~~')) return <s key={index}>{part.slice(2, -2)}</s>;
    if (part.startsWith('`') && part.endsWith('`')) return <code key={index} className='rounded border border-[#e2e8f0] bg-[#f1f5f9] px-1 py-px text-[12px] text-[#dc2626]'>{part.slice(1, -1)}</code>;
    return part;
  });
}

export const MessageItem: React.FC<MessageItemProps> = ({ msg, prevMsg, currentUser, isEditing, editingContent, onEdit, onSave, onCancelEdit, onDelete, onToggleReaction, onOpenThread, onContentChange, quickEmojis = ['👍', '✅', '🚀', '🎯'], actionError, pending }) => {
  const [actionsOpen, setActionsOpen] = useState(false);
  const showDateHeader = formatDateHeader(msg.created_at) !== (prevMsg ? formatDateHeader(prevMsg.created_at) : '');
  const grouped = !showDateHeader && prevMsg?.user_id === msg.user_id && new Date(msg.created_at).getTime() - new Date(prevMsg.created_at).getTime() < 5 * 60 * 1000;
  const isOwn = msg.user_id === currentUser?.user_id;
  const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;
  const hasReactions = Object.values(msg.reactions || {}).some((users) => users.length > 0);


  return (
    <>
      {showDateHeader && <DateHeader date={msg.created_at} />}
      <article onKeyDown={(event) => { if (event.key === 'Escape') setActionsOpen(false); }} className={`group relative flex items-start gap-3 px-4 transition-colors hover:bg-[#f8fafc] focus-within:bg-[#f8fafc] sm:px-6 ${grouped ? 'py-0.5' : 'mt-3 py-1.5'}`}>
        {grouped ? (
          <time dateTime={msg.created_at} className='mt-1 w-9 shrink-0 text-center text-[9px] text-slate-600 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100' aria-label={formatTimeShort(msg.created_at)}>{formatTimeShort(msg.created_at)}</time>
        ) : <Avatar userName={msg.user_name} size='md' />}
        <div className='min-w-0 flex-1'>
          {!grouped && (
            <div className='flex flex-wrap items-baseline gap-x-2 gap-y-0.5'>
              <span className='text-sm font-semibold text-slate-900'>{msg.user_name}</span>
              {msg.user_role && <span className='hidden text-[11px] text-slate-600 sm:inline'>{msg.user_role}</span>}
              <time dateTime={msg.created_at} className='text-[11px] tabular-nums text-slate-600'>{formatTimeShort(msg.created_at)}</time>
            </div>
          )}
          {isEditing ? (
            <div className='mt-1 space-y-2 pb-2'>
              <textarea autoFocus rows={3} aria-label='Edit message' value={editingContent} onChange={(e) => onContentChange(e.target.value)} onKeyDown={(e) => { if (e.key === 'Escape') onCancelEdit(); }} className='w-full resize-y rounded-md border border-[#94a3b8] bg-white p-2.5 text-sm leading-[21px] text-[#0f172a] outline-none focus:ring-2 focus:ring-[#2563eb]/15' />
              <div className='flex flex-wrap items-center gap-2'>
                <button type='button' onClick={onCancelEdit} className='flex items-center gap-1.5 rounded-md border border-[#cbd5e1] bg-white px-3 py-1.5 text-xs font-medium text-[#64748b] hover:bg-[#f1f5f9]'><X className='h-3 w-3' />Cancel</button>
                <button type='button' disabled={pending || !editingContent.trim()} onClick={() => onSave(msg.message_id)} className='flex items-center gap-1.5 rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-medium text-white hover:bg-[#1e40af] disabled:opacity-40'><Check className='h-3 w-3' />Save changes</button>
              </div>
            </div>
          ) : (
            <p className='break-words whitespace-pre-wrap text-sm leading-[21px] text-slate-700 [overflow-wrap:anywhere]'>
              {renderMessage(msg.content)}{isEdited && <span className='ml-1.5 text-[10px] text-slate-600'>(edited)</span>}
            </p>
          )}
          {actionError && <p role='alert' className='mt-2 text-sm text-red-800'>{actionError}</p>}
          {pending && <p role='status' className='mt-1 text-xs text-slate-600'>Updating message…</p>}
          {(hasReactions || msg.reply_count > 0) && (
            <div className='mt-1.5 flex flex-wrap items-center gap-2 pb-0.5'>
              {hasReactions && <Reactions reactions={msg.reactions} currentUserId={currentUser?.user_id ?? ''} onToggle={(emoji) => onToggleReaction(msg.message_id, emoji)} quickEmojis={quickEmojis} />}
              {msg.reply_count > 0 && <button type='button' onClick={() => onOpenThread(msg.message_id)} className='inline-flex items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold text-[#2563eb] hover:bg-[#f1f5f9] hover:underline'><MessageSquare className='h-3.5 w-3.5' />{msg.reply_count} {msg.reply_count === 1 ? 'reply' : 'replies'}<span className='hidden text-[11px] font-normal text-[#64748b] sm:inline'>View thread</span></button>}
            </div>
          )}
        </div>
        {!isEditing && <button type='button' disabled={pending} onClick={() => setActionsOpen(true)} aria-label='Show message actions' aria-haspopup='dialog' aria-expanded={actionsOpen} className='touch-target shrink-0 rounded text-slate-600 hover:bg-slate-100'><Ellipsis className='h-4 w-4' /></button>}
        {actionsOpen && <ActionSheet title="Message actions" onClose={() => setActionsOpen(false)}>
          <div className="flex gap-2 px-2" role="group" aria-label="Quick reactions">{quickEmojis.map(emoji => <button key={emoji} className="touch-target rounded text-xl hover:bg-slate-100" aria-label={'React with ' + emoji} onClick={() => { setActionsOpen(false); onToggleReaction(msg.message_id, emoji); }}>{emoji}</button>)}</div>
          <button className="sheet-action" onClick={() => { setActionsOpen(false); onOpenThread(msg.message_id); }}><MessageSquare size={18} />Reply in thread</button>
          {isOwn && <>
            <button className="sheet-action" onClick={() => { setActionsOpen(false); onEdit(msg.message_id); }}><Edit3 size={18} />Edit message</button>
            <button className="sheet-action text-red-700" onClick={() => { setActionsOpen(false); onDelete(msg.message_id); }}><Trash2 size={18} />Delete message</button>
          </>}
        </ActionSheet>}
      </article>
    </>
  );
};
