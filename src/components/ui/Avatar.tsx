import React from 'react';

const AVATAR_COLORS = [
  'bg-[#dce8e3] text-[#365c4d]',
  'bg-[#e6e2ed] text-[#605074]',
  'bg-[#e9dfd3] text-[#795c3c]',
  'bg-[#dde7ee] text-[#405f76]',
  'bg-[#eedfdd] text-[#865751]',
  'bg-[#e4e7d9] text-[#5a653c]',
];
const AVATAR_SIZES = {
  sm: 'h-6 w-6 text-[10px]', md: 'h-9 w-9 text-xs',
  lg: 'h-10 w-10 text-sm', xl: 'h-12 w-12 text-base',
};
export interface AvatarProps {
  userName: string;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  isOwn?: boolean;
}
export const Avatar: React.FC<AvatarProps> = ({ userName, size = 'md', className = '', isOwn }) => {
  const name = userName?.trim() || 'Unknown user';
  const initials = name.split(/\s+/).map((part) => part.charAt(0).toUpperCase()).slice(0, 2).join('');
  let hash = 0;
  for (let i = 0; i < name.length; i++) hash = (name.charCodeAt(i) + ((hash << 5) - hash)) | 0;
  return (
    <div role='img' aria-label={name}
      className={`flex shrink-0 select-none items-center justify-center rounded-md font-semibold tracking-wide ${AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length]} ${AVATAR_SIZES[size]} ${isOwn ? 'ring-1 ring-[#2563eb]/30 ring-offset-1' : ''} ${className}`}>
      {initials}
    </div>
  );
};
