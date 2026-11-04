import React, { useEffect, useRef, useState } from 'react';
import {
  Check,
  Copy,
  Hash,
  Lock,
  MoreHorizontal,
  Pencil,
  Trash2,
  Users,
} from 'lucide-react';
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
  onEditChannel?: (channel: SheetChannel) => void;
  onDeleteChannel?: (channel: SheetChannel) => void;
  onManageMembers?: (channel: SheetChannel) => void;
}

export const ChannelItem: React.FC<ChannelItemProps> = ({
  channel,
  isActive,
  currentUser,
  workspaceUsers = [],
  onClick,
  onOpenDm,
  onEditChannel,
  onDeleteChannel,
  onManageMembers,
}) => {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copied, setCopied] = useState(false);
  const menuContainerRef = useRef<HTMLDivElement>(null);
  const closeTimeoutRef = useRef<number | null>(null);

  const isDmChannel = Boolean(channel.dm_participants);
  let dmPartner: PublicUser | undefined;
  let isDmYou = false;
  if (isDmChannel && currentUser) {
    const ids = channel.dm_participants!
      .split(',')
      .map((id) => id.trim())
      .filter(Boolean);
    const partnerId =
      ids.find((id) => id !== currentUser.user_id) || currentUser.user_id;
    dmPartner = workspaceUsers.find((user) => user.user_id === partnerId);
    isDmYou = partnerId === currentUser.user_id;
  }

  useEffect(() => {
    if (!menuOpen) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (
        menuContainerRef.current &&
        !menuContainerRef.current.contains(event.target as Node)
      ) {
        setMenuOpen(false);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [menuOpen]);

  useEffect(() => {
    return () => {
      if (closeTimeoutRef.current) {
        window.clearTimeout(closeTimeoutRef.current);
      }
    };
  }, []);

  const clearCloseTimer = () => {
    if (closeTimeoutRef.current) {
      window.clearTimeout(closeTimeoutRef.current);
      closeTimeoutRef.current = null;
    }
  };

  const scheduleCloseMenu = () => {
    clearCloseTimer();
    closeTimeoutRef.current = window.setTimeout(() => {
      setMenuOpen(false);
    }, 180);
  };

  const handleCopyChannelName = async (e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(`#${channel.name}`);
      setCopied(true);
      window.setTimeout(() => {
        setCopied(false);
        setMenuOpen(false);
      }, 600);
    } catch {
      setMenuOpen(false);
    }
  };

  const hasChannelActions = !isDmChannel && (onEditChannel || onDeleteChannel);

  return (
    <div
      ref={menuContainerRef}
      onMouseLeave={() => {
        if (menuOpen) scheduleCloseMenu();
      }}
      onMouseEnter={clearCloseTimer}
      className={
        'group relative flex min-h-8 w-full items-center rounded-md transition-colors ' +
        (isActive
          ? 'bg-[#dbeafe] text-[#1d4ed8]'
          : 'text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#0f172a]')
      }
    >
      <button
        type='button'
        onClick={() =>
          isDmChannel && dmPartner && onOpenDm
            ? onOpenDm(dmPartner.user_id)
            : onClick(channel.channel_id)
        }
        aria-label={dmPartner ? dmPartner.full_name : channel.name}
        aria-current={isActive ? 'page' : undefined}
        className={
          'flex min-h-8 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1 text-left text-sm ' +
          (hasChannelActions ? 'pr-8 ' : '') +
          (isActive ? 'font-semibold' : 'font-normal')
        }
      >
        {isDmChannel && dmPartner ? (
          <Avatar
            userName={dmPartner.full_name}
            size='sm'
            className='!h-5 !w-5 shrink-0 !rounded-md !text-[9px]'
          />
        ) : channel.is_private ? (
          <Lock
            aria-hidden='true'
            className='h-4 w-4 shrink-0 opacity-70'
            strokeWidth={1.75}
          />
        ) : (
          <Hash
            aria-hidden='true'
            className='h-4 w-4 shrink-0 opacity-65'
            strokeWidth={1.75}
          />
        )}
        <span className='truncate'>
          {dmPartner ? dmPartner.full_name : channel.name}
        </span>
        {isDmYou && (
          <span className='text-xs font-normal text-[#59665e]'>you</span>
        )}
      </button>

      {hasChannelActions && (
        <div
          className='absolute right-1 flex items-center'
          onMouseEnter={() => {
            clearCloseTimer();
            setMenuOpen(true);
          }}
        >
          <button
            type='button'
            aria-label={`Channel options for ${channel.name}`}
            aria-haspopup='menu'
            aria-expanded={menuOpen}
            onClick={(e) => {
              e.stopPropagation();
              clearCloseTimer();
              setMenuOpen(true);
            }}
            className={
              'flex h-6 w-6 items-center justify-center rounded text-[#64748b] transition-opacity hover:bg-[#f1f5f9] hover:text-[#0f172a] focus:opacity-100 ' +
              (menuOpen
                ? 'bg-[#d5ded8] text-[#1f2924] opacity-100'
                : 'opacity-0 group-hover:opacity-100')
            }
          >
            <MoreHorizontal className='h-4 w-4' />
          </button>

          {menuOpen && (
            <div
              role='menu'
              aria-label={`Actions for #${channel.name}`}
              onMouseEnter={clearCloseTimer}
              onMouseLeave={scheduleCloseMenu}
              className='absolute top-full right-0 z-50 mt-1 w-44 rounded-lg border border-[#dce2dd] bg-white py-1 shadow-lg'
            >
              {onEditChannel && (
                <button
                  type='button'
                  role='menuitem'
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onEditChannel(channel);
                  }}
                  className='flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs font-medium text-[#2c3530] transition-colors hover:bg-[#f2f5f3]'
                >
                  <Pencil className='h-3.5 w-3.5 text-[#64748b]' />
                  <span>Edit channel</span>
                </button>
              )}

              {onManageMembers && (
                <button
                  type='button'
                  role='menuitem'
                  onClick={(e) => {
                    e.stopPropagation();
                    setMenuOpen(false);
                    onManageMembers(channel);
                  }}
                  className='flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs font-medium text-[#2c3530] transition-colors hover:bg-[#f2f5f3]'
                >
                  <Users className='h-3.5 w-3.5 text-[#64748b]' />
                  <span>Manage members</span>
                </button>
              )}

              <button
                type='button'
                role='menuitem'
                onClick={handleCopyChannelName}
                className='flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs font-medium text-[#2c3530] transition-colors hover:bg-[#f2f5f3]'
              >
                {copied ? (
                  <Check className='h-3.5 w-3.5 text-[#2563eb]' />
                ) : (
                  <Copy className='h-3.5 w-3.5 text-[#64748b]' />
                )}
                <span>{copied ? 'Copied name' : 'Copy channel name'}</span>
              </button>

              {onDeleteChannel && (
                <>
                  <div className='my-1 border-t border-[#ebf0ec]' />
                  <button
                    type='button'
                    role='menuitem'
                    onClick={(e) => {
                      e.stopPropagation();
                      setMenuOpen(false);
                      onDeleteChannel(channel);
                    }}
                    className='flex w-full items-center gap-2.5 px-3 py-1.5 text-left text-xs font-medium text-red-600 transition-colors hover:bg-red-50'
                  >
                    <Trash2 className='h-3.5 w-3.5 text-red-600' />
                    <span>Delete channel</span>
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};
