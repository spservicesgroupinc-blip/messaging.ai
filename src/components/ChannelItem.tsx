import React from 'react';
import { Hash, Lock } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { type PublicUser, type SheetChannel } from '../utils/sheetsProtocol';

interface ChannelItemProps {
  channel: SheetChannel;
  isActive: boolean;
  isDm?: boolean;
  currentUser?: PublicUser | null;
  workspaceUsers?: PublicUser[];
  onClick: (id: string) => void;
  onOpenDm?: (targetUserId: string) => void;
}

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel, isActive, currentUser, workspaceUsers = [], onClick, onOpenDm,
}) => {
  const isDmChannel = Boolean(channel.dm_participants);
  let dmPartner: PublicUser | undefined;
  let isDmYou = false;
  if (isDmChannel && currentUser) {
    const ids = channel.dm_participants!.split(',').map((id) => id.trim()).filter(Boolean);
    const partnerId = ids.find((id) => id !== currentUser.user_id) || currentUser.user_id;
    dmPartner = workspaceUsers.find((user) => user.user_id === partnerId);
    isDmYou = partnerId === currentUser.user_id;
  }

  return (
    <button
      type='button'
      onClick={() => isDmChannel && dmPartner && onOpenDm
        ? onOpenDm(dmPartner.user_id) : onClick(channel.channel_id)}
      aria-label={dmPartner ? dmPartner.full_name : channel.name}
      aria-current={isActive ? 'page' : undefined}
      className={'group flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1 text-left text-sm transition-colors ' +
        (isActive
          ? 'bg-[#e3eee8] font-semibold text-[#1c6349]'
          : 'font-normal text-[#5a625f] hover:bg-[#e9ece9] hover:text-[#252c29]')}
    >
      {isDmChannel && dmPartner ? (
        <Avatar userName={dmPartner.full_name} size='sm' className='!h-5 !w-5 shrink-0 !rounded-md !text-[9px]' />
      ) : channel.is_private ? (
        <Lock aria-hidden='true' className='h-4 w-4 shrink-0 opacity-70' strokeWidth={1.75} />
      ) : (
        <Hash aria-hidden='true' className='h-4 w-4 shrink-0 opacity-65' strokeWidth={1.75} />
      )}
      <span className='truncate'>{dmPartner ? dmPartner.full_name : channel.name}</span>
      {isDmYou && <span className='text-xs font-normal text-[#59665e]'>you</span>}
    </button>
  );
};

