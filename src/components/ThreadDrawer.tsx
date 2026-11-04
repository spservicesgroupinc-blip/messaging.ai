import React, { useEffect, useRef, useState } from 'react';
import { MessageSquare, Send, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import { useModal } from '../hooks/useModal';
import { useMobile, useOnline } from '../hooks/useDeviceState';
import { useDraft } from '../hooks/useDraft';
import type { ActionResult } from '../hooks/useWorkspace';
import {
  formatTimeShort,
  type EnrichedMessage,
} from '../utils/sheetsProtocol';

interface ThreadDrawerProps {
  rootMessage: EnrichedMessage;
  allMessages: EnrichedMessage[];
  channelDisplayName: string;
  currentUserId: string;
  onClose: () => void;
  onSendReply: (content: string, parentMessageId: string) => Promise<ActionResult>;
}

export const ThreadDrawer: React.FC<ThreadDrawerProps> = ({
  rootMessage,
  allMessages,
  channelDisplayName,
  onClose,
  currentUserId,
  onSendReply,
}) => {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const isMobile = useMobile();
  const online = useOnline();
  useModal(panelRef, isMobile, onClose);
  const draft = useDraft(currentUserId, rootMessage.channel_id, rootMessage.message_id);
  const [error, setError] = useState('');
  const replyText = draft.text;
  const setReplyText = draft.setText;
  const [sending, setSending] = useState(false);

  const replies = allMessages.filter(
    (m) => m.parent_message_id === rootMessage.message_id
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = replyText.trim();
    if (!trimmed || sending || !online) return;

    setSending(true); setError('');
    try {
      const result = await onSendReply(trimmed, rootMessage.message_id);
      if (result.ok) draft.clearSent(replyText);
      else setError(result.error || 'Reply was not sent. Your draft was kept.');
    } catch { setError('Reply was not sent. Your draft was kept. Try again.');
    } finally {
      setSending(false);
    }
  };

  return (
    <aside
      ref={panelRef}
      tabIndex={-1}
      role={isMobile ? 'dialog' : undefined}
      aria-modal={isMobile || undefined}
      aria-label="Message thread replies"
      className="workspace-drawer fixed inset-0 z-30 flex h-dvh w-full min-w-0 flex-col border-l border-[#e5e7e9] bg-white lg:static lg:h-full lg:w-[360px] lg:shrink-0 xl:w-[384px]"
    >
      {/* Header */}
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e7e9] px-5">
        <div className="flex items-center gap-2 min-w-0">
          <MessageSquare className="h-4 w-4 shrink-0 text-slate-600" />
          <div className="truncate">
            <span className="text-sm font-semibold text-slate-900">Thread</span>
            <span className="text-xs text-slate-600"> &middot; {channelDisplayName}</span>
          </div>
        </div>
        <button
          type="button"
          onClick={onClose}
          ref={closeRef}
          aria-label="Close thread panel"
          className="rounded-lg p-1.5 text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#0f172a]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* Thread Stream */}
      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-4 [overflow-wrap:anywhere]">
        {/* Root Message */}
        <div className="border-b border-[#e5e7e9] pb-4">
          <div className="flex items-start gap-3">
            <Avatar userName={rootMessage.user_name} size="md" className="h-8 w-8 shrink-0" />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                <span className="font-semibold text-slate-900">{rootMessage.user_name}</span>
                <span aria-hidden="true" className="text-slate-400">
                  &middot;
                </span>
                <span className="tabular-nums text-slate-600">
                  {formatTimeShort(rootMessage.created_at)}
                </span>
              </div>
              <p className="mt-1 text-sm leading-relaxed break-words whitespace-pre-wrap text-[#363c40]">
                {rootMessage.content}
              </p>
            </div>
          </div>
          <div className="mt-3 text-xs font-medium text-slate-600 tabular-nums">
            {replies.length} {replies.length === 1 ? 'reply' : 'replies'}
          </div>
        </div>

        {/* Replies List */}
        {replies.length === 0 ? (
          <p className="py-4 text-center text-xs text-slate-600">
            No replies in this thread yet. Reply below to start the conversation.
          </p>
        ) : (
          <div className="space-y-4">
            {replies.map((reply) => (
              <div key={reply.message_id} className="flex items-start gap-3">
                <Avatar userName={reply.user_name} size="sm" className="h-7 w-7 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-baseline gap-x-2 text-xs">
                    <span className="font-semibold text-slate-900">{reply.user_name}</span>
                    <span aria-hidden="true" className="text-slate-400">
                      &middot;
                    </span>
                    <span className="tabular-nums text-slate-600">
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
      <form onSubmit={handleSubmit} className="shrink-0 border-t border-[#e5e7e9] p-4">
        {error && <p role="alert" className="mb-2 text-sm text-red-800">{error}</p>}
        {draft.saveFailed && <p role="status" className="mb-2 text-xs text-amber-900">Draft not saved on this device. Keep this app open.</p>}
        {!online && <p role="status" className="mb-2 text-xs text-slate-600">Offline draft — reconnect, then tap Send.</p>}
        <div className="flex items-center gap-2">
          <textarea
            rows={2}
            disabled={sending}
            aria-label="Reply in thread"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
            onKeyDown={event => { if (!isMobile && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void handleSubmit(event); } }}
            placeholder="Reply in thread..."
            className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-2 max-h-40 resize-none text-base text-[#0f172a] placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/20 focus:outline-none"
          />
          <Button
            type="submit"
            variant="primary"
            size="md"
            disabled={!replyText.trim() || sending || !online}
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
