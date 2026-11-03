import React, { useState } from 'react';
import { ThumbsUp, Smile } from 'lucide-react';

export interface ReactionsProps {
  reactions: Record<string, string[]>;
  currentUserId: string;
  onToggle: (emoji: string) => void;
  quickEmojis?: string[];
}

export const Reactions: React.FC<ReactionsProps> = ({
  reactions,
  currentUserId,
  onToggle,
  quickEmojis = ['??', '??', '??', '??', '??', '??'],
}) => {
  const [showQuick, setShowQuick] = useState(false);

  const emojis = Object.keys(reactions);

  const isOwn = (emoji: string) => reactions[emoji]?.includes(currentUserId) ?? false;

  return (
    <div
      className="flex items-center gap-1 px-2 py-1 rounded-lg transition-colors"
      onMouseEnter={() => setShowQuick(true)}
      onMouseLeave={() => setShowQuick(false)}
    >
      {emojis.map((emoji) => {
        const count = reactions[emoji]?.length ?? 0;
        const owned = isOwn(emoji);
        return (
          <button
            key={emoji}
            type="button"
            onClick={() => onToggle(emoji)}
            aria-pressed={owned}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
              owned
                ? 'bg-blue-100 text-blue-700 border border-blue-200'
                : 'bg-slate-200 text-slate-600 border-transparent hover:bg-slate-300'
            }`}
          >
            <span>{emoji}</span>
            <span>{count}</span>
          </button>
        );
      })}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          setShowQuick(!showQuick);
        }}
        className="inline-flex items-center justify-center rounded-md p-1 text-slate-400 hover:bg-slate-200 transition-colors"
        aria-label="Add reaction"
      >
        <Smile className="h-4 w-4" />
      </button>

      {showQuick && (
        <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 flex flex-wrap gap-1.5 rounded-lg bg-white p-1.5 border border-slate-200 shadow-sm z-10">
          {quickEmojis.map((emoji) => (
            <button
              key={emoji}
              type="button"
              onClick={() => onToggle(emoji)}
              className="inline-flex items-center justify-center rounded p-1 text-lg transition-colors hover:bg-slate-100"
              aria-label={emoji}
            >
              {emoji}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};
