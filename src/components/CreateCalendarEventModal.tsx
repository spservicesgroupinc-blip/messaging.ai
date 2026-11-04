import React, { useEffect, useRef, useState } from 'react';
import { Calendar, Clock, Mail, MapPin, Plus, X } from 'lucide-react';
import { Button } from './ui/Button';
import { Avatar } from './ui/Avatar';
import type { PublicUser } from '../utils/sheetsProtocol';

interface CreateCalendarEventModalProps {
  isOpen: boolean;
  channelId: string;
  currentUser: PublicUser;
  workspaceUsers: PublicUser[];
  onClose: () => void;
  onCreateEvent: (params: {
    title: string;
    description: string;
    start_time: string;
    end_time: string;
    timezone: string;
    location: string;
    attendee_emails: string[];
  }) => Promise<{ ok: boolean; error?: string }>;
}

export function CreateCalendarEventModal({
  isOpen,
  channelId,
  currentUser,
  workspaceUsers,
  onClose,
  onCreateEvent,
}: CreateCalendarEventModalProps) {
  const dialogRef = useRef<HTMLDivElement>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [startTime, setStartTime] = useState('');
  const [endTime, setEndTime] = useState('');
  const [timezone, setTimezone] = useState(Intl.DateTimeFormat().resolvedOptions().timeZone);
  const [location, setLocation] = useState('');
  const [attendeeEmails, setAttendeeEmails] = useState<string[]>([]);
  const [customEmail, setCustomEmail] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (isOpen) {
      setTitle('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setAttendeeEmails([]);
      setCustomEmail('');
      setError('');
    }
  }, [isOpen]);

  const toggleAttendee = (email: string) => {
    setAttendeeEmails((prev) =>
      prev.includes(email) ? prev.filter((e) => e !== email) : [...prev, email]
    );
  };

  const handleAddCustomEmail = () => {
    const clean = customEmail.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    if (!attendeeEmails.includes(clean)) {
      setAttendeeEmails([...attendeeEmails, clean]);
    }
    setCustomEmail('');
  };

  const now = new Date();
  const defaultStart = new Date(now.getTime() + 60 * 60 * 1000); // +1 hour
  defaultStart.setMinutes(Math.ceil(defaultStart.getMinutes() / 15) * 15);
  const defaultEnd = new Date(defaultStart.getTime() + 60 * 60 * 1000); // +1 hour

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!title) {
      setError('Event title is required.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Start and end times are required.');
      return;
    }
    if (new Date(endTime) <= new Date(startTime)) {
      setError('End time must be after start time.');
      return;
    }

    setSubmitting(true);
    try {
      const res = await onCreateEvent({
        title,
        description,
        start_time: startTime,
        end_time: endTime,
        timezone,
        location,
        attendee_emails: attendeeEmails,
      });

      if (!res.ok) {
        setError(res.error || 'Could not create event.');
        return;
      }

      setTitle('');
      setDescription('');
      setStartTime('');
      setEndTime('');
      setLocation('');
      setAttendeeEmails([]);
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  if (!isOpen) return null;

  const otherUsers = workspaceUsers.filter((u) => u.user_id !== currentUser.user_id);

  return (
    <div ref={dialogRef} className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/40 p-4 sm:p-6" onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}>
      <div className="relative w-full max-w-md overflow-y-auto rounded-xl border border-[#cbd5e1] bg-white p-5 shadow-xl">
        <div className="mb-4 flex items-center justify-between gap-2">
          <h2 className="text-base font-semibold text-slate-900">New Calendar Event</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="rounded-md p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-900 transition-colors">
            <X size={20} strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Event title</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Team sync"
              className="h-9 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Description</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="What is this event about?"
              rows={2}
              className="h-24 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Starts</label>
              <input
                type="datetime-local"
                value={startTime ? new Date(startTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setStartTime(e.target.value)}
                className="h-9 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
              />
            </div>
            <div className="space-y-2">
              <label className="block text-xs font-medium text-slate-700">Ends</label>
              <input
                type="datetime-local"
                value={endTime ? new Date(endTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setEndTime(e.target.value)}
                className="h-9 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
              />
            </div>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Location</label>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Conference room or Zoom link"
              className="h-9 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
            />
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Timezone</label>
            <select
              value={timezone}
              onChange={(e) => setTimezone(e.target.value)}
              className="h-9 w-full rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
            >
              <option value="UTC">UTC</option>
              <option value="America/New_York">Eastern (ET)</option>
              <option value="America/Chicago">Central (CT)</option>
              <option value="America/Denver">Mountain (MT)</option>
              <option value="America/Los_Angeles">Pacific (PT)</option>
              <option value="Europe/London">London (GMT)</option>
              <option value="Europe/Berlin">Berlin (CET)</option>
              <option value="Asia/Tokyo">Tokyo (JST)</option>
              <option value="Asia/Kolkata">India (IST)</option>
              <option value="Australia/Sydney">Sydney (AEST)</option>
            </select>
          </div>

          <div className="space-y-2">
            <label className="block text-xs font-medium text-slate-700">Invite attendees</label>
            <div className="flex flex-wrap gap-2">
              {otherUsers.map((user) => (
                <button
                  key={user.user_id}
                  type="button"
                  aria-pressed={attendeeEmails.includes(user.email)}
                  onClick={() => toggleAttendee(user.email)}
                  className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-xs transition-colors ${
                    attendeeEmails.includes(user.email)
                      ? 'border-blue-200 bg-blue-50 text-blue-700'
                      : 'border-[#cbd5e1] text-slate-700 hover:bg-[#f8fafc]'
                  }`}
                >
                  <Avatar userName={user.full_name} size="sm" />
                  <span className="truncate max-w-[120px]">{user.full_name}</span>
                </button>
              ))}
              <div className="flex items-center gap-2">
                <input
                  type="email"
                  value={customEmail}
                  onChange={(e) => setCustomEmail(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleAddCustomEmail(); }}
                  placeholder="email@example.com"
                  className="flex-1 h-9 rounded-md border border-[#cbd5e1] bg-[#f8fafc] pl-3 pr-3 text-sm text-[#475569] focus:border-[#94a3b8] focus:bg-white focus:outline-none focus:ring-2 focus:ring-[#2563eb]/10"
                />
                <button type="button" onClick={handleAddCustomEmail} className="rounded-md p-1.5 text-slate-600 hover:bg-slate-100 transition-colors">
                  <Plus size={16} strokeWidth={1.75} />
                </button>
              </div>
            </div>
            {attendeeEmails.length > 0 && (
              <p className="text-xs text-slate-500">
                {attendeeEmails.length} attendee{attendeeEmails.length !== 1 ? 's' : ''} invited
              </p>
            )}
          </div>

          {error && (
            <div className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-900">{error}</div>
          )}

          <div className="mt-4 flex justify-end gap-2">
            <Button type="button" variant="ghost" onClick={onClose} disabled={submitting}>
              Cancel
            </Button>
            <Button type="submit" variant="primary" loading={submitting} disabled={submitting}>
              Create event
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}
