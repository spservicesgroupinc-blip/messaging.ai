import React from 'react';
import { Code, Send } from 'lucide-react';
import { Button } from './ui/Button';
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

export const Composer: React.FC<ComposerProps> = ({
  currentUser,
  activeChannelId,
  activeChannel,
  composerText,
  onTextChange,
  onSend,
  sendingMessage,
  composerError,
  onFormatInsert,
}) => {
  const channelPlaceholder = activeChannel?.dm_participants
    ? 'Direct Message'
    : activeChannel
    ? '#' + activeChannel.name
    : '';

  return (
    <div className='border-t border-slate-200 bg-white px-4 py-3.5 sm:px-6'>
      {composerError && (
        <div
          role='alert'
          className='mb-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800'
        >
          {composerError}
        </div>
      )}

      <form
        onSubmit={onSend}
        className='overflow-hidden rounded-xl border border-slate-300 bg-white focus-within:border-blue-600'
      >
        <div className='flex items-center justify-between border-b border-slate-100 bg-slate-50 px-3 py-1.5'>
          <div className='flex items-center gap-1'>
            <button
              type='button'
              onClick={() => onFormatInsert('`')}
              aria-label='Insert inline code'
              className='flex items-center gap-1 rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-200/60 hover:text-slate-900'
            >
              <Code className='h-3.5 w-3.5' />
              <span>Code</span>
            </button>
          </div>
          <div className='text-[11px] text-slate-500'>
            Press <kbd className='font-mono font-semibold'>Enter</kbd> to send
          </div>
        </div>

        <div className='flex items-end gap-2 p-2.5'>
          <textarea
            rows={2}
            aria-label='Message input'
            value={composerText}
            onChange={(e) => onTextChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                void onSend();
              }
            }}
            placeholder={'Message ' + channelPlaceholder}
            className='max-h-36 min-h-[44px] flex-1 resize-none bg-transparent px-1.5 py-1 text-sm text-slate-900 placeholder:text-slate-400 focus:outline-none'
          />
          <Button
            type='submit'
            disabled={!composerText.trim() || sendingMessage}
            aria-label='Send message'
            className='whitespace-nowrap shrink-0'
          >
            <span>Send</span>
            <Send className='h-3.5 w-3.5' />
          </Button>
        </div>
      </form>
    </div>
  );
};
