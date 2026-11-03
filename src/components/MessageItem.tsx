import React from 'react';
import { Check, Edit3, MessageSquare, Trash2, X } from 'lucide-react';
import { Avatar, DateHeader } from './ui';
import {
  formatDateHeader,
  formatTimeShort,
  type EnrichedMessage,
  type PublicUser,
} from '../utils/sheetsProtocol';

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
  quickEmojis: string[];
}

export const MessageItem: React.FC<MessageItemProps> = ({
  msg,
  prevMsg,
  currentUser,
  isEditing,
  editingContent,
  onEdit,
  onSave,
  onCancelEdit,
  onDelete,
  onToggleReaction,
  onOpenThread,
  quickEmojis = ['??', '?', '??', '??'],
}) => {
  const currentDay = formatDateHeader(msg.created_at);
  const prevDay = prevMsg ? formatDateHeader(prevMsg.created_at) : '';
  const showDateHeader = currentDay !== prevDay;
  const isOwn = msg.user_id === currentUser?.user_id;
  const isEdited = msg.updated_at && msg.updated_at !== msg.created_at;

  return (
    <React.Fragment key={msg.message_id}>
      {showDateHeader && <DateHeader date={msg.created_at} />}

      <article className= group flex items-start gap-3.5 rounded-lg px-2 py-1.5 transition-colors hover:bg-slate-50>
        <Avatar userName={msg.user_name} size=md className=h-9 w-9 shrink-0 />

        <div className=min-w-0 flex-1>
          {/* Metadata Header (Clean unboxed text with separators) */}
          <div className=flex flex-wrap items-baseline gap-1.5 text-xs>
            <span className=font-bold text-slate-900>{msg.user_name}</span>
            {msg.user_role && (
              <>
                <span aria-hidden=true className=text-slate-400>
                  &middot;
                </span>
                <span className=text-slate-500>{msg.user_role}</span>
              </>
            )}
            <span aria-hidden=true className=text-slate-400>
              &middot;
            </span>
            <time dateTime={msg.created_at} className=font-mono tabular-nums text-slate-500>
              {formatTimeShort(msg.created_at)}
            </time>
            {isEdited && <span className=text-slate-400>(edited)</span>}
          </div>

          {/* Message Body or Edit Mode */}
          {isEditing ? (
            <div className=mt-2 space-y-2>
              <textarea
                rows={2}
                value={editingContent}
                onChange={(e) => onCancelEdit()}
                className=w-full rounded-lg border border-slate-300 bg-white p-2.5 text-sm text-slate-900 focus:border-blue-600 focus:outline-none
              />
              <div className=flex items-center gap-2>
                <button
                  type=button
                  onClick={() => onSave(msg.message_id)}
                  className=flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1 text-xs font-medium text-white hover:bg-blue-700
                >
                  <Check className=h-3.5 w-3.5 />
                  Save Changes
                </button>
                <button
                  type=button
                  onClick={onCancelEdit}
                  className=flex items-center gap-1 rounded-md border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50
                >
                  <X className=h-3.5 w-3.5 />
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <p className=mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-800>
              {msg.content}
            </p>
          )}

          {/* Reactions & Thread Reply Controls */}
          <div className=mt-2 flex flex-wrap items-center gap-2>
            {Object.entries(msg.reactions || {}).map(([emoji, userIds]) => {
              const hasReacted = userIds.includes(currentUser?.user_id ?? '');
              return (
                <button
                  key={emoji}
                  type=button
                  onClick={() => onToggleReaction(msg.message_id, emoji)}
                  className={lex items-center gap-1 rounded-md border px-2 py-0.5 text-xs font-medium transition-colors tabular-nums }
                >
                  <span>{emoji}</span>
                  <span className=font-mono>{userIds.length}</span>
                </button>
              );
            })}

            <button
              type=button
              onClick={() => onOpenThread(msg.message_id)}
              aria-label={Reply in thread to }
              className=flex items-center gap-1 rounded-md px-2 py-0.5 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 tabular-nums
            >
              <MessageSquare className=h-3.5 w-3.5 />
              <span>
                {msg.reply_count > 0
                  ? ${msg.reply_count} 
                  : 'Reply in thread'}
              </span>
            </button>

            {/* Quick emoji bar */}
            <div className=flex items-center gap-1 opacity-80 transition-opacity group-hover:opacity-100>
              {quickEmojis.map((emoji) => (
                <button
                  key={emoji}
                  type=button
                  onClick={() => onToggleReaction(msg.message_id, emoji)}
                  aria-label={React with }
                  className=rounded px-1.5 py-0.5 text-xs hover:bg-slate-200/70
                >
                  {emoji}
                </button>
              ))}
            </div>

            {/* Author Edit/Delete actions */}
            {isOwn && !isEditing && (
              <div className=flex items-center gap-1>
                <button
                  type=button
                  onClick={() => onEdit(msg.message_id)}
                  aria-label={Edit message }
                  className=rounded p-1 text-slate-400 hover:bg-slate-200/70 hover:text-slate-700
                >
                  <Edit3 className=h-3.5 w-3.5 />
                </button>
                <button
                  type=button
                  onClick={() => onDelete(msg.message_id)}
                  aria-label={Delete message }
                  className=rounded p-1 text-slate-400 hover:bg-red-50 hover:text-red-600
                >
                  <Trash2 className=h-3.5 w-3.5 />
                </button>
              </div>
            )}
          </div>
        </div>
      </article>
    </React.Fragment>
  );
};
