import React, { useState } from 'react';
import { ArrowLeft, Calendar, Hash, Lock, RefreshCw, Search, Users, X } from 'lucide-react';
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
  onToggleCalendar: () => void;
  isCalendarOpen: boolean;
  onBack: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  activeChannel, channelDisplayName, memberCount, searchQuery, onSearchChange, onRefresh,
  syncing, isMembersDrawerOpen, onToggleMembers, onToggleCalendar, isCalendarOpen, onBack,
}) => {
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const ChannelIcon = activeChannel?.dm_participants ? Users : activeChannel?.is_private ? Lock : Hash;

  return (
    <header className='relative z-10 shrink-0 border-b border-slate-200 bg-white'>
      <div className='flex h-14 items-center justify-between gap-1 px-2 sm:h-16 sm:gap-3 sm:px-6'>
        <div className='flex min-w-0 flex-1 items-center gap-1 sm:gap-3'>
          <button type='button' onClick={onBack} aria-label='Back to conversations'
            className='flex h-11 w-11 shrink-0 items-center justify-center rounded-md text-[#64748b] hover:bg-[#f1f5f9] lg:hidden'>
            <ArrowLeft aria-hidden='true' className='h-5 w-5' />
          </button>
          <div className='hidden h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-slate-200 bg-slate-50 sm:flex'>
            <ChannelIcon aria-hidden='true' className='h-5 w-5 text-slate-600' strokeWidth={1.75} />
          </div>
          <div className='min-w-0'>
            <h1 className='flex min-w-0 items-center gap-1.5 text-[16px] font-semibold tracking-tight text-slate-900'>
              <ChannelIcon aria-hidden='true' className='h-4 w-4 shrink-0 text-slate-500 sm:hidden' />
              <span className='truncate'>{channelDisplayName}</span>
            </h1>
            <p className='mt-0.5 truncate text-xs text-slate-600'>
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

        <div className='flex shrink-0 items-center gap-0 sm:gap-1.5'>
          <button type='button' aria-label={mobileSearchOpen ? 'Close message search' : 'Search channel messages'}
            aria-expanded={mobileSearchOpen} onClick={() => setMobileSearchOpen(!mobileSearchOpen)}
            className={'flex h-11 w-11 items-center justify-center rounded-md transition-colors md:hidden ' + (mobileSearchOpen ? 'bg-[#f1f5f9] text-[#2563eb]' : 'text-[#64748b] hover:bg-[#f1f5f9]')}>
            {mobileSearchOpen ? <X aria-hidden='true' className='h-4 w-4' /> : <Search aria-hidden='true' className='h-4 w-4' />}
          </button>
          <button type='button' onClick={onRefresh} disabled={syncing} aria-label={syncing ? 'Refreshing messages' : 'Refresh messages'} title='Refresh messages'
            className='flex h-11 w-11 items-center justify-center rounded-md text-[#64748b] transition-colors hover:bg-[#f1f5f9] disabled:cursor-wait sm:h-8 sm:w-8'>
            <RefreshCw aria-hidden='true' className={'h-4 w-4 ' + (syncing ? 'animate-spin text-[#2563eb]' : '')} strokeWidth={1.75} />
          </button>
          <div className='mx-1 hidden h-5 w-px bg-[#e5e9e5] sm:block' aria-hidden='true' />
          <button type='button' onClick={onToggleMembers} aria-label={'View ' + memberCount + ' channel members'} aria-pressed={isMembersDrawerOpen}
            className={'flex h-11 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors sm:h-8 sm:gap-2 sm:px-2.5 ' +
              (isMembersDrawerOpen ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#2563eb]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]')}>
            <Users aria-hidden='true' className='h-4 w-4' strokeWidth={1.75} />
            <span className='tabular-nums'>{memberCount}</span><span className='hidden xl:inline'>members</span>
          </button>
          <button type='button' onClick={onToggleCalendar} aria-label={isCalendarOpen ? 'Close calendar' : 'View calendar events'} aria-pressed={isCalendarOpen}
            className={'flex h-11 items-center gap-1.5 rounded-md border px-2 text-xs font-medium transition-colors sm:h-8 sm:gap-2 sm:px-2.5 ' +
              (isCalendarOpen ? 'border-[#cbd5e1] bg-[#f1f5f9] text-[#2563eb]' : 'border-[#e2e8f0] text-[#64748b] hover:bg-[#f8fafc]')}>
            <Calendar aria-hidden='true' className='h-4 w-4' strokeWidth={1.75} />
            <span className='hidden sm:inline'>Calendar</span>
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

