'use client';

import { useState, useEffect } from 'react';
import { addMinutes } from 'date-fns';
import { fromZonedTime } from 'date-fns-tz';
import {
  HOST_TIMEZONE,
  formatLongDateInZone,
  formatTimeInZone,
  zoneDescription,
  zonesDiffer,
} from '@/lib/timezone';

interface AdminProject {
  slug: string;
  name: string;
  durationMinutes: number;
  locationType?: 'online' | 'in_person' | 'either';
}

// Common client timezones. Free-text IANA ids also work if one is missing —
// the field is a datalist, not a closed list.
const COMMON_ZONES = [
  'Asia/Manila',
  'America/Vancouver',
  'America/Edmonton',
  'America/Winnipeg',
  'America/Toronto',
  'America/Halifax',
  'America/Los_Angeles',
  'America/Denver',
  'America/Chicago',
  'America/New_York',
  'Europe/London',
  'Europe/Berlin',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
  'Pacific/Auckland',
];

interface Props {
  adminEmail: string;
  adminPassword: string;
  onSaved: () => void;
  onCancel: () => void;
}

export function ManualBookingForm({ adminEmail, adminPassword, onSaved, onCancel }: Props) {
  const [projects, setProjects] = useState<AdminProject[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  // Set when the server reports an overlapping event; lets the admin proceed
  // deliberately rather than being blocked or silently double-booking.
  const [conflict, setConflict] = useState(false);

  const [form, setForm] = useState({
    slug: '',
    name: '',
    email: '',
    phone: '',
    company: '',
    date: '',
    time: '12:00',
    durationMinutes: 0,
    locationChoice: '',
    bookerTimezone: '',
    notes: '',
    sendEmail: true,
  });

  useEffect(() => {
    (async () => {
      const res = await fetch('/api/admin/projects', {
        headers: { 'x-admin-email': adminEmail, 'x-admin-password': adminPassword },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        // Without this the dropdown sits on "Loading…" forever with no reason given.
        setError(data.error ?? `Could not load projects (${res.status}).`);
        return;
      }
      const list: AdminProject[] = data.projects ?? [];
      setProjects(list);
      if (list.length > 0) {
        setForm((f) => ({
          ...f,
          slug: f.slug || list[0].slug,
          durationMinutes: f.durationMinutes || list[0].durationMinutes,
        }));
      }
    })().catch(() => setError('Could not load projects.'));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selected = projects.find((p) => p.slug === form.slug);

  function setField<K extends keyof typeof form>(key: K, value: (typeof form)[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      // Default the duration to whatever the chosen project uses, and drop the
      // old location — otherwise a hidden stale choice is still POSTed and can
      // put "In person" on an online-only session's invite.
      if (key === 'slug') {
        const proj = projects.find((p) => p.slug === value);
        if (proj) next.durationMinutes = proj.durationMinutes;
        next.locationChoice = '';
      }
      return next;
    });
  }

  // Live preview of the exact instant, in both clocks — this is the whole point
  // of the screen, so show it rather than making the admin do the arithmetic.
  const previewStart = (() => {
    if (!form.date || !form.time) return null;
    const [h, m] = form.time.split(':').map(Number);
    const wall = new Date(`${form.date}T00:00:00`);
    if (Number.isNaN(wall.getTime()) || !Number.isFinite(h)) return null;
    wall.setHours(h, Number.isFinite(m) ? m : 0, 0, 0);
    return fromZonedTime(wall, HOST_TIMEZONE);
  })();
  const minutes = form.durationMinutes > 0 ? form.durationMinutes : selected?.durationMinutes ?? 60;
  const previewEnd = previewStart ? addMinutes(previewStart, minutes) : null;
  // Label and compare against the session instant, not "now", so a booking
  // across a DST changeover is not tagged with the wrong abbreviation.
  const showClientZone = (() => {
    if (!form.bookerTimezone) return false;
    try {
      return zonesDiffer(form.bookerTimezone, HOST_TIMEZONE, previewStart ?? undefined);
    } catch {
      return false; // unrecognised IANA id typed into the free-text field
    }
  })();

  async function handleSave(allowConflict = false) {
    if (!form.slug || !form.name || !form.email || !form.date || !form.time) {
      setError('Project, name, email, date and time are all required.');
      return;
    }
    if (selected?.locationType === 'either' && !form.locationChoice) {
      setError('This session can run online or face to face — pick one.');
      return;
    }
    setSaving(true);
    setError('');
    setConflict(false);

    try {
      const res = await fetch('/api/admin/bookings', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-admin-email': adminEmail,
          'x-admin-password': adminPassword,
        },
        body: JSON.stringify({ ...form, durationMinutes: minutes, allowConflict }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? `Failed to create booking (${res.status})`);
        setConflict(res.status === 409 && !!data.conflict);
        setSaving(false);
        return;
      }
      onSaved();
    } catch {
      // Without this the button stays stuck on "Adding…" with nothing shown,
      // and no way to tell whether the invite already went out.
      setError('Network error — check the Bookings list before retrying, in case it was created.');
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto p-4">
      <div className="min-h-full flex items-start justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl my-8 overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-bold text-lg">Add a booking manually</h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <p className="text-xs text-gray-500">
              Any date, time and length you like — this is not limited to the project&apos;s
              usual slots. Creates the calendar invite and (optionally) emails the client,
              exactly like a booking made on the site.
            </p>

            <Field label="Session" required>
              <select
                value={form.slug}
                onChange={(e) => setField('slug', e.target.value)}
                className="admin-input"
              >
                {projects.length === 0 && <option value="">Loading…</option>}
                {projects.map((p) => (
                  <option key={p.slug} value={p.slug}>{p.name}</option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Client name" required>
                <input type="text" value={form.name} onChange={(e) => setField('name', e.target.value)} placeholder="Rosamar Garcia" className="admin-input" />
              </Field>
              <Field label="Client email" required>
                <input type="email" value={form.email} onChange={(e) => setField('email', e.target.value)} placeholder="name@example.com" className="admin-input" />
              </Field>
              <Field label="Phone">
                <input type="text" value={form.phone} onChange={(e) => setField('phone', e.target.value)} placeholder="+1 604 …" className="admin-input" />
              </Field>
              <Field label="Company">
                <input type="text" value={form.company} onChange={(e) => setField('company', e.target.value)} placeholder="Company" className="admin-input" />
              </Field>
            </div>

            <div className="grid grid-cols-3 gap-3">
              <Field label="Date" required hint="your time">
                <input type="date" value={form.date} onChange={(e) => setField('date', e.target.value)} className="admin-input" />
              </Field>
              <Field label="Start" required hint="your time">
                <input type="time" value={form.time} onChange={(e) => setField('time', e.target.value)} className="admin-input" />
              </Field>
              <Field label="Minutes" hint="length">
                <input
                  type="number"
                  min={15}
                  step={15}
                  value={form.durationMinutes || ''}
                  onChange={(e) => setField('durationMinutes', Number(e.target.value))}
                  className="admin-input"
                />
              </Field>
            </div>

            <Field label="Client timezone" hint="so their confirmation shows their own local time">
              <input
                type="text"
                list="tz-options"
                value={form.bookerTimezone}
                onChange={(e) => setField('bookerTimezone', e.target.value)}
                placeholder="America/Vancouver"
                className="admin-input"
              />
              <datalist id="tz-options">
                {COMMON_ZONES.map((z) => <option key={z} value={z} />)}
              </datalist>
            </Field>

            {selected?.locationType === 'either' && (
              <Field label="Location" required hint="this project lets the client choose">
                <select
                  value={form.locationChoice}
                  onChange={(e) => setField('locationChoice', e.target.value)}
                  className="admin-input"
                >
                  <option value="">— pick one —</option>
                  <option value="Online">💻 Online</option>
                  <option value="Face to face">📍 Face to face</option>
                </select>
              </Field>
            )}

            <Field label="Internal note" hint="for your records — the client never sees this">
              <textarea
                value={form.notes}
                onChange={(e) => setField('notes', e.target.value)}
                rows={2}
                placeholder="Anything worth recording about this booking…"
                className="admin-input resize-none"
              />
            </Field>

            {/* Both clocks, so a cross-timezone booking cannot be got wrong */}
            {previewStart && previewEnd && (
              <div className="bg-gray-800/60 border border-gray-700 rounded-xl p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-gray-500 mb-2">Confirm the time</p>
                <p className="text-gray-200">
                  <span className="text-gray-400">You:</span>{' '}
                  {formatLongDateInZone(previewStart.toISOString(), HOST_TIMEZONE)},{' '}
                  {formatTimeInZone(previewStart.toISOString(), HOST_TIMEZONE)} –{' '}
                  {formatTimeInZone(previewEnd.toISOString(), HOST_TIMEZONE)}
                </p>
                {showClientZone && (
                  <p className="text-emerald-300 mt-1">
                    <span className="text-gray-400">Client:</span>{' '}
                    {formatLongDateInZone(previewStart.toISOString(), form.bookerTimezone)},{' '}
                    {formatTimeInZone(previewStart.toISOString(), form.bookerTimezone)} –{' '}
                    {formatTimeInZone(previewEnd.toISOString(), form.bookerTimezone)}{' '}
                    <span className="text-gray-500">({zoneDescription(form.bookerTimezone, previewStart ?? undefined)})</span>
                  </p>
                )}
              </div>
            )}

            <label className="flex items-center gap-2 text-sm text-gray-300 cursor-pointer">
              <input
                type="checkbox"
                checked={form.sendEmail}
                onChange={(e) => setField('sendEmail', e.target.checked)}
                className="rounded"
              />
              Notify the client — confirmation email and calendar invite
            </label>

            {error && (
              <div className="bg-red-900/30 border border-red-700/50 rounded-xl p-3 text-sm text-red-300">
                {error}
                {conflict && (
                  <button
                    type="button"
                    onClick={() => handleSave(true)}
                    className="mt-2 block underline font-semibold text-red-200 hover:text-white"
                  >
                    Book it anyway
                  </button>
                )}
              </div>
            )}
          </div>

          <div className="flex gap-3 px-6 py-4 border-t border-gray-800">
            <button
              onClick={() => handleSave(false)}
              disabled={saving}
              className="flex-1 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-semibold py-2.5 rounded-xl transition"
            >
              {saving ? 'Adding…' : 'Add booking'}
            </button>
            <button
              onClick={onCancel}
              className="px-5 py-2.5 text-gray-400 hover:text-white transition"
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Field({
  label,
  hint,
  required,
  children,
}: {
  label: string;
  hint?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-gray-500 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}
