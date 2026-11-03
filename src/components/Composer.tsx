import React, { useRef, useState } from 'react';
import { Bold, Code2, Italic, LoaderCircle, SendHorizontal, Smile, Strikethrough } from 'lucide-react';
import { type PublicUser, type SheetChannel } from '../utils/sheetsProtocol';

interface ComposerProps {
  currentUser: PublicUser | null;
  activeChannelId: string | null;
  activeChannel: SheetChannel | null;
  composerText: string;
  onTextChange: (value: string) => void;
  onSend: () => void;
  sendingMessage: boolean;
  composerError: string | '';
  onFormatInsert: (prefix: string, suffix?: string) => void;
}
const FORMAT_ACTIONS = [
  { icon: Bold, label: 'Bold', marker: '**' },
  { icon: Italic, label: 'Italic', marker: '_' },
  { icon: Strikethrough, label: 'Strikethrough', marker: '~~' },
  { icon: Code2, label: 'Insert inline code', marker: '`' },
];

export const Composer: React.FC<ComposerProps> = ({ currentUser, activeChannelId, activeChannel, composerText, onTextChange, onSend, sendingMessage, composerError, onFormatInsert }) => {
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [emojiOpen, setEmojiOpen] = useState(false);
  const unavailable = !currentUser || !activeChannelId || sendingMessage;
  const target = activeChannel?.dm_participants ? 'your conversation' : activeChannel ? '#' + activeChannel.name : 'your channel';
  const insertFormat = (marker: string) => {
    const input = textareaRef.current;
    if (!input) return;
    const { selectionStart: start, selectionEnd: end } = input;
    if (start !== end) {
      onTextChange(composerText.slice(0, start) + marker + composerText.slice(start, end) + marker + composerText.slice(end));
    } else {
      onFormatInsert(marker);
    }
    input.focus();
  };
  return (
    <div className='shrink-0 bg-white px-3 pb-3 pt-2 sm:px-6 sm:pb-4'>
      {composerError && <div role='alert' className='mb-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800'>{composerError}</div>}
      <form onSubmit={(event) => { event.preventDefault(); if (!unavailable && composerText.trim()) void onSend(); }} className='rounded-lg border border-[#cfd6d1] bg-white transition-colors focus-within:border-[#87ad99] focus-within:ring-2 focus-within:ring-[#217a5b]/5'>
        <div className='flex items-center gap-0.5 rounded-t-lg bg-[#f7f8f7] px-2 py-1.5' role='toolbar' aria-label='Message formatting'>
          {FORMAT_ACTIONS.map(({ icon: Icon, label, marker }) => <button key={label} type='button' disabled={unavailable} onClick={() => insertFormat(marker)} title={label} aria-label={label} className='flex h-7 w-8 items-center justify-center rounded text-[#636b65] hover:bg-[#e8ece9] hover:text-[#20252a] disabled:opacity-40'><Icon className='h-4 w-4' strokeWidth={1.8} /></button>)}
        </div>
        <textarea ref={textareaRef} rows={2} aria-label='Message input' disabled={unavailable} value={composerText} onChange={(event) => onTextChange(event.target.value)}
          onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) { event.preventDefault(); if (!unavailable && composerText.trim()) void onSend(); } }}
          placeholder={'Message ' + target} className='block max-h-40 min-h-16 w-full resize-y border-0 bg-transparent px-3.5 py-3 text-sm leading-[21px] text-[#20252a] outline-none placeholder:text-[#8b918c] disabled:opacity-50' />
        <div className='flex items-center justify-between px-2.5 pb-2'>
          <div className='relative'>
            <button type='button' aria-label='Insert emoji' aria-expanded={emojiOpen} onClick={() => setEmojiOpen(!emojiOpen)} disabled={unavailable} title='Insert emoji' className='flex h-8 w-8 items-center justify-center rounded text-[#72777d] hover:bg-[#f1f3f2] disabled:opacity-40'><Smile className='h-[18px] w-[18px]' strokeWidth={1.7} /></button>
            {emojiOpen && <div className='absolute bottom-full left-0 z-20 mb-2 flex rounded-lg border border-[#e5e7e9] bg-white p-1 shadow-sm' role='group' aria-label='Choose emoji' onKeyDown={(event) => { if (event.key === 'Escape') setEmojiOpen(false); }}>
              {['👋', '👍', '✅', '🎉', '💚'].map((emoji) => <button key={emoji} type='button' aria-label={'Insert ' + emoji} onClick={() => { onTextChange(composerText + emoji); setEmojiOpen(false); textareaRef.current?.focus(); }} className='flex h-8 w-8 items-center justify-center rounded text-base hover:bg-[#f1f3f2]'>{emoji}</button>)}
            </div>}
          </div>
          <button type='submit' disabled={!composerText.trim() || unavailable} aria-label='Send message' title='Send message' className='flex h-8 items-center justify-center gap-2 rounded-md bg-[#217a5b] px-3 text-xs font-medium text-white transition-colors hover:bg-[#196347] disabled:bg-[#eef1ef] disabled:text-[#a5ada7]'>
            <span className='hidden sm:inline'>{sendingMessage ? 'Sending' : 'Send'}</span>{sendingMessage ? <LoaderCircle className='h-4 w-4 animate-spin' /> : <SendHorizontal className='h-4 w-4' />}
          </button>
        </div>
      </form>
      <p className='mt-2 text-right text-[10px] leading-4 text-[#818781]'><span className='font-medium'>Enter</span> to send <span className='mx-1 text-[#c4c9c5]'>·</span><span className='font-medium'>Shift + Enter</span> for a new line</p>
    </div>
  );
};
