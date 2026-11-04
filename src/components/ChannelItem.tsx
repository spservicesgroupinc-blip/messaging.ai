import { useState } from 'react';
import { Check, Copy, Hash, Lock, MoreHorizontal, Pencil, Trash2, Users } from 'lucide-react';
import { Avatar } from './ui/Avatar';
import { ActionSheet } from './ui/ActionSheet';
import type { PublicUser, SheetChannel } from '../utils/sheetsProtocol';
interface ChannelItemProps {
  channel: SheetChannel; isActive: boolean; isDm?: boolean; currentUser?: PublicUser | null; workspaceUsers?: PublicUser[];
  onClick: (id: string) => void; onOpenDm?: (id: string) => void;
  onEditChannel?: (channel: SheetChannel) => void; onDeleteChannel?: (channel: SheetChannel) => void; onManageMembers?: (channel: SheetChannel) => void;
}
export function ChannelItem({ channel, isActive, currentUser, workspaceUsers = [], onClick, onOpenDm, onEditChannel, onDeleteChannel, onManageMembers }: ChannelItemProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [copyStatus, setCopyStatus] = useState('');
  const isDm = Boolean(channel.dm_participants);
  const partnerId = channel.dm_participants?.split(',').find(id => id !== currentUser?.user_id) ?? currentUser?.user_id;
  const partner = isDm ? workspaceUsers.find(user => user.user_id === partnerId) : undefined;
  const label = isDm && partnerId === currentUser?.user_id ? 'Saved messages' : partner?.full_name ?? channel.name;
  const canManage = !isDm && (onEditChannel || onDeleteChannel || onManageMembers);
  const selectAction = (action?: (channel: SheetChannel) => void) => { setMenuOpen(false); action?.(channel); };
  return <div className={'flex min-h-11 w-full items-center rounded-md lg:min-h-8 ' + (isActive ? 'bg-blue-100 text-blue-800' : 'text-slate-600 hover:bg-slate-100')}>
    <button type="button" onClick={() => isDm && partner && onOpenDm ? onOpenDm(partner.user_id) : onClick(channel.channel_id)} aria-label={label} aria-current={isActive ? 'page' : undefined} className={'flex min-h-11 min-w-0 flex-1 items-center gap-2.5 rounded-md px-2.5 py-1 text-left text-sm lg:min-h-8 ' + (isActive ? 'font-semibold' : '')}>
      {isDm && partner ? <Avatar userName={partner.full_name} size="sm" className="!h-6 !w-6" /> : channel.is_private ? <Lock aria-hidden="true" className="h-4 w-4 shrink-0" /> : <Hash aria-hidden="true" className="h-4 w-4 shrink-0" />}
      <span className="truncate">{label}</span>
    </button>
    {canManage && <button type="button" aria-label={'Channel options for ' + channel.name} aria-haspopup="dialog" aria-expanded={menuOpen} onClick={() => setMenuOpen(true)} className="touch-target shrink-0 rounded-md hover:bg-slate-200"><MoreHorizontal size={18} /></button>}
    {menuOpen && <ActionSheet title={'#' + channel.name} onClose={() => setMenuOpen(false)}>
      {onEditChannel && <button className="sheet-action" onClick={() => selectAction(onEditChannel)}><Pencil size={18} />Edit channel</button>}
      {onManageMembers && <button className="sheet-action" onClick={() => selectAction(onManageMembers)}><Users size={18} />Manage members</button>}
      <button className="sheet-action" onClick={async () => { try { await navigator.clipboard.writeText('#' + channel.name); setCopyStatus('Channel name copied.'); } catch { setCopyStatus('Could not copy. Try selecting the channel name.'); } }}>
        {copyStatus.startsWith('Channel') ? <Check size={18} /> : <Copy size={18} />}Copy channel name
      </button>
      {copyStatus && <p role="status" className="px-3 text-sm text-slate-600">{copyStatus}</p>}
      {onDeleteChannel && <button className="sheet-action text-red-700" onClick={() => selectAction(onDeleteChannel)}><Trash2 size={18} />Delete channel</button>}
    </ActionSheet>}
  </div>;
}
