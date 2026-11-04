import { useEffect, useRef, useState } from 'react';
import { Bold, Code2, Italic, LoaderCircle, SendHorizontal, Smile, Strikethrough, Type, X } from 'lucide-react';
import { useDraft } from '../hooks/useDraft';
import { useMobile, useOnline } from '../hooks/useDeviceState';
import type { ActionResult } from '../hooks/useWorkspace';
import type { PublicUser, SheetChannel } from '../utils/sheetsProtocol';

interface ComposerProps {
  currentUser: PublicUser;
  activeChannel: SheetChannel;
  onSend: (content: string) => Promise<ActionResult>;
}
const FORMATS = [
  { icon: Bold, label: 'Bold', marker: '**' }, { icon: Italic, label: 'Italic', marker: '_' },
  { icon: Strikethrough, label: 'Strikethrough', marker: '~~' }, { icon: Code2, label: 'Insert inline code', marker: '`' },
];
export function Composer({ currentUser, activeChannel, onSend }: ComposerProps) {
  const draft = useDraft(currentUser.user_id, activeChannel.channel_id);
  const ref = useRef<HTMLTextAreaElement>(null);
  const selection = useRef({ start: 0, end: 0 });
  const [sending, setSending] = useState(false);
  const [error, setError] = useState('');
  const [formatting, setFormatting] = useState(false);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const online = useOnline();
  const mobile = useMobile();
  useEffect(() => {
    const input = ref.current;
    if (!input) return;
    input.style.height = 'auto';
    input.style.height = Math.min(160, Math.max(64, input.scrollHeight)) + 'px';
  }, [draft.text]);
  const rememberSelection = () => {
    if (ref.current) selection.current = { start: ref.current.selectionStart, end: ref.current.selectionEnd };
  };
  const insert = (prefix: string, suffix = '') => {
    const { start, end } = selection.current;
    const selected = draft.text.slice(start, end);
    const content = suffix ? (selected || 'text') : '';
    const next = draft.text.slice(0, start) + prefix + content + suffix + draft.text.slice(end);
    draft.setText(next);
    requestAnimationFrame(() => {
      ref.current?.focus();
      const from = start + prefix.length;
      const to = suffix ? from + content.length : from;
      ref.current?.setSelectionRange(from, to); rememberSelection();
    });
  };
  const send = async () => {
    const text = draft.text;
    if (!text.trim() || sending || !online) return;
    setSending(true); setError('');
    try {
      const result = await onSend(text.trim());
      if (result.ok) draft.clearSent(text); else setError(result.error || 'Message was not sent. Your draft was kept.');
    } catch { setError('Message was not sent. Your draft was kept. Try again.'); }
    finally { setSending(false); }
  };
  return <section aria-label="Write a message" className="shrink-0 bg-white px-3 pb-3 pt-2 sm:px-6 sm:pb-4">
    {error && <p role="alert" className="mb-2 rounded-md bg-red-50 p-2 text-sm text-red-800">{error}</p>}
    {draft.saveFailed && <p role="status" className="mb-2 text-xs text-amber-900">Draft not saved on this device. Keep this app open.</p>}
    <form onSubmit={event => { event.preventDefault(); void send(); }} className="overflow-hidden rounded-lg border border-slate-300 focus-within:border-blue-500 focus-within:ring-2 focus-within:ring-blue-100">
      <div id="message-formatting" className={(formatting ? 'flex' : 'hidden') + ' items-center gap-1 bg-slate-50 px-2 py-1 sm:flex'} role="group" aria-label="Message formatting">
        {FORMATS.map(({ icon: Icon, label, marker }) => <button key={label} type="button" disabled={sending} onPointerDown={event => event.preventDefault()} onClick={() => insert(marker, marker)} aria-label={label} className="touch-target rounded text-slate-600 hover:bg-slate-100"><Icon size={16} /></button>)}
      </div>
      <textarea ref={ref} rows={2} aria-label="Message input" disabled={sending} value={draft.text} onChange={event => { draft.setText(event.target.value); rememberSelection(); }} onSelect={rememberSelection} onBlur={rememberSelection}
        onKeyDown={event => { if (!mobile && event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); void send(); } }}
        placeholder={activeChannel.dm_participants ? 'Message your conversation' : 'Message #' + activeChannel.name}
        className="block max-h-40 min-h-16 w-full resize-none overflow-y-auto border-0 bg-transparent px-3 py-2 text-base leading-6 outline-none placeholder:text-slate-500 disabled:opacity-60 lg:text-sm" />
      <div className="flex items-center justify-between gap-2 px-2 pb-2">
        <div className="relative flex items-center">
          <button type="button" aria-label="Message formatting" aria-controls="message-formatting" aria-expanded={formatting} onPointerDown={event => event.preventDefault()} onClick={() => setFormatting(!formatting)} className="touch-target rounded text-slate-600 hover:bg-slate-100 sm:hidden"><Type size={18} /></button>
          <button type="button" aria-label="Insert emoji" aria-expanded={emojiOpen} onPointerDown={event => event.preventDefault()} onClick={() => setEmojiOpen(!emojiOpen)} className="touch-target rounded text-slate-600 hover:bg-slate-100"><Smile size={18} /></button>
          {draft.text && <button type="button" aria-label="Clear draft" onClick={() => draft.setText('')} disabled={sending} className="touch-target rounded text-slate-600 hover:bg-slate-100"><X size={16} /></button>}
          {emojiOpen && <div className="absolute bottom-full left-0 z-20 mb-2 flex rounded-lg border border-slate-200 bg-white p-1 shadow-sm" role="group" aria-label="Choose emoji" onKeyDown={event => { if (event.key === 'Escape') setEmojiOpen(false); }}>
            {['👋', '👍', '✅', '🎉', '💙'].map(emoji => <button key={emoji} type="button" aria-label={'Insert ' + emoji} onPointerDown={event => event.preventDefault()} onClick={() => { insert(emoji); setEmojiOpen(false); }} className="touch-target rounded text-base hover:bg-slate-100">{emoji}</button>)}
          </div>}
        </div>
        <button type="submit" disabled={!draft.text.trim() || sending || !online} aria-label="Send message" className="touch-target gap-2 rounded-md bg-blue-600 px-3 text-sm font-medium text-white hover:bg-blue-700 disabled:bg-slate-100 disabled:text-slate-500">
          <span className="hidden sm:inline">{sending ? 'Sending' : 'Send'}</span>{sending ? <LoaderCircle size={18} className="animate-spin" /> : <SendHorizontal size={18} />}
        </button>
      </div>
    </form>
    {!online ? <p role="status" className="mt-1 text-xs text-slate-600">Offline draft — reconnect, then tap Send.</p> : <p className="mt-1 hidden text-right text-xs text-slate-600 lg:block">Enter to send · Shift + Enter for a new line</p>}
  </section>;
}
