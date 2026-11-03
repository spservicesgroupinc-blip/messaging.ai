import React from 'react';

const AVATAR_COLORS: string[] = [
  'bg-blue-500',
  'bg-purple-500',
  'bg-pink-500',
  'bg-orange-500',
  'bg-yellow-500',
  'bg-green-500',
  'bg-red-500',
  'bg-indigo-500',
];

const AVATAR_SIZES: Record<string, string> = {
  sm: 'h-6 w-6 text-xs',
  md: 'h-8 w-8 text-sm',
  lg: 'h-10 w-10 text-base',
  xl: 'h-12 w-12 text-lg',
};

export interface AvatarProps {
  userName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isOwn?: boolean;
}

export const Avatar: React.FC<AvatarProps> = ({
  userName,
  size = 'md',
  className,
  isOwn,
}) => {
  if (!userName || userName.trim().length === 0) {
    return null;
  }

  const initials = userName
    .trim()
    .split(/\s+/)
    .map((part) => part.charAt(0).toUpperCase())
    .slice(0, 2)
    .join('');

  let hash = 0;
  for (let i = 0; i < userName.length; i++) {
    hash = userName.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash;
  }
  const colorClass = AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];

  return (
    <div
      className={`flex items-center justify-center rounded-full ${colorClass} text-white font-semibold shadow-sm ${
        AVATAR_SIZES[size]
      } ${className ?? ''} ${isOwn ? 'ring-2 ring-offset-1 ring-blue-600' : ''}`}
      aria-label={userName}
    >
      {initials}
    </div>
  );
};
