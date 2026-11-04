import { Clock, MapPin, User, Mail } from 'lucide-react';
import type { SheetCalendarEvent } from '../utils/sheetsProtocol';
import { formatTimeShort } from '../utils/sheetsProtocol';

interface CalendarEventProps {
  event: SheetCalendarEvent;
  currentUserId: string;
  onDelete: (eventId: string) => Promise<void>;
}

export function CalendarEvent({ event, currentUserId, onDelete }: CalendarEventProps) {
  const isOrganizer = event.organizer_id === currentUserId;
  const start = new Date(event.start_time);
  const end = new Date(event.end_time);

  return (
    <article className="flex flex-col gap-2 rounded-lg border border-[#e2e8f0] bg-white p-4">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
          <Clock size={18} strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline gap-2">
            <h3 className="text-base font-semibold text-slate-900">{event.title}</h3>
            {isOrganizer && (
              <button
                type="button"
                aria-label="Delete event"
                className="ml-auto shrink-0 rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-red-600 transition-colors"
                onClick={() => void onDelete(event.event_id)}
              >
                <span className="sr-only">Delete event</span>
                <span aria-hidden="true">×</span>
              </button>
            )}
          </div>
          {event.description && (
            <p className="mt-1 text-sm text-slate-600">{event.description}</p>
          )}
          <div className="mt-2 flex items-center gap-2 text-xs text-slate-500">
            <User size={14} strokeWidth={1.75} />
            <span>{event.organizer_name}</span>
          </div>
          <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
            <Clock size={14} strokeWidth={1.75} />
            <span>
              {start.toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}
              {formatTimeShort(event.start_time)} – {formatTimeShort(event.end_time)}
            </span>
          </div>
          {event.location && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <MapPin size={14} strokeWidth={1.75} />
              <span>{event.location}</span>
            </div>
          )}
          {event.attendee_emails && (
            <div className="mt-1 flex items-center gap-1 text-xs text-slate-500">
              <Mail size={14} strokeWidth={1.75} />
              <span title={event.attendee_emails}>
                {event.attendee_emails.split(',').length} attendee{event.attendee_emails.split(',').length !== 1 ? 's' : ''}
              </span>
            </div>
          )}
        </div>
      </div>
    </article>
  );
}
