'use client';

import { useState } from 'react';
import type { AdminBooking } from '@/lib/google-calendar';
import { projects } from '@/config/projects';

export function AdminDashboard() {
  const [password, setPassword] = useState('');
  const [authenticated, setAuthenticated] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [bookings, setBookings] = useState<AdminBooking[]>([]);
  const [filterSlug, setFilterSlug] = useState('all');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch(`/api/admin/bookings?password=${encodeURIComponent(password)}`);
      const data = await res.json();

      if (!res.ok) {
        setError('Incorrect password');
        setLoading(false);
        return;
      }

      setBookings(data.bookings);
      setAuthenticated(true);
    } catch {
      setError('Network error. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!authenticated) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
          <h1 className="text-white font-bold text-xl mb-1">Admin</h1>
          <p className="text-gray-400 text-sm mb-6">Enter your admin password</p>
          <form onSubmit={handleLogin} className="space-y-4">
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password"
              className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {error && <p className="text-red-400 text-sm">{error}</p>}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-50"
            >
              {loading ? 'Checking…' : 'Log in'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const filtered = filterSlug === 'all' ? bookings : bookings.filter((b) => b.projectSlug === filterSlug);

  return (
    <div className="min-h-screen bg-gray-950 p-4 md:p-8">
      <div className="max-w-5xl mx-auto">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-white font-bold text-2xl">Upcoming Bookings</h1>
            <p className="text-gray-400 text-sm mt-1">{filtered.length} booking{filtered.length !== 1 ? 's' : ''}</p>
          </div>
          <a href="/" className="text-gray-400 hover:text-white text-sm transition">← Back to site</a>
        </div>

        {/* Filter */}
        <div className="flex gap-2 mb-6 flex-wrap">
          <FilterBtn active={filterSlug === 'all'} onClick={() => setFilterSlug('all')}>
            All projects
          </FilterBtn>
          {projects.map((p) => (
            <FilterBtn key={p.slug} active={filterSlug === p.slug} onClick={() => setFilterSlug(p.slug)}>
              {p.company}: {p.name}
            </FilterBtn>
          ))}
        </div>

        {filtered.length === 0 ? (
          <div className="text-center py-16 text-gray-500">
            <p>No upcoming bookings.</p>
          </div>
        ) : (
          <div className="space-y-3">
            {filtered.map((booking) => (
              <BookingRow key={booking.eventId} booking={booking} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        active
          ? 'bg-indigo-600 text-white'
          : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function BookingRow({ booking }: { booking: AdminBooking }) {
  const [expanded, setExpanded] = useState(false);
  const customEntries = Object.entries(booking.customFields).filter(([, v]) => v);

  return (
    <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full text-left px-5 py-4 flex items-center gap-4 hover:bg-gray-800 transition"
      >
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-3 flex-wrap">
            <span className="text-white font-semibold text-sm">{booking.bookerName}</span>
            <span className="text-gray-400 text-xs bg-gray-800 px-2 py-0.5 rounded-full">{booking.projectName}</span>
          </div>
          <p className="text-gray-400 text-xs mt-0.5">
            {booking.dateLabel} · {booking.timeLabel}
          </p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-gray-400 text-xs">{booking.bookerEmail}</p>
          {booking.bookerPhone && <p className="text-gray-500 text-xs">{booking.bookerPhone}</p>}
        </div>
        <svg
          className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {expanded && (
        <div className="border-t border-gray-800 px-5 py-4 bg-gray-900">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {booking.bookerCompany && (
              <>
                <dt className="text-xs text-gray-500">Company</dt>
                <dd className="text-xs text-gray-300">{booking.bookerCompany}</dd>
              </>
            )}
            {customEntries.map(([k, v]) => (
              <>
                <dt key={`k-${k}`} className="text-xs text-gray-500">{k}</dt>
                <dd key={`v-${k}`} className="text-xs text-gray-300">{v}</dd>
              </>
            ))}
          </dl>
        </div>
      )}
    </div>
  );
}
