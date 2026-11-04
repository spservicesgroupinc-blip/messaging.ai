import React, { useState } from 'react';
import { SmilePlus } from 'lucide-react';

export interface ReactionsProps {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onToggle: (emoji: string) => void;
  quickEmojis?: string[];
}
export const Reactions: React.FC<ReactionsProps> = ({ reactions, currentUserId, onToggle, quickEmojis = ['👍', '✅', '🚀', '🎯'] }) => {
  const [showQuick, setShowQuick] = useState(false);
  return (
    <div className='relative flex flex-wrap items-center gap-1.5'>
      {Object.entries(reactions).filter(([, users]) => users.length > 0).map(([emoji, users]) => {
        const owned = users.includes(currentUserId);
        return (
          <button key={emoji} type='button' onClick={() => onToggle(emoji)} aria-label={`${emoji}, ${users.length} ${users.length === 1 ? 'reaction' : 'reactions'}`} aria-pressed={owned}
            className={`inline-flex h-7 items-center gap-1.5 rounded-full border px-2.5 text-xs transition-colors ${owned ? 'border-[#93c5fd] bg-[#eff6ff] text-[#1d4ed8]' : 'border-[#e2e8f0] bg-[#f8fafc] text-[#475569] hover:border-[#cbd5e1]'}`}>
            <span>{emoji}</span><span className='font-medium tabular-nums'>{users.length}</span>
          </button>
        );
      })}
      <button type='button' onClick={() => setShowQuick(!showQuick)} aria-label='Add reaction' aria-expanded={showQuick}
        className='flex h-7 w-7 items-center justify-center rounded-full border border-[#e5e7e9] text-[#72777d] hover:bg-[#f1f3f2]'>
        <SmilePlus className='h-3.5 w-3.5' />
      </button>
      {showQuick && (
        <div className='absolute bottom-full left-0 z-20 mb-2 flex gap-1 rounded-lg border border-[#e5e7e9] bg-white p-1 shadow-sm' role='group' aria-label='Choose a reaction' onKeyDown={(e) => { if (e.key === 'Escape') setShowQuick(false); }}>
          {quickEmojis.map((emoji) => <button key={emoji} type='button' aria-label={'React with ' + emoji} onClick={() => { onToggle(emoji); setShowQuick(false); }} className='flex h-8 w-8 items-center justify-center rounded text-base hover:bg-[#f1f3f2]'>{emoji}</button>)}
        </div>
      )}
    </div>
  );
};
