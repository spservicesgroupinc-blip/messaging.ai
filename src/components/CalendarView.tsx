import { Calendar, Plus, Trash2, X } from 'lucide-react';
import React, { useState } from 'react';
import { CalendarEvent } from './CalendarEvent';
import { CreateCalendarEventModal } from './CreateCalendarEventModal';
import { Button } from './ui/Button';
import type { SheetCalendarEvent, PublicUser } from '../utils/sheetsProtocol';

interface CalendarViewProps {
  channelId: string;
  currentUser: PublicUser;
  workspaceUsers: PublicUser[];
  events: SheetCalendarEvent[];
  onCreateEvent: (params: {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    timezone: string;
    location: string;
    attendee_emails: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
  onDeleteEvent: (eventId: string) => Promise<{ ok: boolean; error?: string }>;
}

export function CalendarView({
  channelId,
  currentUser,
  workspaceUsers,
  events,
  onCreateEvent,
  onDeleteEvent,
}: CalendarViewProps) {
  const [createModalOpen, setCreateModalOpen] = useState(false);

  const sortedEvents = [...events].sort(
    (a, b) => a.start_time.localeCompare(b.start_time)
  );

  const handleDelete = async (eventId: string) => {
    if (!window.confirm('Delete this calendar event?')) return;
    await onDeleteEvent(eventId);
  };

  return (
    <section className="flex flex-col gap-4">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <Calendar size={18} strokeWidth={1.75} />
          <h2 className="text-base font-semibold text-slate-900">Calendar Events</h2>
        </div>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          onClick={() => setCreateModalOpen(true)}
        >
          <Plus size={16} strokeWidth={1.75} /> Schedule event
        </Button>
      </div>

      {sortedEvents.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-slate-500">
          <Calendar size={32} strokeWidth={1.75} opacity={50} />
          <p className="mt-2 text-sm">No events scheduled yet.</p>
          <p className="text-xs text-slate-400">Create an event to share with the channel.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {sortedEvents.map((event) => (
            <CalendarEvent
              key={event.event_id}
              event={event}
              currentUserId={currentUser.user_id}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      <CreateCalendarEventModal
        isOpen={createModalOpen}
        channelId={channelId}
        currentUser={currentUser}
        workspaceUsers={workspaceUsers}
        onClose={() => setCreateModalOpen(false)}
        onCreateEvent={onCreateEvent}
      />
    </section>
  );
}
