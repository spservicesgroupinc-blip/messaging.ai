import React, { useState } from 'react';
import { Lock, UserMinus, UserPlus, Users, X } from 'lucide-react';
import {
  getInitials,
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
      aria-label="Channel members and access"
      className="flex h-full w-80 shrink-0 flex-col border-l border-slate-200 bg-white"
    >
      <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3.5">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4 text-slate-600" />
          <h2 className="text-sm font-semibold text-slate-900">Channel Access</h2>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close channel access panel"
          className="rounded-lg p-1.5 text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-900"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-4">
        <div className="rounded-lg border border-slate-200 bg-slate-50 p-3.5">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-900">
            {channel.is_private && <Lock className="h-3.5 w-3.5 text-slate-700" />}
            <span>{channel.is_private ? 'Private Channel' : 'Public Workspace Channel'}</span>
          </div>
          <p className="mt-1 text-xs leading-relaxed text-slate-600">
            {channel.is_private
              ? 'Access is restricted to invited members of this private channel.'
              : 'All authenticated workspace members can read and post here.'}
          </p>
        </div>

        {channel.is_private && !channel.dm_participants && (
          <div className="space-y-3">
            <h3 className="text-xs font-semibold text-slate-800">Add Member to Private Channel</h3>
            <form onSubmit={handleInviteSubmit} className="flex gap-2">
              <input
                type="email"
                aria-label="Member email address"
                value={inviteEmail}
                onChange={(e) => setInviteEmail(e.target.value)}
                placeholder="teammate@company.com"
                className="flex-1 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs text-slate-900 placeholder:text-slate-400 focus:border-blue-600 focus:outline-none"
              />
              <button
                type="submit"
                disabled={adding}
                className="flex items-center gap-1 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 whitespace-nowrap shrink-0"
              >
                <UserPlus className="h-3.5 w-3.5" />
                Add
              </button>
            </form>

            {nonMembers.length > 0 && (
              <div className="space-y-1 pt-1">
                <p className="text-xs text-slate-500">Quick add registered teammates:</p>
                {nonMembers.map((u) => (
                  <div
                    key={u.user_id}
                    className="flex items-center justify-between rounded-md border border-slate-200 px-2.5 py-1.5 text-xs"
                  >
                    <div className="truncate pr-2">
                      <span className="font-medium text-slate-900">{u.full_name}</span>
                      <span className="block truncate text-slate-500">{u.email}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => onAddMember(u.email)}
                      className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-800 hover:bg-slate-200 whitespace-nowrap shrink-0"
                    >
                      Grant Access
                    </button>
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
            <span>Authorized Members</span>
            <span className="font-mono tabular-nums text-slate-500">{members.length}</span>
          </div>

          <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
            {members.map((member) => {
              const isCreator = channel.created_by === member.user_id;
              return (
                <div
                  key={member.user_id}
                  className="flex items-center justify-between gap-2 px-3 py-2.5"
                >
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-slate-900 text-xs font-semibold text-white">
                      {getInitials(member.full_name)}
                    </div>
                    <div className="min-w-0">
                      <div className="truncate text-xs font-semibold text-slate-900">
                        {member.full_name}
                        {member.user_id === currentUserId ? ' (you)' : ''}
                      </div>
                      <div className="truncate text-xs text-slate-500">
                        {member.role_title} &middot; {isCreator ? 'Owner' : 'Member'}
                      </div>
                    </div>
                  </div>

                  {channel.is_private &&
                    !channel.dm_participants &&
                    member.user_id !== currentUserId &&
                    !isCreator && (
                      <button
                        type="button"
                        onClick={() => onRemoveMember(member.user_id)}
                        aria-label={`Remove ${member.full_name} from channel`}
                        className="rounded-md p-1 text-slate-400 hover:bg-red-50 hover:text-red-600"
                      >
                        <UserMinus className="h-3.5 w-3.5" />
                      </button>
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
