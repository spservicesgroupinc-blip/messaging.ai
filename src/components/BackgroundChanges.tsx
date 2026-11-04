import type { OptimisticAction } from '../utils/optimisticWorkspace';

const LABELS: Record<string, string> = {
  sendMessage: 'Message not confirmed', editMessage: 'Message edit not saved', deleteMessage: 'Message deletion not saved', toggleReaction: 'Reaction not saved', createChannel: 'Channel not created', editChannel: 'Channel changes not saved', deleteChannel: 'Channel deletion not saved', addChannelMember: 'Member not added', removeChannelMember: 'Member not removed', openDirectMessage: 'Conversation not confirmed', updateUserStatus: 'Status not saved',
};
export function BackgroundChanges({ failures, pendingCount, backupFailed, onRestore, onDismiss }: {
  failures: OptimisticAction[]; pendingCount: number; backupFailed: boolean;
  onRestore: (id: string) => void; onDismiss: (id: string) => void;
}) {
  return <>
    {pendingCount > 0 && <p role="status" className="shrink-0 border-b border-slate-100 px-3 py-1 text-xs text-slate-600">Saving {pendingCount === 1 ? 'change' : `${pendingCount} changes`}…</p>}
    {backupFailed && <p role="status" className="shrink-0 bg-amber-50 px-3 py-2 text-xs text-amber-950">Local backup is unavailable. Keep this app open until your changes finish saving.</p>}
    {failures.length > 0 && <section aria-label="Changes needing attention" className="max-h-48 shrink-0 overflow-y-auto border-b border-red-200 bg-red-50 px-3 py-2">
      {failures.map(failure => <div key={failure.id} role="alert" className="mb-2 last:mb-0">
        <p className="text-sm font-semibold text-red-900">{LABELS[failure.payload.action] ?? 'Change not saved'}</p>
        <p className="text-xs text-red-900">{failure.error}</p>
        {(failure.payload.content || failure.payload.name) && <p className="mt-1 line-clamp-2 whitespace-pre-wrap break-words text-sm text-slate-800">{failure.payload.content || failure.payload.name}</p>}
        <div className="mt-1 flex gap-2">
          {failure.payload.action === 'sendMessage' && <button onClick={() => onRestore(failure.id)} className="touch-target rounded px-2 text-xs font-semibold text-red-900">Restore message draft</button>}
          <button onClick={() => onDismiss(failure.id)} className="touch-target rounded px-2 text-xs font-medium text-slate-700">Dismiss</button>
        </div>
      </div>)}
    </section>}
  </>;
}
