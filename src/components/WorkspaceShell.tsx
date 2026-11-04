import React from 'react';
import { Home, MessageCircle, Plus, Users } from 'lucide-react';
import { PushNotificationBadge } from './ui/PushNotificationBadge';
import type { PublicUser } from '../utils/sheetsProtocol';

interface WorkspaceShellProps {
  currentUser: PublicUser;
  isDirectMessage: boolean;
  onHome: () => void;
  onDirectMessages: () => void;
  onMembers: () => void;
  onCreateChannel: () => void;
  children: React.ReactNode;
}

export function WorkspaceShell({ currentUser, isDirectMessage, onHome, onDirectMessages, onMembers, onCreateChannel, children }: WorkspaceShellProps) {
  return (
    <div className="workspace-shell flex h-dvh min-h-0 flex-col overflow-hidden bg-white text-slate-900">
      <a href="#conversation" className="skip-link">Skip to conversation</a>
      <div className="workspace-topbar flex h-11 shrink-0 items-center justify-between gap-4 px-4 text-white lg:px-5">
        <div className="flex items-center gap-2.5">
          <span className="relay-symbol" aria-hidden="true"><span /><span /><span /></span>
          <span className="text-sm font-semibold tracking-tight">relay<span className="text-blue-300">.</span></span>
          <span className="mx-2 hidden h-3.5 w-px bg-white/15 sm:block" />
          <span className="hidden text-xs text-white/60 sm:block">Team workspace</span>
        </div>
        <div className="flex items-center gap-3">
          <PushNotificationBadge currentUserId={currentUser.user_id} />
          <span className="hidden text-xs text-white/65 sm:block">{currentUser.full_name}</span>
          <span className="flex h-6 w-6 items-center justify-center rounded-md bg-white/10 text-[10px] font-semibold" aria-hidden="true">
            {currentUser.full_name.split(' ').filter(Boolean).map(part => part[0]).slice(0, 2).join('')}
          </span>
        </div>
      </div>
      <div className="flex min-h-0 flex-1">
        <nav aria-label="Workspace tools" className="workspace-rail hidden w-16 shrink-0 flex-col items-center gap-3 py-5 text-white/65 lg:flex">
          <button type="button" onClick={onHome} aria-current={!isDirectMessage ? 'page' : undefined} className={'rail-action ' + (!isDirectMessage ? 'is-active' : '')}>
            <span className="rail-icon"><Home size={20} strokeWidth={1.7} /></span><span>Home</span>
          </button>
          <button type="button" onClick={onDirectMessages} aria-current={isDirectMessage ? 'page' : undefined} className={'rail-action ' + (isDirectMessage ? 'is-active' : '')}>
            <span className="rail-icon"><MessageCircle size={20} strokeWidth={1.7} /></span><span>DMs</span>
          </button>
          <button type="button" onClick={onMembers} className="rail-action">
            <span className="rail-icon"><Users size={20} strokeWidth={1.7} /></span><span>People</span>
          </button>
          <div className="mt-auto border-t border-white/10 pt-4">
            <button type="button" onClick={onCreateChannel} aria-label="Create a channel" title="Create a channel" className="flex h-9 w-9 items-center justify-center rounded-full bg-white/10 text-white/80 transition-colors hover:bg-white/20"><Plus size={19} /></button>
          </div>
        </nav>
        {children}
      </div>
    </div>
  );
}
