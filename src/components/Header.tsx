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
            className='-ml-1 rounded-md p-1.5 text-[#637067] hover:bg-[#f0f3f0] lg:hidden'>
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
          <Search aria-hidden='true' className='pointer-events-none absolute left-2.5 top-2 h-4 w-4 text-[#69736c]' strokeWidth={1.75} />
          <input type='search' aria-label='Search channel messages' value={searchQuery}
            onChange={(event) => onSearchChange(event.target.value)} placeholder='Search in this conversation'
            className='h-8 w-full rounded-md border border-[#e4e8e4] bg-[#f8f9f8] pl-8 pr-3 text-xs text-[#303934] placeholder:text-[#69736c] focus:border-[#82ab94] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#217a5b]/10' />
        </div>

        <div className='flex shrink-0 items-center gap-1.5'>
          <button type='button' aria-label={mobileSearchOpen ? 'Close message search' : 'Search channel messages'}
            aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={'rounded-md p-2 transition-colors md:hidden ' + (mobileSearchOpen ? 'bg-[#e6f0e9] text-[#217a5b]' : 'text-[#737e76] hover:bg-[#f0f3f0]')}>
            {mobileSearchOpen ? <X aria-hidden='true' className='h-4 w-4' /> : <Search aria-hidden='true' className='h-4 w-4' />}
          </button>
          <button type='button' onClick={onRefresh} disabled={syncing} aria-label={syncing ? 'Refreshing messages' : 'Refresh messages'} title='Refresh messages'
            className='rounded-md p-2 text-[#737e76] transition-colors hover:bg-[#f0f3f0] disabled:cursor-wait'>
            <RefreshCw aria-hidden='true' className={'h-4 w-4 ' + (syncing ? 'animate-spin text-[#217a5b]' : '')} strokeWidth={1.75} />
          </button>
          <div className='mx-1 h-5 w-px bg-[#e5e9e5]' aria-hidden='true' />
          <button type='button' onClick={onToggleMembers} aria-label={'View ' + memberCount + ' channel members'} aria-pressed={isMembersDrawerOpen}
            className={'flex h-8 items-center gap-2 rounded-md border px-2.5 text-xs font-medium transition-colors ' +
              (isMembersDrawerOpen ? 'border-[#bad5c5] bg-[#edf5ef] text-[#217a5b]' : 'border-[#e2e7e2] text-[#5c6a60] hover:bg-[#f5f7f5]')}>
            <Users aria-hidden='true' className='h-4 w-4' strokeWidth={1.75} />
            <span className='tabular-nums'>{memberCount}</span><span className='hidden xl:inline'>members</span>
          </button>
        </div>
      </div>
      {mobileSearchOpen && <div className='relative px-4 pb-3 md:hidden'>
        <Search aria-hidden='true' className='pointer-events-none absolute left-6 top-2.5 h-4 w-4 text-[#69736c]' />
        <input autoFocus type='search' aria-label='Search channel messages' value={searchQuery}
          onChange={(event) => onSearchChange(event.target.value)} onKeyDown={(event) => { if (event.key === 'Escape') setMobileSearchOpen(false); }}
          placeholder='Search in this conversation' className='h-9 w-full rounded-md border border-[#dbe4dd] bg-[#f8faf8] pl-8 pr-3 text-sm text-[#303934] placeholder:text-[#69736c] outline-none focus:border-[#82ab94] focus:ring-2 focus:ring-[#217a5b]/10' />
      </div>}
    </header>
  );
};

