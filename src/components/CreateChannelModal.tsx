import React, { useEffect, useRef, useState } from 'react';
import { Hash, Lock, Plus, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import {
  normalizeChannelName,
  type PublicUser,
} from '../utils/sheetsProtocol';

interface CreateChannelModalProps {
  isOpen: boolean;
  defaultPrivate?: boolean;
  onClose: () => void;
  workspaceUsers: PublicUser[];
  currentUserId: string;
  onCreateChannel: (params: {
    name: string;
    description: string;
    isPrivate: boolean;
    memberEmails: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
}

export const CreateChannelModal: React.FC<CreateChannelModalProps> = ({
  isOpen,
  defaultPrivate = false,
  onClose,
  workspaceUsers,
  currentUserId,
  onCreateChannel,
}) => {
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;
  const dialogRef = useRef<HTMLDivElement>(null);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(defaultPrivate);
  const [selectedEmails, setSelectedEmails] = useState<string[]>([]);
  const [customEmailInput, setCustomEmailInput] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setIsPrivate(defaultPrivate);
      setError('');
    }
  }, [isOpen, defaultPrivate]);

  useEffect(() => {
    if (!isOpen) return;
    const previousFocus = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = dialogRef.current;
    const focusable = () => Array.from(dialog?.querySelectorAll<HTMLElement>('button:not(:disabled), input:not(:disabled), textarea:not(:disabled), [tabindex="0"]') || []);
    dialog?.querySelector<HTMLInputElement>('#new-channel-name')?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { event.preventDefault(); onCloseRef.current(); }
      if (event.key !== 'Tab') return;
      const controls = focusable();
      const first = controls[0];
      const last = controls[controls.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last?.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
    };
    document.addEventListener('keydown', onKeyDown);
    return () => { document.removeEventListener('keydown', onKeyDown); previousFocus?.focus(); };
  }, [isOpen]);

  if (!isOpen) return null;

  const slugPreview = normalizeChannelName(name);
  const otherUsers = workspaceUsers.filter((u) => u.user_id !== currentUserId);

  const toggleUserEmail = (email: string) => {
    setSelectedEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleAddCustomEmail = () => {
    const clean = customEmailInput.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    if (!selectedEmails.includes(clean)) {
      setSelectedEmails((prev) => [...prev, clean]);
    }
    setCustomEmailInput('');
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!slugPreview || slugPreview.length < 2) {
      setError('Channel name must contain at least 2 alphanumeric characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await onCreateChannel({
        name: slugPreview,
        description,
        isPrivate,
        memberEmails: selectedEmails,
      });

      if (!res.ok) {
        setError(res.error || 'Could not create channel.');
        return;
      }

      setName('');
      setDescription('');
      setIsPrivate(false);
      setSelectedEmails([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#20252a]/45 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-channel-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-[#e5e7e9] bg-white shadow-lg">
        <div className="flex items-center justify-between border-b border-[#e5e7e9] px-6 py-4">
          <h2 id="create-channel-title" className="text-base font-semibold text-[#20252a]">
            Create a {isPrivate ? 'Private' : 'Public'} Channel
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close create channel modal"
            className="rounded-lg p-1.5 text-[#72777d] transition-colors hover:bg-slate-100 hover:text-[#20252a]"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5 p-5 sm:p-6">
          {/* Visibility Selector */}
          <div className="grid grid-cols-2 gap-3">
            <button
              type="button"
              aria-label="Visibility: Public Channel"
              aria-pressed={!isPrivate}
              onClick={() => setIsPrivate(false)}
              className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                !isPrivate
                  ? 'border-[#217a5b] bg-[#eff7f2] text-[#20252a]'
                  : 'border-[#e5e7e9] bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Hash className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
              <div className="mt-1">
                <div className="text-xs font-semibold text-[#20252a]">Public Channel</div>
                <p className="mt-0.5 text-xs text-[#72777d]">
                  Anyone in the workspace can view and join
                </p>
              </div>
            </button>

            <button
              type="button"
              aria-label="Visibility: Private Channel"
              aria-pressed={isPrivate}
              onClick={() => setIsPrivate(true)}
              className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                isPrivate
                  ? 'border-[#217a5b] bg-[#eff7f2] text-[#20252a]'
                  : 'border-[#e5e7e9] bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Lock className="mt-0.5 h-4 w-4 shrink-0 text-slate-700" />
              <div className="mt-1">
                <div className="text-xs font-semibold text-[#20252a]">Private Channel</div>
                <p className="mt-0.5 text-xs text-[#72777d]">
                  Only invited members can view and join
                </p>
              </div>
            </button>
          </div>

          {/* Channel Name */}
          <div>
            <label
              htmlFor="new-channel-name"
              className="block text-xs font-semibold text-slate-800"
            >
              Channel Name
            </label>
            <div className="relative mt-1.5">
              {isPrivate ? (
                <Lock className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
              ) : (
                <Hash className="pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400" />
              )}
              <input
                id="new-channel-name"
                type="text"
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. exec-strategy or release-ops"
                className="w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#20252a] placeholder:text-[#72777d] focus:border-[#217a5b] focus:ring-1 focus:ring-[#217a5b]/20 focus:outline-none"
              />
            </div>
            {slugPreview && (
              <p className="mt-1 text-xs text-[#72777d]">
                Channel handle:{' '}
                <span className="font-mono font-medium text-slate-800">
                  {isPrivate ? '🔒 ' : '#'}
                  {slugPreview}
                </span>
              </p>
            )}
          </div>

          {/* Channel Description */}
          <div>
            <label
              htmlFor="new-channel-description"
              className="block text-xs font-semibold text-slate-800"
            >
              Description <span className="font-normal text-slate-400">(optional)</span>
            </label>
            <input
              id="new-channel-description"
              type="text"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this channel used for?"
              className="mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#20252a] placeholder:text-[#72777d] focus:border-[#217a5b] focus:ring-1 focus:ring-[#217a5b]/20 focus:outline-none"
            />
          </div>

          {/* Optional Member Invitations for Private Channels */}
          {isPrivate && (
            <div className="space-y-2.5 rounded-lg border border-[#e5e7e9] bg-[#f7f8f8] p-4">
              <div className="text-xs font-semibold text-slate-800">
                Add Members to Private Channel
              </div>

              {otherUsers.length > 0 && (
                <div className="max-h-32 space-y-1 overflow-y-auto">
                  {otherUsers.map((u) => {
                    const checked = selectedEmails.includes(u.email);
                    return (
                      <label
                        key={u.user_id}
                        className="flex cursor-pointer items-center justify-between rounded-md px-2 py-1.5 text-xs hover:bg-slate-100"
                      >
                        <div className="flex items-center gap-2">
                          <Avatar userName={u.full_name} size="sm" className="h-6 w-6" />
                          <div className="truncate">
                            <span className="font-medium text-[#20252a]">{u.full_name}</span>
                            <span className="text-[#72777d]"> &middot; {u.email}</span>
                          </div>
                        </div>
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleUserEmail(u.email)}
                          className="h-3.5 w-3.5 rounded border-slate-300 text-[#217a5b]"
                        />
                      </label>
                    );
                  })}
                </div>
              )}

              <div className="flex gap-2">
                <input
                  type="email"
                  aria-label="Invite member by email"
                  value={customEmailInput}
                  onChange={(e) => setCustomEmailInput(e.target.value)}
                  placeholder="Add teammate by email..."
                  className="min-w-0 flex-1 rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs text-[#20252a] placeholder:text-[#72777d] focus:border-[#217a5b] focus:ring-1 focus:ring-[#217a5b]/20 focus:outline-none"
                />
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={handleAddCustomEmail}
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add
                </Button>
              </div>
            </div>
          )}

          {error && (
            <div role="alert" className="rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800">
              {error}
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2">
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={onClose}
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              size="sm"
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? 'Creating Channel...' : 'Create Channel'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
