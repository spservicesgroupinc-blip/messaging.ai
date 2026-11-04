import { useModal } from '../hooks/useModal';
import React, { useEffect, useRef, useState } from 'react';
import { AlertTriangle, Hash, Lock, Trash2, X } from 'lucide-react';
import { Button } from './ui/Button';
import {
  normalizeChannelName,
  type SheetChannel,
} from '../utils/sheetsProtocol';

interface EditChannelModalProps {
  channel: SheetChannel | null;
  mode: 'edit' | 'delete';
  onClose: () => void;
  onEditChannel: (params: {
    channelId: string;
    name: string;
    description: string;
    isPrivate: boolean;
  }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteChannel: (channelId: string) => Promise<{ ok: boolean; error?: string }>;
}

export const EditChannelModal: React.FC<EditChannelModalProps> = ({
  channel,
  mode,
  onClose,
  onEditChannel,
  onDeleteChannel,
}) => {
  const dialogRef = useRef<HTMLDivElement>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isPrivate, setIsPrivate] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (channel) {
      setName(channel.name);
      setDescription(channel.description || '');
      setIsPrivate(Boolean(channel.is_private));
      setError('');
      setSubmitting(false);
    }
  }, [channel, mode]);

  useModal(dialogRef, Boolean(channel), onClose);

  if (!channel) return null;

  const slugPreview = normalizeChannelName(name);

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!slugPreview || slugPreview.length < 2) {
      setError('Channel name must contain at least 2 alphanumeric characters.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await onEditChannel({
        channelId: channel.channel_id,
        name: slugPreview,
        description,
        isPrivate,
      });

      if (!res.ok) {
        setError(res.error || 'Could not update channel.');
        return;
      }

      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmDelete = async () => {
    setError('');
    setSubmitting(true);
    try {
      const res = await onDeleteChannel(channel.channel_id);
      if (!res.ok) {
        setError(res.error || 'Could not delete channel.');
        return;
      }
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (mode === 'delete') {
    return (
      <div
        ref={dialogRef}
        className='workspace-modal fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#20252a]/45 p-4'
        role='dialog'
        aria-modal='true'
        aria-labelledby='delete-channel-title'
        onClick={(e) => {
          if (e.target === e.currentTarget) onClose();
        }}
      >
        <div className='my-auto w-full max-w-md rounded-lg border border-[#e5e7e9] bg-white shadow-lg'>
          <div className='flex items-center justify-between border-b border-[#e5e7e9] px-6 py-4'>
            <div className='flex items-center gap-2'>
              <AlertTriangle className='h-4 w-4 text-red-600' />
              <h2 id='delete-channel-title' className='text-base font-semibold text-slate-900'>
                Delete #{channel.name}
              </h2>
            </div>
            <button
              type='button'
              onClick={onClose}
              aria-label='Close delete channel modal'
              className='rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'
            >
              <X className='h-4 w-4' />
            </button>
          </div>

          <div className='space-y-4 p-6'>
            <p className='text-sm leading-relaxed text-[#4f5853]'>
              Are you sure you want to permanently delete{' '}
              <span className='font-semibold text-slate-900'>#{channel.name}</span>? All
              messages and thread replies in this channel will be removed.
            </p>

            {error && (
              <div
                role='alert'
                className='rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800'
              >
                {error}
              </div>
            )}

            <div className='flex items-center justify-end gap-2.5 pt-2'>
              <Button type='button' variant='secondary' size='sm' onClick={onClose}>
                Cancel
              </Button>
              <button
                type='button'
                data-confirm-delete='true'
                disabled={submitting}
                onClick={handleConfirmDelete}
                className='inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3.5 py-2 text-xs font-semibold text-white transition-colors hover:bg-red-700 disabled:opacity-50'
              >
                <Trash2 className='h-3.5 w-3.5' />
                {submitting ? 'Deleting...' : 'Delete Channel'}
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      ref={dialogRef}
      className='workspace-modal fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-[#20252a]/45 p-4'
      role='dialog'
      aria-modal='true'
      aria-labelledby='edit-channel-title'
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className='my-auto max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-lg border border-[#e5e7e9] bg-white shadow-lg'>
        <div className='flex items-center justify-between border-b border-[#e5e7e9] px-6 py-4'>
          <h2 id='edit-channel-title' className='text-base font-semibold text-slate-900'>
            Edit #{channel.name}
          </h2>
          <button
            type='button'
            onClick={onClose}
            aria-label='Close edit channel modal'
            className='rounded-lg p-1.5 text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900'
          >
            <X className='h-4 w-4' />
          </button>
        </div>

        <form onSubmit={handleEditSubmit} className='space-y-5 p-5 sm:p-6'>
          <div className='grid grid-cols-2 gap-3'>
            <button
              type='button'
              aria-label='Edit Visibility: Public Channel'
              aria-pressed={!isPrivate}
              onClick={() => setIsPrivate(false)}
              className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                !isPrivate
                  ? 'border-[#2563eb] bg-[#f1f5f9] text-[#0f172a]'
                  : 'border-[#e5e7e9] bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Hash className='mt-0.5 h-4 w-4 shrink-0 text-slate-700' />
              <div className='mt-1'>
                <div className='text-xs font-semibold text-slate-900'>Public Channel</div>
                <p className='mt-0.5 text-xs text-slate-600'>
                  Anyone in the workspace can view and join
                </p>
              </div>
            </button>

            <button
              type='button'
              aria-label='Edit Visibility: Private Channel'
              aria-pressed={isPrivate}
              onClick={() => setIsPrivate(true)}
              className={`flex flex-col items-start gap-2 rounded-md border p-3 text-left transition-colors ${
                isPrivate
                  ? 'border-[#2563eb] bg-[#f1f5f9] text-[#0f172a]'
                  : 'border-[#e5e7e9] bg-white text-slate-600 hover:border-slate-300'
              }`}
            >
              <Lock className='mt-0.5 h-4 w-4 shrink-0 text-slate-700' />
              <div className='mt-1'>
                <div className='text-xs font-semibold text-slate-900'>Private Channel</div>
                <p className='mt-0.5 text-xs text-slate-600'>
                  Only invited members can view and join
                </p>
              </div>
            </button>
          </div>

          <div>
            <label
              htmlFor='edit-channel-name'
              className='block text-xs font-semibold text-slate-800'
            >
              Channel Name
            </label>
            <div className='relative mt-1.5'>
              {isPrivate ? (
                <Lock className='pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400' />
              ) : (
                <Hash className='pointer-events-none absolute top-3 left-3 h-4 w-4 text-slate-400' />
              )}
              <input
                id='edit-channel-name'
                type='text'
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder='e.g. engineering'
                className='w-full rounded-lg border border-slate-300 bg-white py-2.5 pr-3.5 pl-10 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/20 focus:outline-none'
              />
            </div>
            {slugPreview && (
              <p className='mt-1 text-xs text-slate-600'>
                Channel handle:{' '}
                <span className='font-mono font-medium text-slate-800'>
                  {isPrivate ? '🔒 ' : '#'}
                  {slugPreview}
                </span>
              </p>
            )}
          </div>

          <div>
            <label
              htmlFor='edit-channel-description'
              className='block text-xs font-semibold text-slate-800'
            >
              Description <span className='font-normal text-slate-400'>(optional)</span>
            </label>
            <input
              id='edit-channel-description'
              type='text'
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder='What is this channel used for?'
              className='mt-1.5 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-[#0f172a] placeholder:text-[#64748b] focus:border-[#2563eb] focus:ring-1 focus:ring-[#2563eb]/20 focus:outline-none'
            />
          </div>

          {error && (
            <div
              role='alert'
              className='rounded-lg border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs font-medium text-red-800'
            >
              {error}
            </div>
          )}

          <div className='flex items-center justify-end gap-2.5 pt-2'>
            <Button type='button' variant='secondary' size='sm' onClick={onClose}>
              Cancel
            </Button>
            <Button
              type='submit'
              variant='primary'
              size='sm'
              disabled={submitting}
              loading={submitting}
            >
              {submitting ? 'Saving Changes...' : 'Save Changes'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
