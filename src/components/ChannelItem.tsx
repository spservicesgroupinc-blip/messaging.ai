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
  channel,
  isActive,
  isDm = false,
  currentUser,
  workspaceUsers = [],
  onClick,
  onOpenDm,
}) => {
  const isDmChannel = Boolean(channel.dm_participants);
  const isPrivate = channel.is_private && !isDmChannel;

  let dmPartner: PublicUser | undefined;
  let isDmYou = false;
  if (isDmChannel && currentUser && channel.dm_participants) {
    const ids = channel.dm_participants.split(',').map((s) => s.trim()).filter(Boolean);
    const partnerId = ids.find((id) => id !== currentUser.user_id) || currentUser.user_id;
    dmPartner = workspaceUsers.find((u) => u.user_id === partnerId);
    isDmYou = partnerId === currentUser.user_id;
  }

  const handleClick = () => {
    if (isDmChannel && dmPartner && onOpenDm) {
      onOpenDm(dmPartner.user_id);
    } else {
      onClick(channel.channel_id);
    }
  };

  return (
    <button
      type= button
      onClick={handleClick}
      aria-label={channel.name}
      className={lex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs font-medium transition-colors }
    >
      {isDmChannel && dmPartner ? (
        <Avatar userName={dmPartner.full_name} size=sm isOwn={isDmYou} className=h-5 w-5 text-[10px] shrink-0 />
      ) : (
        <>
          {isPrivate ? (
            <Lock className=h-3.5 w-3.5 shrink-0 opacity-80 />
          ) : (
            <Hash className=h-3.5 w-3.5 shrink-0 opacity-80 />
          )}
        </>
      )}
      <span className=truncate>
        {dmPartner ? dmPartner.full_name : channel.name}{isDmYou ? ' (you)' : ''}
      </span>
    </button>
  );
};
