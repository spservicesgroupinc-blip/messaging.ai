import React, { useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import {
  formatTimeShort,
  getInitials,
  type EnrichedMessage,
} from '../utils/sheetsProtocol';

interface ThreadDrawerProps {
  rootMessage: EnrichedMessage;
  allMessages: EnrichedMessage[];
  channelDisplayName: string;
  onClose: () => void;
  onSendReply: (content: string, parentMessageId: string) => Promise<void>;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  rootMessage,
  allMessages,
  channelDisplayName,
  onClose,
  onSendReply,
}) => {
  const [replyText, setReplyText] = useState('');
  const [sending, setSending] = useState(false);

  const replies = allMessages.filter(
    (m) => m.parent_message_id === rootMessage.message_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || sending) return;

    setSending(true);
    try {
      await onSendReply(trimmed, rootMessage.message_id);
      setReplyText('');
    } finally {
      setSending(false);
    }
  };

  return (
    <aside
      aria-label="Message thread replies"
      className="flex h-full w-96 shrink-0 flex-col border-l border-slate-200 bg-white"
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 shrink-0 text-slate-600" />
          <div className="truncate">
            <span className="text-sm font-semibold text-slate-900">Thread</span>
            <span className="text-xs text-slate-500"> &middot; {channelDisplayName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close thread panel"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread Stream */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Root Message */}
        <div className="border-b border-slate-200 pb-4">
          <div className="flex items-start gap-3">
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-semibold text-white">
              {getInitials(rootMessage.user_name)}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2 text-xs">
                <span className="font-semibold text-slate-900">{rootMessage.user_name}</span>
                <span aria-hidden="true" className="text-slate-400">
                  &middot;
                </span>
                <span className="font-mono tabular-nums text-slate-500">
                  {formatTimeShort(rootMessage.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                {rootMessage.content}
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs font-medium text-slate-500 tabular-nums">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </div>
        </div>

        {/* Replies List */}
        {replies.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-500">
            No replies in this thread yet. Reply below to start the conversation.
          </p>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => (
              <div key={reply.message_id} className="flex items-start gap-3">
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-800 text-xs font-semibold text-white">
                  {getInitials(reply.user_name)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-baseline gap-2 text-xs">
                    <span className="font-semibold text-slate-900">{reply.user_name}</span>
                    <span aria-hidden="true" className="text-slate-400">
                      &middot;
                    </span>
                    <span className="font-mono tabular-nums text-slate-500">
                      {formatTimeShort(reply.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed whitespace-pre-wrap text-slate-800">
                    {reply.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thread Reply Composer */}
      <form onSubmit={handleSubmit} className="border-t border-slate-200 p-3.5">
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Reply in thread"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
            className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
          />
          <button
            type="submit"
            disabled={!replyText.trim() || sending}
            aria-label="Send thread reply"
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-600 text-white transition-colors hover:bg-blue-700 disabled:opacity-40"
          >
            <Send className="h-4 w-4" />
          </button>
        </div>
      </form>
    </aside>
  );
};
