'use client';

import { useState } from 'react';
import type { AdminBooking } from '@/lib/google-calendar';
import type { Project } from '@/config/projects';
import { ProjectEditor } from './ProjectEditor';

type Tab = 'bookings' | 'projects' | 'setup';
type AdminProject = Project & { isActive: boolean; id: string };

// ─── Login ────────────────────────────────────────────────────────────────────

function LoginScreen({ onLogin }: { onLogin: (email: string, password: string) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (!email || !password) { setError('Please enter your email and password.'); return; }
    setLoading(true);
    setError('');

    const res = await fetch('/api/admin/bookings', {
      headers: { 'x-admin-email': email, 'x-admin-password': password },
    });
    if (res.status === 401) {
      setError('Incorrect email or password.');
      setLoading(false);
    } else {
      // Any non-401 response (200 or even 500 from GCal not configured) means auth passed
      onLogin(email, password);
    }
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 w-full max-w-sm">
        <p className="text-gray-400 text-xs font-semibold uppercase tracking-widest mb-1">Chiibitsu Labs</p>
        <h1 className="text-white font-bold text-2xl mb-1">Admin</h1>
        <p className="text-gray-500 text-sm mb-6">Sign in to manage your bookings</p>
        <form onSubmit={handleLogin} className="space-y-3">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Email"
            autoComplete="email"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            autoComplete="current-password"
            className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
          {error && <p className="text-red-400 text-sm">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-semibold py-3 rounded-xl text-sm transition disabled:opacity-50"
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </button>
        </form>
      </div>
    </div>
  );
}

// ─── Main Dashboard ───────────────────────────────────────────────────────────

export function AdminDashboard() {
  const [adminEmail, setAdminEmail] = useState('');
  const [adminPassword, setAdminPassword] = useState('');
  const [tab, setTab] = useState<Tab>('bookings');

  if (!adminPassword) {
    return <LoginScreen onLogin={(e, p) => { setAdminEmail(e); setAdminPassword(p); }} />;
  }

  return (
    <div className="min-h-screen bg-gray-950">
      <header className="border-b border-gray-800 px-4 md:px-8 py-4 flex items-center justify-between">
        <div className="flex items-center gap-1">
          {(['bookings', 'projects', 'setup'] as Tab[]).map((t) => (
            <button
              key={t}
              onClick={() => setTab(t)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition capitalize ${
                tab === t ? 'bg-gray-800 text-white' : 'text-gray-400 hover:text-white'
              }`}
            >
              {t}
            </button>
          ))}
        </div>
        <a href="/" className="text-gray-500 hover:text-white text-sm transition">← Site</a>
      </header>

      <main className="max-w-5xl mx-auto px-4 md:px-8 py-8">
        {tab === 'bookings' && <BookingsTab adminEmail={adminEmail} adminPassword={adminPassword} />}
        {tab === 'projects' && <ProjectsTab adminEmail={adminEmail} adminPassword={adminPassword} />}
        {tab === 'setup' && <SetupTab adminPassword={adminPassword} />}
      </main>
    </div>
  );
}

// ─── Bookings Tab ─────────────────────────────────────────────────────────────

function BookingsTab({ adminEmail, adminPassword }: { adminEmail: string; adminPassword: string }) {
  const [bookings, setBookings] = useState<AdminBooking[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterSlug, setFilterSlug] = useState('all');

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/bookings', {
      headers: { 'x-admin-email': adminEmail, 'x-admin-password': adminPassword },
    });
    const data = await res.json();
    setBookings(data.bookings ?? []);
    setLoading(false);
  }

  if (!bookings && !loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Load your upcoming bookings</p>
        <button onClick={load} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          Load bookings
        </button>
      </div>
    );
  }

  if (loading) return <Spinner />;

  const uniqueSlugs = Array.from(new Set((bookings ?? []).map((b) => b.projectSlug)));
  const filtered = filterSlug === 'all' ? bookings! : bookings!.filter((b) => b.projectSlug === filterSlug);

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Upcoming Bookings</h2>
        <button onClick={load} className="text-gray-400 hover:text-white text-sm transition">↻ Refresh</button>
      </div>
      <div className="flex gap-2 mb-5 flex-wrap">
        <FilterBtn active={filterSlug === 'all'} onClick={() => setFilterSlug('all')}>All</FilterBtn>
        {uniqueSlugs.map((slug) => (
          <FilterBtn key={slug} active={filterSlug === slug} onClick={() => setFilterSlug(slug)}>{slug}</FilterBtn>
        ))}
      </div>
      {filtered.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No upcoming bookings.</p>
      ) : (
        <div className="space-y-3">{filtered.map((b) => <BookingRow key={b.eventId} booking={b} />)}</div>
      )}
    </div>
  );
}

// ─── Projects Tab ─────────────────────────────────────────────────────────────

function ProjectsTab({ adminEmail, adminPassword }: { adminEmail: string; adminPassword: string }) {
  const [projects, setProjects] = useState<AdminProject[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [editing, setEditing] = useState<AdminProject | 'new' | null>(null);
  const [noDb, setNoDb] = useState(false);

  async function load() {
    setLoading(true);
    const res = await fetch('/api/admin/projects', {
      headers: { 'x-admin-email': adminEmail, 'x-admin-password': adminPassword },
    });
    if (res.status === 503) { setNoDb(true); setLoading(false); return; }
    const data = await res.json();
    if (!res.ok) {
      alert(data.error ?? 'Could not load projects. Check the Setup tab and Supabase table.');
      setProjects([]);
      setLoading(false);
      return;
    }
    setProjects(data.projects ?? []);
    setLoading(false);
  }

  async function toggleActive(p: AdminProject) {
    await fetch(`/api/admin/projects/${p.slug}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail, 'x-admin-password': adminPassword },
      body: JSON.stringify({ isActive: !p.isActive }),
    });
    load();
  }

  async function handleDelete(p: AdminProject) {
    if (!confirm(`Delete "${p.name}"? This cannot be undone.`)) return;
    await fetch(`/api/admin/projects/${p.slug}`, {
      method: 'DELETE',
      headers: { 'x-admin-email': adminEmail, 'x-admin-password': adminPassword },
    });
    load();
  }

  async function handleSeed() {
    if (!confirm('Load the 2 default projects (AI @ Work and AICOS Fit Call) into the database?')) return;
    const res = await fetch('/api/admin/seed', { method: 'POST', headers: { 'x-admin-email': adminEmail, 'x-admin-password': adminPassword } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      alert(data.error ?? 'Could not load defaults. Check the Setup tab and Supabase table.');
      return;
    }
    load();
  }

  if (noDb) {
    return (
      <div className="bg-amber-900/20 border border-amber-800 rounded-2xl p-6 text-center max-w-lg mx-auto">
        <p className="text-amber-300 font-semibold mb-2">Database not connected yet</p>
        <p className="text-amber-200/70 text-sm mb-4">
          Add <code className="bg-amber-900/40 px-1.5 py-0.5 rounded text-xs">SUPABASE_URL</code> and{' '}
          <code className="bg-amber-900/40 px-1.5 py-0.5 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code>{' '}
          to your environment variables. Go to the <strong>Setup</strong> tab for step-by-step instructions.
        </p>
      </div>
    );
  }

  if (!projects && !loading) {
    return (
      <div className="text-center py-16">
        <p className="text-gray-400 mb-4">Manage your booking projects</p>
        <button onClick={load} className="bg-indigo-600 hover:bg-indigo-700 text-white px-6 py-3 rounded-xl text-sm font-semibold transition">
          Load projects
        </button>
      </div>
    );
  }

  if (loading) return <Spinner />;

  return (
    <div>
      {editing && (
        <ProjectEditor
          project={editing === 'new' ? undefined : editing}
          adminEmail={adminEmail}
          adminPassword={adminPassword}
          onSave={() => { setEditing(null); load(); }}
          onCancel={() => setEditing(null)}
        />
      )}

      <div className="flex items-center justify-between mb-6">
        <h2 className="text-white font-bold text-xl">Booking Projects</h2>
        <div className="flex gap-2">
          <button onClick={handleSeed} className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded-xl text-sm transition">
            Load defaults
          </button>
          <button
            onClick={() => setEditing('new')}
            className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-xl text-sm font-semibold transition"
          >
            + New project
          </button>
        </div>
      </div>

      {projects!.length === 0 ? (
        <p className="text-gray-500 text-center py-12">No projects yet. Create one or tap &quot;Load defaults&quot; to start with the 2 pre-configured projects.</p>
      ) : (
        <div className="space-y-3">
          {projects!.map((p) => (
            <div key={p.id} className={`bg-gray-900 border border-gray-800 rounded-xl p-5 flex items-center gap-4 ${!p.isActive ? 'opacity-50' : ''}`}>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  {p.branding.emoji && <span>{p.branding.emoji}</span>}
                  <span className="text-white font-semibold text-sm">{p.name}</span>
                  {!p.isActive && <span className="text-xs bg-gray-700 text-gray-400 px-2 py-0.5 rounded-full">Paused</span>}
                </div>
                <p className="text-gray-400 text-xs mt-0.5">{p.company} · /{p.slug}</p>
              </div>
              <div className="flex gap-2 shrink-0 flex-wrap justify-end">
                <button onClick={() => toggleActive(p)} className="px-3 py-1.5 rounded-lg text-xs text-gray-400 hover:text-white border border-gray-700 hover:border-gray-500 transition">
                  {p.isActive ? 'Pause' : 'Activate'}
                </button>
                <button onClick={() => setEditing(p)} className="px-3 py-1.5 rounded-lg text-xs text-white bg-gray-700 hover:bg-gray-600 transition">
                  Edit
                </button>
                <button onClick={() => handleDelete(p)} className="px-3 py-1.5 rounded-lg text-xs text-red-400 hover:text-red-300 hover:bg-red-900/20 transition">
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── Setup Tab ────────────────────────────────────────────────────────────────

const SQL_SNIPPET = `CREATE TABLE booking_projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT UNIQUE NOT NULL,
  name TEXT NOT NULL,
  company TEXT NOT NULL DEFAULT '',
  tagline TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL DEFAULT '',
  duration_minutes INTEGER NOT NULL DEFAULT 60,
  branding_color TEXT NOT NULL DEFAULT 'indigo',
  branding_emoji TEXT,
  time_slots JSONB NOT NULL DEFAULT '[]',
  custom_fields JSONB NOT NULL DEFAULT '[]',
  booking_window_weeks INTEGER NOT NULL DEFAULT 4,
  blocked_dates TEXT[] NOT NULL DEFAULT '{}',
  calendar_id TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);`;

function SetupTab({ adminPassword }: { adminPassword: string }) {
  const [copied, setCopied] = useState(false);

  function copySQL() {
    navigator.clipboard.writeText(SQL_SNIPPET).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  const callbackUrl = typeof window !== 'undefined'
    ? `${window.location.origin}/api/auth/google/callback`
    : 'https://book.chiibitsu.com/api/auth/google/callback';

  return (
    <div className="max-w-2xl space-y-6">
      <h2 className="text-white font-bold text-xl mb-2">Setup</h2>

      <SetupCard title="1 · Google Calendar" description="Connect your calendar so the app checks real availability and creates events on booking.">
        <div className="space-y-3 text-sm text-gray-400">
          <p>In <a href="https://console.cloud.google.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">Google Cloud Console</a>: enable Calendar API, create an OAuth 2.0 Web client, and add this as an authorised redirect URI:</p>
          <code className="block bg-gray-800 text-green-300 text-xs px-3 py-2 rounded-lg break-all">{callbackUrl}</code>
          <p>Add <code className="bg-gray-800 px-1 rounded text-xs">GOOGLE_CLIENT_ID</code> and <code className="bg-gray-800 px-1 rounded text-xs">GOOGLE_CLIENT_SECRET</code> to your env vars, then:</p>
          <a
            href={`/api/auth/google?password=${encodeURIComponent(adminPassword)}`}
            className="inline-block bg-white text-gray-900 font-semibold text-sm px-5 py-2.5 rounded-xl hover:bg-gray-100 transition"
          >
            Connect Google Calendar →
          </a>
          <p className="text-gray-500 text-xs">You&apos;ll be redirected to Google, then back here with your refresh token to copy into env vars.</p>
        </div>
      </SetupCard>

      <SetupCard title="2 · Supabase (manage projects without code)" description="Free database so you can add/edit booking projects from this admin panel.">
        <div className="space-y-3 text-sm text-gray-400">
          <ol className="list-decimal list-inside space-y-2">
            <li>Sign up at <a href="https://supabase.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">supabase.com</a> → create a free project</li>
            <li>Go to <strong className="text-gray-300">SQL Editor</strong> → paste and run this table setup:</li>
          </ol>
          <div className="relative">
            <pre className="bg-gray-800 text-green-300 text-xs p-3 rounded-xl overflow-x-auto whitespace-pre">{SQL_SNIPPET}</pre>
            <button
              onClick={copySQL}
              className="absolute top-2 right-2 bg-gray-700 hover:bg-gray-600 text-gray-300 text-xs px-2 py-1 rounded transition"
            >
              {copied ? 'Copied!' : 'Copy'}
            </button>
          </div>
          <ol className="list-decimal list-inside space-y-1.5" start={3}>
            <li>Go to <strong className="text-gray-300">Project Settings → API</strong></li>
            <li>Copy <strong className="text-gray-300">Project URL</strong> → add as <code className="bg-gray-800 px-1 rounded text-xs">SUPABASE_URL</code></li>
            <li>Copy <strong className="text-gray-300">service_role</strong> key → add as <code className="bg-gray-800 px-1 rounded text-xs">SUPABASE_SERVICE_ROLE_KEY</code></li>
            <li>Redeploy the app → come back here → <strong className="text-gray-300">Projects tab</strong> → tap &quot;Load defaults&quot;</li>
          </ol>
        </div>
      </SetupCard>

      <SetupCard title="3 · Resend (confirmation emails)" description="Sends confirmation emails to your guests and a notification to you.">
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-400">
          <li>Sign up at <a href="https://resend.com" target="_blank" rel="noreferrer" className="text-indigo-400 underline">resend.com</a></li>
          <li>Add and verify your domain</li>
          <li>Create an API key → add as <code className="bg-gray-800 px-1 rounded text-xs">RESEND_API_KEY</code></li>
          <li>Set <code className="bg-gray-800 px-1 rounded text-xs">EMAIL_FROM</code> to a verified address</li>
        </ol>
      </SetupCard>
    </div>
  );
}

function SetupCard({ title, description, children }: { title: string; description: string; children: React.ReactNode }) {
  return (
    <div className="bg-gray-900 border border-gray-800 rounded-2xl p-6">
      <h3 className="text-white font-semibold mb-1">{title}</h3>
      <p className="text-gray-400 text-sm mb-4">{description}</p>
      {children}
    </div>
  );
}

// ─── Shared ───────────────────────────────────────────────────────────────────

function FilterBtn({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition ${
        active ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white hover:bg-gray-700'
      }`}
    >
      {children}
    </button>
  );
}

function Spinner() {
  return (
    <div className="flex justify-center py-16">
      <div className="w-6 h-6 border-2 border-gray-700 border-t-gray-400 rounded-full animate-spin" />
    </div>
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
          <p className="text-gray-400 text-xs mt-0.5">{booking.dateLabel} · {booking.timeLabel}</p>
        </div>
        <div className="text-right shrink-0">
          <p className="text-gray-400 text-xs">{booking.bookerEmail}</p>
          {booking.bookerPhone && <p className="text-gray-500 text-xs">{booking.bookerPhone}</p>}
        </div>
        <svg className={`w-4 h-4 text-gray-500 shrink-0 transition-transform ${expanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>
      {expanded && (booking.bookerCompany || customEntries.length > 0) && (
        <div className="border-t border-gray-800 px-5 py-4">
          <dl className="grid grid-cols-2 gap-x-6 gap-y-2">
            {booking.bookerCompany && (<><dt className="text-xs text-gray-500">Company</dt><dd className="text-xs text-gray-300">{booking.bookerCompany}</dd></>)}
            {customEntries.map(([k, v]) => (<><dt key={`k-${k}`} className="text-xs text-gray-500">{k}</dt><dd key={`v-${k}`} className="text-xs text-gray-300">{v}</dd></>))}
          </dl>
        </div>
      )}
    </div>
  );
}
