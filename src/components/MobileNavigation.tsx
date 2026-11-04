import { Hash, LogOut, MessageCircle, Plus, Search, Users } from 'lucide-react';
import { useState } from 'react';
import { ChannelItem } from './ChannelItem';
import { Avatar } from './ui/Avatar';
import type { MobileTab } from '../hooks/useMobileNavigation';
import type { PublicUser, SheetChannel } from '../utils/sheetsProtocol';

export function MobileTabBar({ tab, onChange }: { tab: MobileTab; onChange: (tab: MobileTab) => void }) {
  return <nav aria-label="Mobile workspace" className="mobile-tabbar flex shrink-0 border-t border-slate-200 bg-white">
    {([{ id: 'channels', label: 'Channels', icon: Hash }, { id: 'dms', label: 'DMs', icon: MessageCircle }, { id: 'people', label: 'People', icon: Users }] as const).map(({ id, label, icon: Icon }) =>
      <button key={id} onClick={() => onChange(id)} aria-current={tab === id ? 'page' : undefined} className={'flex min-h-14 flex-1 flex-col items-center justify-center gap-1 text-xs font-medium ' + (tab === id ? 'text-blue-700' : 'text-slate-600')}><Icon size={20} /><span>{label}</span></button>)}
  </nav>;
}

interface Props {
  tab: MobileTab; user: PublicUser; users: PublicUser[]; channels: SheetChannel[];
  onSelect: (channel: SheetChannel) => void; onPerson: (id: string) => void;
  onCreate: (isPrivate: boolean) => void; onEdit: (channel: SheetChannel) => void;
  onDelete: (channel: SheetChannel) => void; onMembers: (channel: SheetChannel) => void;
  onSignOut: () => void; onPeople: () => void;
}
export function MobileDirectory({ tab, user, users, channels, onSelect, onPerson, onCreate, onEdit, onDelete, onMembers, onSignOut, onPeople }: Props) {
  const [query, setQuery] = useState('');
  const match = (text: string) => text.toLowerCase().includes(query.trim().toLowerCase());
  const visible = channels.filter(channel => tab === 'dms' ? Boolean(channel.dm_participants) : !channel.dm_participants).filter(channel => {
    const partner = users.find(person => channel.dm_participants?.split(',').includes(person.user_id) && person.user_id !== user.user_id);
    return match(partner?.full_name ?? channel.name);
  });
  const people = users.filter(person => person.user_id !== user.user_id && match(person.full_name + ' ' + person.email));
  return <main id="conversation" tabIndex={-1} className="flex min-h-0 flex-1 flex-col bg-white outline-none">
    <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3"><div className="min-w-0"><h1 className="text-xl font-semibold">{tab === 'channels' ? 'Channels' : tab === 'dms' ? 'Direct messages' : 'People'}</h1><p className="truncate text-xs text-slate-600">{user.full_name}</p></div><button aria-label="Sign out" title="Sign out" onClick={onSignOut} className="touch-target rounded-md text-slate-600 hover:bg-slate-100"><LogOut size={20} /></button></header>
    <div className="shrink-0 p-4"><label className="relative block"><Search className="pointer-events-none absolute left-3 top-3 text-slate-500" size={18} /><input type="search" aria-label={tab === 'people' ? 'Find a teammate' : 'Find a conversation'} value={query} onChange={event => setQuery(event.target.value)} placeholder={tab === 'people' ? 'Find a teammate' : 'Find a conversation'} className="h-11 w-full rounded-lg border border-slate-300 bg-slate-50 pl-10 pr-3" /></label></div>
    <div className="min-h-0 flex-1 overflow-y-auto px-3 pb-4">
      {tab === 'people' ? <>
        <p className="px-2 pb-3 text-sm text-slate-600">Choose a teammate to start a direct message.</p>
        {people.map(person => <button key={person.user_id} onClick={() => onPerson(person.user_id)} className="flex min-h-16 w-full items-center gap-3 rounded-lg px-2 text-left hover:bg-slate-50"><Avatar userName={person.full_name} /><span className="min-w-0"><span className="block truncate font-semibold">{person.full_name}</span><span className="block truncate text-xs text-slate-600">{person.role_title || person.email}</span></span><MessageCircle className="ml-auto shrink-0 text-slate-500" size={18} /></button>)}
        {!people.length && <p role="status" className="p-3 text-sm text-slate-600">{query ? 'No teammates match your search.' : 'No other teammates yet.'}</p>}
      </> : <>
        <button onClick={() => tab === 'channels' ? onCreate(false) : onPeople()} className="mb-4 flex min-h-11 w-full items-center gap-2 rounded-lg border border-slate-200 px-3 text-left font-medium text-blue-700"><Plus size={18} />{tab === 'channels' ? 'New channel' : 'New message'}</button>
        {(tab === 'channels' ? [false, true] : [true]).map(isPrivate => <section key={String(isPrivate)} className="mb-4">
          <h2 className="mb-1 px-2 text-xs font-semibold uppercase tracking-wide text-slate-600">{tab === 'dms' ? 'Conversations' : isPrivate ? 'Private channels' : 'Channels'}</h2>
          {visible.filter(channel => tab === 'dms' || channel.is_private === isPrivate).map(channel => <ChannelItem key={channel.channel_id} channel={channel} isActive={false} currentUser={user} workspaceUsers={users} onClick={() => onSelect(channel)} onEditChannel={onEdit} onDeleteChannel={onDelete} onManageMembers={onMembers} />)}
        </section>)}
        {!visible.length && <p role="status" className="px-2 text-sm text-slate-600">{query ? 'No conversations match your search.' : tab === 'dms' ? 'No direct messages yet. Start a new message above.' : 'No channels yet. Create one above.'}</p>}
      </>}
    </div>
  </main>;
}
