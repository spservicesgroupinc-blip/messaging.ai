import React, { useEffect, useRef, useState } from 'react';
import { Lock, UserMinus, UserPlus, Users, X } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { Button } from './ui/Button';
import {
  type PublicUser,
  type SheetChannel,
  type SheetChannelMember,
} from '../utils/sheetsProtocol';

interface ChannelMembersDrawerProps {
  channel: SheetChannel;
  memberships: SheetChannelMember[];
  workspaceUsers: PublicUser[];
  currentUserId: string;
  onClose: () => void;
  onAddMember: (email: string) => Promise<{ ok: boolean; error?: string }>;
  onRemoveMember: (targetUserId: string) => Promise<void>;
}

export const ChannelMembersDrawer: React.FC<ChannelMembersDrawerProps> = ({
  channel,
  memberships,
  workspaceUsers,
  currentUserId,
  onClose,
  onAddMember,
  onRemoveMember,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const [isMobile, setIsMobile] = useState(() => window.matchMedia('(max-width: 1023px)').matches);
  useEffect(() => {
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus();
    const mobileMedia = window.matchMedia('(max-width: 1023px)');
    const onViewportChange = () => {
      setIsMobile(mobileMedia.matches);
      if (mobileMedia.matches && !panelRef.current?.contains(document.activeElement)) closeRef.current?.focus();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onCloseRef.current();
      if (event.key !== 'Tab' || !mobileMedia.matches) return;
      const panel = panelRef.current;
      const controls = Array.from(panel?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (!panel?.contains(document.activeElement)) { event.preventDefault(); first?.focus(); }
      else if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    mobileMedia.addEventListener('change', onViewportChange);
    document.addEventListener('keydown', onKeyDown);
    return () => {
      mobileMedia.removeEventListener('change', onViewportChange);
      document.removeEventListener('keydown', onKeyDown);
      previousFocus?.focus();
    };
  }, []);

  const [inviteEmail, setInviteEmail] = useState('');
  const [error, setError] = useState('');
  const [adding, setAdding] = useState(false);

  const channelMemberships = memberships.filter((m) => m.channel_id === channel.channel_id);
  const memberUserIds = new Set(channelMemberships.map((m) => m.user_id));
  if (channel.created_by && channel.created_by !== 'system') {
    memberUserIds.add(channel.created_by);
  }

  const members: PublicUser[] = channel.is_private
    ? workspaceUsers.filter((u) => memberUserIds.has(u.user_id))
    : workspaceUsers;

  const nonMembers = workspaceUsers.filter((u) => !memberUserIds.has(u.user_id));

  const handleInviteSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    const clean = inviteEmail.trim().toLowerCase();
    if (!clean) return;

    setAdding(true);
    try {
      const res = await onAddMember(clean);
      if (!res.ok) {
        setError(res.error || 'Could not add member.');
      } else {
        setInviteEmail('');
      }
    } finally {
      setAdding(false);
    }
  };

  return (
    <aside
      ref={panelRef}
      role={isMobile ? 'dialog' : undefined}
      aria-modal={isMobile || undefined}
      aria-label="Channel members and access"
      className="fixed inset-0 z-30 flex h-dvh w-full min-w-0 flex-col border-l border-[#e5e7e9] bg-white lg:static lg:h-full lg:w-80 lg:shrink-0"
    >
      <div className="flex h-16 shrink-0 items-center justify-between border-b border-[#e5e7e9] px-5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 shrink-0 text-slate-600" />
          <h2 className="text-sm font-semibold text-[#20252a]">Channel members</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          ref={closeRef}
          aria-label="Close channel access panel"
          className="rounded-lg p-1.5 text-[#72777d] transition-colors hover:bg-slate-100 hover:text-[#20252a]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="rounded-lg border border-[#e5e7e9] bg-[#f7f8f8] p-4">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[#20252a]">
            {channel.is_private && <Lock className="h-3.5 w-3.5 shrink-0 text-slate-700" />}
            <span>{channel.is_private ? 'Private channel' : 'Public channel'}</span>
          </div>
          <p className="mt-1.5 text-xs leading-relaxed text-slate-600">
            {channel.is_private
              ? 'Access is restricted to invited members of this private channel.'
              : 'All authenticated workspace members can read and post here.'}
          </p>
        </div>

        {channel.is_private && !channel.dm_participants && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-800">Add a teammate</h3>
            <form onSubmit={handleInviteSubmit} className="flex gap-2">
              <input
                type="email"
                aria-label="Member email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#20252a] placeholder:text-[#72777d] focus:border-[#217a5b] focus:ring-1 focus:ring-[#217a5b]/20 focus:outline-none"
              />
              <Button
                type="submit"
                variant="primary"
                size="sm"
                disabled={adding}
                loading={adding}
              >
                <UserPlus className="h-3.5 w-3.5 shrink-0" />
                Add
              </Button>
            </form>

            {nonMembers.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs text-[#72777d]">Quick add registered teammates:</p>
                {nonMembers.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between rounded-md border border-[#e5e7e9] px-3 py-2 text-xs"
                  >
                    <div className="flex items-center gap-2 truncate pr-2">
                      <Avatar userName={u.full_name} size="sm" className="h-6 w-6" />
                      <div className="min-w-0">
                        <span className="font-medium text-[#20252a] block">{u.full_name}</span>
                        <span className="block truncate text-[#72777d] text-[11px]">{u.email}</span>
                      </div>
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={() => onAddMember(u.email)}
                    >
                      Add
                    </Button>
                  </div>
                ))}
              </div>
            )}

            {error && (
              <p className="text-xs font-medium text-red-600" role="alert">
                {error}
              </p>
            )}
          </div>
        )}

        <div className="space-y-2.5">
          <div className="flex items-center justify-between text-xs font-semibold text-slate-800">
            <span>Members</span>
            <span className="tabular-nums text-[#72777d]">{members.length}</span>
          </div>

          <div className="divide-y divide-slate-100 rounded-lg border border-[#e5e7e9]">
            {members.map((member) => {
              const isCreator = channel.created_by === member.user_id;
              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between gap-2 px-3 py-3"
                >
                  <div className="flex min-w-0 items-center gap-3">
                    <Avatar userName={member.full_name} size="md" className="h-8 w-8 shrink-0" />
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-[#20252a]">
                        {member.full_name}
                        {member.user_id === currentUserId ? ' (you)' : ''}
                      </div>
                      <div className="truncate text-[11px] text-[#72777d]">
                        {member.role_title} &middot; {isCreator ? 'Owner' : 'Member'}
                      </div>
                    </div>
                  </div>

                  {channel.is_private &&
                    !channel.dm_participants &&
                    member.user_id !== currentUserId &&
                    !isCreator && (
                      <Button
                        type="button"
                        variant="danger"
                        size="sm"
                        onClick={() => onRemoveMember(member.user_id)}
                        aria-label={`Remove ${member.full_name} from channel`}
                      >
                        <UserMinus className="h-3.5 w-3.5 shrink-0" />
                      </Button>
                    )}
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </aside>
  );
};
