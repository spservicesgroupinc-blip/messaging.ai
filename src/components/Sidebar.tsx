import React from 'react';
import { Hash, Lock, LogOut, Menu, Plus } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { ChannelItem } from './ChannelItem';
import { type PublicUser, type SheetChannel } from '../utils/sheetsProtocol';

interface SidebarProps {
  currentUser: PublicUser;
  workspaceUsers: PublicUser[];
  publicChannels: SheetChannel[];
  privateChannels: SheetChannel[];
  activeChannelId: string | null;
  mobileSidebarOpen: boolean;
  onSelectChannel: (id: string) => void;
  onOpenDirectMessage: (id: string) => void;
  onCreateChannel: (isPrivate: boolean) => void;
  onSignOut: () => void;
  onToggleMobileSidebar: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  workspaceUsers,
  publicChannels,
  privateChannels,
  activeChannelId,
  mobileSidebarOpen,
  onSelectChannel,
  onOpenDirectMessage,
  onCreateChannel,
  onSignOut,
  onToggleMobileSidebar,
}) => {
  return (
    <>
      {mobileSidebarOpen && (
        <div className='fixed inset-0 z-30 bg-slate-950/50 lg:hidden' onClick={onToggleMobileSidebar} />
      )}

      <aside
        aria-label='Workspace navigation'
        className={
          'fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 flex-col border-r border-slate-800 bg-slate-900 text-slate-300 transition-transform lg:static lg:translate-x-0 ' +
          (mobileSidebarOpen ? 'translate-x-0' : '-translate-x-full')
        }
      >
        <div className='flex items-center justify-between border-b border-slate-800 px-4 py-3.5'>
          <div className='min-w-0'>
            <div className='truncate text-sm font-bold tracking-tight text-white'>
              Relay Workspace
            </div>
            <div className='truncate text-xs text-slate-400'>
              {currentUser.role_title || 'Team Member'}
            </div>
          </div>
        </div>

        <div className='flex-1 space-y-6 overflow-y-auto px-3 py-4'>
          <div>
            <div className='flex items-center justify-between px-2 pb-1.5'>
              <span className='text-xs font-semibold text-slate-400'>Channels</span>
              <button
                type='button'
                onClick={() => onCreateChannel(false)}
                aria-label='Create new channel'
                className='rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white'
              >
                <Plus className='h-3.5 w-3.5' />
              </button>
            </div>
            <div className='space-y-0.5'>
              {publicChannels.map((ch) => (
                <ChannelItem
                  key={ch.channel_id}
                  channel={ch}
                  isActive={ch.channel_id === activeChannelId}
                  onClick={onSelectChannel}
                />
              ))}
            </div>
          </div>

          <div>
            <div className='flex items-center justify-between px-2 pb-1.5'>
              <span className='text-xs font-semibold text-slate-400'>Private Channels</span>
              {privateChannels.length === 0 ? (
                <button
                  type='button'
                  onClick={() => onCreateChannel(true)}
                  className='flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-xs text-slate-400 transition-colors hover:bg-slate-800/60 hover:text-slate-200'
                >
                  <Lock className='h-3.5 w-3.5 shrink-0 opacity-70' />
                  <span>Add private channel...</span>
                </button>
              ) : (
                <button
                  type='button'
                  onClick={() => onCreateChannel(true)}
                  aria-label='Create private channel'
                  className='rounded p-1 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white'
                >
                  <Plus className='h-3.5 w-3.5' />
                </button>
              )}
            </div>
            {privateChannels.length > 0 && (
              <div className='space-y-0.5'>
                {privateChannels.map((ch) => (
                  <ChannelItem
                    key={ch.channel_id}
                    channel={ch}
                    isActive={ch.channel_id === activeChannelId}
                    onClick={onSelectChannel}
                  />
                ))}
              </div>
            )}
          </div>

          <div>
            <div className='flex items-center justify-between px-2 pb-1.5'>
              <span className='text-xs font-semibold text-slate-400'>Direct Messages</span>
              <span className='font-mono text-xs tabular-nums text-slate-500'>
                {workspaceUsers.length}
              </span>
            </div>
            <div className='space-y-0.5'>
              {workspaceUsers.map((u) => {
                const dmChannel: SheetChannel = {
                  channel_id: 'dm-' + u.user_id,
                  name: u.full_name,
                  description: '',
                  is_private: true,
                  created_by: currentUser.user_id,
                  created_at: '',
                  dm_participants: [currentUser.user_id, u.user_id].sort().join(','),
                };
                const isActiveDm = activeChannelId === dmChannel.channel_id;
                return (
                  <ChannelItem
                    key={u.user_id}
                    channel={dmChannel}
                    isDm
                    isActive={isActiveDm}
                    currentUser={currentUser}
                    workspaceUsers={workspaceUsers}
                    onClick={() => onOpenDirectMessage(u.user_id)}
                    onOpenDm={onOpenDirectMessage}
                  />
                );
              })}
            </div>
          </div>
        </div>

        <div className='border-t border-slate-800 bg-slate-950/50 p-3'>
          <div className='flex items-center justify-between gap-2'>
            <div className='flex min-w-0 items-center gap-2.5'>
              <Avatar userName={currentUser.full_name} size='md' className='h-8 w-8 shrink-0' />
              <div className='min-w-0'>
                <div className='truncate text-xs font-semibold text-white'>
                  {currentUser.full_name}
                </div>
                <div className='truncate text-[11px] text-slate-400'>
                  {currentUser.email}
                </div>
              </div>
            </div>
            <button
              type='button'
              onClick={onSignOut}
              aria-label='Sign out'
              title='Sign out'
              className='rounded-lg p-1.5 text-slate-400 transition-colors hover:bg-slate-800 hover:text-white'
            >
              <LogOut className='h-4 w-4' />
            </button>
          </div>
        </div>
      </aside>
    </>
  );
};
