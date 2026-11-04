import React, { useState } from 'react';
import { Hash, Lock, Menu, RefreshCw, Search, Users, X } from 'lucide-react';
import { type SheetChannel } from '../utils/sheetsProtocol';

interface HeaderProps {
  activeChannel: SheetChannel | null;
  channelDisplayName: string;
  memberCount: number;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  onRefresh: () => void;
  syncing: boolean;
  isMembersDrawerOpen: boolean;
  onToggleMembers: () => void;
  onToggleMobileSidebar: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeChannel, channelDisplayName, memberCount, searchQuery, onSearchChange, onRefresh,
  syncing, isMembersDrawerOpen, onToggleMembers, onToggleMobileSidebar,
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const ChannelIcon = activeChannel?.dm_participants ? Users : activeChannel?.is_private ? Lock : Hash;

  return (
    <header className='relative z-10 shrink-0 border-b border-[#e5e7e5] bg-white'>
      <div className='flex h-16 items-center justify-between gap-3 px-4 sm:px-6'>
        <div className='flex min-w-0 flex-1 items-center gap-3'>
          <button type='button' onClick={onToggleMobileSidebar} aria-label='Open navigation sidebar'
            className='-ml-1 rounded-md p-1.5 text-[#64748b] hover:bg-[#f1f5f9] lg:hidden'>
            <Menu aria-hidden='true' className='h-5 w-5' />
          </button>
          <div className='hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#e2e8e3] bg-[#f6f8f6] sm:flex'>
            <ChannelIcon aria-hidden='true' className='h-5 w-5 text-[#62756a]' strokeWidth={1.75} />
          </div>
          <div className='min-w-0'>
            <h1 className='flex min-w-0 items-center gap-1.5 text-[16px] font-semibold tracking-tight text-[#242e28]'>
              <ChannelIcon aria-hidden='true' className='h-4 w-4 shrink-0 text-[#69776e] sm:hidden' />
              <span className='truncate'>{channelDisplayName}</span>
            </h1>
            <p className='mt-0.5 truncate text-xs text-[#72777d]'>
              {activeChannel?.description || (activeChannel?.dm_participants ? 'Your conversation, all in one place' : 'Keep the conversation moving')}
            </p>
          </div>
        </div>

        <div className='relative hidden min-w-0 max-w-64 flex-1 md:block'>
          <Search aria-hidden='true' className='pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-[#64748b]' strokeWidth={1.75} />
          <input type='search' aria-label='Search channel messages' value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)} placeholder='Search in this conversation'
            className='h-8 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-8 pr-3 text-xs text-[#475569] placeholder:text-[#94a3b8] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10' />
        </div>

        <div className='flex shrink-0 items-center gap-1.5'>
          <button type='button' aria-label={mobileSearchOpen ? 'Close message search' : 'Search channel messages'}
            aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={'rounded-md p-2 transition-colors md:hidden ' + (mobileSearchOpen ? 'bg-[#f1f5f9] text-[#2563eb]' : 'text-[#64748b] hover:bg-[#f1f5f9]')}>
            {mobileSearchOpen ? <X aria-hidden='true' className='h-4 w-4' /> : <Search aria-hidden='true' className='h-4 w-4' />}
          </button>
          <button type='button' onClick={onRefresh} disabled={syncing} aria-label={syncing ? 'Refreshing messages' : 'Refresh messages'} title='Refresh messages'
            className='rounded-md p-2 text-[#64748b] transition-colors hover:bg-[#f1f5f9] disabled:cursor-wait'>
            <RefreshCw aria-hidden='true' className={'h-4 w-4 ' + (syncing ? 'animate-spin text-[#2563eb]' : '')} strokeWidth={1.75} />
          </button>
          <div className='mx-1 h-5 w-px bg-[#e5e9e5]' aria-hidden='true' />
          <button type='button' onClick={onToggleMembers} aria-label={'View ' + memberCount + ' channel members'} aria-pressed={isMembersDrawerOpen}
            className={'flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors ' +
              (isMembersDrawerOpen ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#2563eb]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]')}>
            <Users aria-hidden='true' className='h-4 w-4' strokeWidth={1.75} />
            <span className='tabular-nums'>{memberCount}</span><span className='hidden xl:inline'>members</span>
          </button>
        </div>
      </div>
      {mobileSearchOpen && <div className='relative px-4 pb-3 md:hidden'>
        <Search aria-hidden='true' className='pointer-events-none absolute left-6 top-2.5 h-4 w-4 text-[#64748b]' />
        <input autoFocus type='search' aria-label='Search channel messages' value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setMobileSearchOpen(false); }}
          placeholder='Search in this conversation' className='h-9 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-8 pr-3 text-sm text-[#475569] placeholder:text-[#94a3b8] outline-none focus:border-[#94a3b8] focus:ring-2 focus:ring-[#2563eb]/10' />
      </div>}
    </header>
  );
};

