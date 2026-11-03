import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import {
  formatTimeShort,
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
  const closeRef = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose(); };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [onClose]);

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
      className="fixed inset-0 z-30 flex h-dvh w-full min-w-0 flex-col border-l border-[#e5e7e9] bg-white lg:static lg:h-full lg:w-[360px] lg:shrink-0 xl:w-[384px]"
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e7e9] px-5">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 shrink-0 text-slate-600" />
          <div className="truncate">
            <span className="text-sm font-semibold text-[#20252a]">Thread</span>
            <span className="text-xs text-[#72777d]"> &middot; {channelDisplayName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          ref={closeRef}
          aria-label="Close thread panel"
          className="rounded-lg p-1.5 text-[#72777d] transition-colors hover:bg-slate-100 hover:text-[#20252a]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread Stream */}
      <div className="flex-1 space-y-4 overflow-y-auto p-4">
        {/* Root Message */}
        <div className="border-b border-[#e5e7e9] pb-4">
          <div className="flex items-start gap-3">
            <Avatar userName={rootMessage.user_name} size="md" className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-semibold text-[#20252a]">{rootMessage.user_name}</span>
                <span aria-hidden="true" className="text-slate-400">
                  &middot;
                </span>
                <span className="tabular-nums text-[#72777d]">
                  {formatTimeShort(rootMessage.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-[#363c40]">
                {rootMessage.content}
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs font-medium text-[#72777d] tabular-nums">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </div>
        </div>

        {/* Replies List */}
        {replies.length === 0 ? (
          <p className="py-4 text-center text-xs text-[#72777d]">
            No replies in this thread yet. Reply below to start the conversation.
          </p>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => (
              <div key={reply.message_id} className="flex items-start gap-3">
                <Avatar userName={reply.user_name} size="sm" className="h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-[#20252a]">{reply.user_name}</span>
                    <span aria-hidden="true" className="text-slate-400">
                      &middot;
                    </span>
                    <span className="tabular-nums text-[#72777d]">
                      {formatTimeShort(reply.created_at)}
                    </span>
                  </div>
                  <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-[#363c40]">
                    {reply.content}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Thread Reply Composer */}
      <form onSubmit={handleSubmit} className="border-t border-[#e5e7e9] p-4 safe-area-bottom">
        <div className="flex items-center gap-2">
          <input
            type="text"
            aria-label="Reply in thread"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            placeholder="Reply in thread..."
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-[#20252a] placeholder:text-slate-400 focus:border-[#217a5b] focus:ring-1 focus:ring-[#217a5b]/20 focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!replyText.trim() || sending}
            loading={sending}
            aria-label="Send thread reply"
          >
            <Send className="h-4 w-4 shrink-0" />
          </Button>
        </div>
      </form>
    </aside>
  );
};
