import React from 'react';
import { Hash, Lock, Menu, RefreshCw, Search, Users } from 'lucide-react';
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
  activeChannel,
  channelDisplayName,
  memberCount,
  searchQuery,
  onSearchChange,
  onRefresh,
  syncing,
  isMembersDrawerOpen,
  onToggleMembers,
  onToggleMobileSidebar,
}) => (
  <header className= flex h-14 shrink-0 items-center justify-between gap-4 border-b border-slate-200 bg-white px-4 sm:px-6>
    {/* Left: Channel Breadcrumb & Metadata */}
    <div className=flex min-w-0 items-center gap-3>
      <button
        type=button
        onClick={onToggleMobileSidebar}
        aria-label=Open navigation sidebar
        className=rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 lg:hidden
      >
        <Menu className=h-5 w-5 />
      </button>

      <div className=min-w-0>
        <div className=flex items-center gap-1.5>
          {activeChannel?.dm_participants ? (
            <Users className=h-4 w-4 shrink-0 text-slate-600 />
          ) : activeChannel?.is_private ? (
            <Lock className=h-4 w-4 shrink-0 text-slate-700 />
          ) : (
            <Hash className=h-4 w-4 shrink-0 text-slate-600 />
          )}
          <h1 className=truncate text-sm font-bold text-slate-900>
            {channelDisplayName}
          </h1>
          <span aria-hidden=true className=text-slate-300>
            &middot;
          </span>
          <span className=font-mono text-xs tabular-nums text-slate-500 whitespace-nowrap shrink-0>
            {memberCount}
            {memberCount === 1 ? ' member' : ' members'}
          </span>
        </div>
        {activeChannel?.description && (
          <p className=hidden truncate text-xs text-slate-500 sm:block>
            {activeChannel.description}
          </p>
        )}
      </div>
    </div>

    {/* Center: Search Messages */}
    <div className=relative hidden w-64 md:block>
      <Search className=pointer-events-none absolute top-2 left-2.5 h-3.5 w-3.5 text-slate-400 />
      <input
        type=search
        aria-label=Search channel messages
        value={searchQuery}
        onChange={(e) => onSearchChange(e.target.value)}
        placeholder=Filter messages...
        className=w-full rounded-lg border border-slate-200 bg-slate-50 py-1.5 pr-3 pl-8 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:bg-white focus:outline-none
      />
    </div>

    {/* Right: Actions */}
    <div className=flex items-center gap-2 shrink-0>
      <button
        type=button
        onClick={onRefresh}
        aria-label=Refresh messages
        className=flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 whitespace-nowrap shrink-0
      >
        <RefreshCw className={h-3.5 w-3.5 } />
        <span className=hidden sm:inline>Refresh</span>
      </button>

      <button
        type=button
        onClick={onToggleMembers}
        className={lex items-center gap-1.5 rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 }
      >
        <Users className=h-3.5 w-3.5 />
        <span>Members</span>
      </button>
    </div>
  </header>
);
