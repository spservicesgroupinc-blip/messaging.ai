import { useRef, useState } from 'react';
import { MessageList } from './MessageList';
import { Composer } from './Composer';
import { useConversationScroll } from '../hooks/useConversationScroll';
import type { useWorkspace } from '../hooks/useWorkspace';
import type { GasRequestPayload, SheetChannel } from '../utils/sheetsProtocol';

export function Conversation({ workspace: w, channel, searchQuery, onThread }: { workspace: ReturnType<typeof useWorkspace>; channel: SheetChannel; searchQuery: string; onThread: (id: string) => void }) {
  const [editing, setEditing] = useState<string | null>(null);
  const [content, setContent] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [pending, setPending] = useState<string | null>(null);
  const endRef = useRef<HTMLDivElement>(null);
  const scroll = useConversationScroll(w.user!.user_id + ':' + channel.channel_id, w.messages);
  const act = async (id: string, payload: GasRequestPayload, onSuccess?: () => void) => {
    setPending(id); setErrors(previous => ({ ...previous, [id]: '' }));
    const result = await w.act({ ...payload, channelId: channel.channel_id });
    if (result.ok) onSuccess?.(); else setErrors(previous => ({ ...previous, [id]: result.error ?? 'Please try again.' }));
    setPending(null);
  };
  return <main id="conversation" tabIndex={-1} className="relative flex min-h-0 min-w-0 flex-1 flex-col bg-white outline-none">
    <div ref={scroll.stream} onScroll={scroll.onScroll} data-testid="message-stream" className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
      <MessageList messages={w.messages} currentUser={w.user} loadingChannel={w.loadingChannel} activeChannel={channel} searchQuery={searchQuery} editingMessageId={editing} editingContent={content}
        onEdit={id => { setEditing(id); setContent(w.messages.find(message => message.message_id === id)?.content ?? ''); }}
        onSave={(id, text) => void act(id, { action: 'editMessage', messageId: id, content: text }, () => setEditing(null))}
        onCancelEdit={() => setEditing(null)} onDelete={id => void act(id, { action: 'deleteMessage', messageId: id })}
        onToggleReaction={(id, emoji) => void act(id, { action: 'toggleReaction', messageId: id, emoji })}
        onOpenThread={onThread} onEditingContentChange={setContent} messagesEndRef={endRef} actionErrors={errors} pendingMessageId={pending} />
    </div>
    {scroll.hasNew && <button onClick={scroll.jump} className="absolute bottom-48 left-1/2 z-10 min-h-11 -translate-x-1/2 rounded-full border border-blue-200 bg-white px-4 text-sm font-medium text-blue-700 shadow-sm">New messages</button>}
    <Composer currentUser={w.user!} activeChannel={channel} onSend={async text => {
      const result = await w.act({ action: 'sendMessage', channelId: channel.channel_id, content: text });
      if (result.ok) requestAnimationFrame(scroll.jump);
      return result;
    }} />
  </main>;
}
