import React, { useEffect, useRef, useState } from 'react';
import { ChevronDown, ChevronRight, Lock, LogOut, Plus, SquarePen, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { ChannelItem } from './ChannelItem';
import { type PublicUser, type SheetChannel } from '../utils/sheetsProtocol';

interface SidebarProps {
  currentUser: PublicUser;
  workspaceUsers: PublicUser[];
  publicChannels: SheetChannel[];
  privateChannels: SheetChannel[];
  directMessageChannels?: SheetChannel[];
  activeChannelId: string | null;
  mobileSidebarOpen: boolean;
  onSelectChannel: (id: string) => void;
  onOpenDirectMessage: (id: string) => void;
  onCreateChannel: (isPrivate: boolean) => void;
  onEditChannel?: (channel: SheetChannel) => void;
  onDeleteChannel?: (channel: SheetChannel) => void;
  onManageChannelMembers?: (channel: SheetChannel) => void;
  onSignOut: () => void;
  onToggleMobileSidebar: () => void;
}

function NavigationSection({ title, children, onAdd, addLabel }: {
  title: string; children: React.ReactNode; onAdd?: () => void; addLabel?: string;
}) {
  const [expanded, setExpanded] = useState(true);
  const contentId = React.useId();
  return (
    <section>
      <div className='mb-1 flex h-8 items-center justify-between px-1'>
        <button type='button' onClick={() => setExpanded(!expanded)} aria-expanded={expanded} aria-controls={contentId}
          className='flex min-w-0 items-center gap-1.5 rounded px-1 py-1 text-xs font-semibold text-[#64748b] hover:text-[#475569]'>
          {expanded ? <ChevronDown aria-hidden='true' className='h-3 w-3' /> : <ChevronRight aria-hidden='true' className='h-3 w-3' />}
          {title}
        </button>
        {onAdd && <button type='button' onClick={onAdd} aria-label={addLabel} title={addLabel}
          className='rounded p-1.5 text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#475569]'>
          <Plus aria-hidden='true' className='h-3.5 w-3.5' />
        </button>}
      </div>
      <div id={contentId} hidden={!expanded} className='space-y-0.5'>{children}</div>
    </section>
  );
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentUser,
  workspaceUsers,
  publicChannels,
  privateChannels,
  directMessageChannels = [],
  activeChannelId,
  mobileSidebarOpen,
  onSelectChannel,
  onOpenDirectMessage,
  onCreateChannel,
  onEditChannel,
  onDeleteChannel,
  onManageChannelMembers,
  onSignOut,
  onToggleMobileSidebar,
}) => {
  const sidebarRef = useRef<HTMLElement>(null);
  const toggleMobileRef = useRef(onToggleMobileSidebar);
  toggleMobileRef.current = onToggleMobileSidebar;

  useEffect(() => {
    if (!mobileSidebarOpen) return;
    const desktopMedia = window.matchMedia('(min-width: 1024px)');
    if (desktopMedia.matches) return;
    const previousFocus = document.activeElement as HTMLElement | null;
    sidebarRef.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const onViewportChange = (event: MediaQueryListEvent) => {
      if (event.matches) toggleMobileRef.current();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (desktopMedia.matches) return;
      if (event.key === 'Escape') toggleMobileRef.current();
      if (event.key !== 'Tab') return;
      const controls = sidebarRef.current?.querySelectorAll<HTMLElement>('button:not([disabled]), [href], input');
      const focusable = controls ? Array.from(controls).filter((control) => control.getClientRects().length) : [];
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    desktopMedia.addEventListener('change', onViewportChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      desktopMedia.removeEventListener('change', onViewportChange);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, [mobileSidebarOpen]);

  return (
    <>
      {mobileSidebarOpen && <button type='button' aria-label='Close navigation sidebar'
        className='fixed inset-0 z-30 bg-[#17231e]/35 backdrop-blur-[2px] lg:hidden' onClick={onToggleMobileSidebar} />}
      <aside ref={sidebarRef} aria-label='Workspace navigation'
        className={'workspace-sidebar fixed inset-y-0 left-0 z-40 flex w-[252px] shrink-0 flex-col border-r border-[#e5e7e5] bg-[#f5f6f5] transition-transform lg:static lg:translate-x-0 ' +
          (mobileSidebarOpen ? 'visible translate-x-0' : 'invisible -translate-x-full lg:visible')}>
        <div className='flex h-16 shrink-0 items-center justify-between gap-2 border-b border-[#e5e7e5] px-4'>
          <div className='flex min-w-0 items-center gap-2.5'>
            <div aria-hidden='true' className='flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-[#243d32] text-base font-bold text-white'>R<span className='text-[#9bcbaf]'>.</span></div>
            <div className='min-w-0'>
              <div className='truncate text-[15px] font-semibold tracking-tight text-[#242e28]'>Relay Workspace</div>
              <div className='mt-0.5 text-[11px] text-[#626d65]'>A place for your team</div>
            </div>
          </div>
          <button type='button' aria-label='Close navigation sidebar' onClick={onToggleMobileSidebar}
            className='rounded p-1.5 text-[#626d65] hover:bg-[#e6eae6] lg:hidden'><X className='h-4 w-4' /></button>
        </div>

        <nav aria-label='Channels and conversations' className='min-h-0 flex-1 space-y-5 overflow-y-auto px-3 pb-5 pt-4'>
          <button type='button' onClick={() => onCreateChannel(false)}
            className='mb-1 flex h-9 w-full items-center gap-2.5 rounded-md border border-[#dce2dd] bg-white px-2.5 text-sm font-medium text-[#3d4941] transition-colors hover:border-[#b8c8bd] hover:bg-[#fcfdfc]'>
            <SquarePen aria-hidden='true' className='h-4 w-4 text-[#657269]' strokeWidth={1.75} />
            New channel
            <Plus aria-hidden='true' className='ml-auto h-3.5 w-3.5 text-[#89928b]' />
          </button>
          <NavigationSection title='Channels' onAdd={() => onCreateChannel(false)} addLabel='Create new channel'>
            {publicChannels.map((channel) => (
              <ChannelItem
                key={channel.channel_id}
                channel={channel}
                isActive={channel.channel_id === activeChannelId}
                onClick={onSelectChannel}
                onEditChannel={onEditChannel}
                onDeleteChannel={onDeleteChannel}
                onManageMembers={onManageChannelMembers}
              />
            ))}
            {publicChannels.length === 0 && <p className='px-2.5 py-1 text-xs text-[#626d65]'>No channels yet</p>}
          </NavigationSection>
          <NavigationSection title='Private channels' onAdd={() => onCreateChannel(true)} addLabel='Create private channel'>
            {privateChannels.map((channel) => (
              <ChannelItem
                key={channel.channel_id}
                channel={channel}
                isActive={channel.channel_id === activeChannelId}
                onClick={onSelectChannel}
                onEditChannel={onEditChannel}
                onDeleteChannel={onDeleteChannel}
                onManageMembers={onManageChannelMembers}
              />
            ))}
            {privateChannels.length === 0 && <button type='button' onClick={() => onCreateChannel(true)}
              className='flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 text-left text-sm text-[#64748b] hover:bg-[#f1f5f9] hover:text-[#475569]'>
              <Lock aria-hidden='true' className='h-4 w-4 opacity-65' strokeWidth={1.75} /> Create private channel
            </button>}
          </NavigationSection>
          <NavigationSection title='Direct messages'>
            {workspaceUsers.map((user) => {
              const participantKey = [currentUser.user_id, user.user_id].sort().join(',');
              const dmChannel = directMessageChannels.find((channel) => channel.dm_participants === participantKey) || {
                channel_id: 'dm-' + user.user_id, name: user.full_name, description: '', is_private: true,
                created_by: currentUser.user_id, created_at: '', dm_participants: participantKey,
              };
              return <ChannelItem key={user.user_id} channel={dmChannel} isDm
                isActive={dmChannel.channel_id === activeChannelId} currentUser={currentUser}
                workspaceUsers={workspaceUsers} onClick={() => onOpenDirectMessage(user.user_id)} onOpenDm={onOpenDirectMessage} />;
            })}
          </NavigationSection>
        </nav>

        <div className='flex shrink-0 items-center gap-2.5 border-t border-[#e1e5e1] p-3.5'>
          <Avatar userName={currentUser.full_name} size='md' className='shrink-0 !rounded-lg' />
          <div className='min-w-0 flex-1'>
            <div className='truncate text-xs font-semibold text-[#475569]'>{currentUser.full_name}</div>
            <div className='mt-0.5 truncate text-[11px] text-[#626d65]'>{currentUser.role_title || currentUser.email}</div>
          </div>
          <button type='button' onClick={onSignOut} aria-label='Sign out' title='Sign out'
            className='rounded-md p-2 text-[#64748b] transition-colors hover:bg-[#f1f5f9] hover:text-[#475569]'>
            <LogOut aria-hidden='true' className='h-4 w-4' strokeWidth={1.75} />
          </button>
        </div>
      </aside>
    </>
  );
};
