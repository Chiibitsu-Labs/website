'use client';

import { useState } from 'react';
import type { Project, TimeSlotTemplate, CustomField, DayOfWeek } from '@/config/projects';

const COLORS = [
  { name: 'violet', label: 'Violet', hex: '#7c3aed' },
  { name: 'teal', label: 'Teal', hex: '#0d9488' },
  { name: 'indigo', label: 'Indigo', hex: '#4338ca' },
  { name: 'blue', label: 'Blue', hex: '#1d4ed8' },
  { name: 'emerald', label: 'Emerald', hex: '#059669' },
  { name: 'rose', label: 'Rose', hex: '#e11d48' },
  { name: 'amber', label: 'Amber', hex: '#d97706' },
];

const DURATIONS = [
  { label: '15 min', value: 15 },
  { label: '30 min', value: 30 },
  { label: '45 min', value: 45 },
  { label: '1 hour', value: 60 },
  { label: '1.5 hours', value: 90 },
  { label: '2 hours', value: 120 },
  { label: '3 hours', value: 180 },
  { label: '4 hours', value: 240 },
  { label: '5 hours', value: 300 },
  { label: '6 hours', value: 360 },
  { label: '7 hours', value: 420 },
  { label: '8 hours', value: 480 },
  { label: '9 hours', value: 540 },
];

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const TIME_OPTIONS = Array.from({ length: 28 }, (_, i) => {
  const totalMinutes = 7 * 60 + i * 30; // 7:00 AM to 9:30 PM
  const h = Math.floor(totalMinutes / 60);
  const m = totalMinutes % 60;
  const label = `${h > 12 ? h - 12 : h === 0 ? 12 : h}:${m.toString().padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`;
  return { value: `${h}:${m}`, h, m, label };
});

interface FormState {
  name: string;
  company: string;
  tagline: string;
  description: string;
  durationMinutes: number;
  brandingColor: string;
  brandingEmoji: string;
  timeSlots: TimeSlotTemplate[];
  customFields: CustomField[];
  bookingWindowWeeks: number;
  calendarId: string;
  slug: string;
  isPaid: boolean;
  locationType: 'online' | 'in_person';
  calendarEventTitleTemplate: string;
}

function projectToForm(p?: Project): FormState {
  return {
    name: p?.name ?? '',
    company: p?.company ?? '',
    tagline: p?.tagline ?? '',
    description: p?.description ?? '',
    durationMinutes: p?.durationMinutes ?? 60,
    brandingColor: p?.branding.primaryColor ?? 'indigo',
    brandingEmoji: p?.branding.emoji ?? '',
    timeSlots: p?.timeSlots ?? [],
    customFields: p?.customFields ?? [],
    bookingWindowWeeks: p?.bookingWindowWeeks ?? 4,
    calendarId: p?.calendarId ?? '',
    slug: p?.slug ?? '',
    isPaid: p?.isPaid ?? false,
    locationType: p?.locationType ?? 'online',
    calendarEventTitleTemplate: p?.calendarEventTitleTemplate ?? '',
  };
}

function generateSlug(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
}

interface Props {
  project?: Project & { isActive?: boolean };
  adminEmail: string;
  adminPassword: string;
  onSave: () => void;
  onCancel: () => void;
}

export function ProjectEditor({ project, adminEmail, adminPassword, onSave, onCancel }: Props) {
  const isNew = !project;
  const [form, setForm] = useState<FormState>(projectToForm(project));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => {
      const next = { ...prev, [key]: value };
      if (key === 'name' && isNew) next.slug = generateSlug(value as string);
      return next;
    });
  }

  // Time slots
  function addTimeSlot() {
    setField('timeSlots', [...form.timeSlots, { days: [1], startHour: 9, startMinute: 0 }]);
  }
  function removeTimeSlot(i: number) {
    setField('timeSlots', form.timeSlots.filter((_, idx) => idx !== i));
  }
  function updateTimeSlot(i: number, patch: Partial<TimeSlotTemplate>) {
    setField('timeSlots', form.timeSlots.map((s, idx) => idx === i ? { ...s, ...patch } : s));
  }
  function toggleDay(i: number, day: DayOfWeek) {
    const slot = form.timeSlots[i];
    const days = slot.days.includes(day) ? slot.days.filter((d) => d !== day) : [...slot.days, day].sort() as DayOfWeek[];
    updateTimeSlot(i, { days });
  }

  // Custom fields
  function addField() {
    const id = `field_${Date.now()}`;
    const newField: CustomField = { id, label: '', type: 'text', required: false };
    setField('customFields', [...form.customFields, newField]);
  }
  function removeField(i: number) {
    setField('customFields', form.customFields.filter((_, idx) => idx !== i));
  }
  function updateField(i: number, patch: Partial<CustomField>) {
    setField('customFields', form.customFields.map((f, idx) => idx === i ? { ...f, ...patch } : f));
  }
  function addSelectOption(fieldIdx: number) {
    const field = form.customFields[fieldIdx];
    updateField(fieldIdx, { options: [...(field.options ?? []), ''] });
  }
  function updateSelectOption(fieldIdx: number, optIdx: number, value: string) {
    const field = form.customFields[fieldIdx];
    const opts = (field.options ?? []).map((o, i) => i === optIdx ? value : o);
    updateField(fieldIdx, { options: opts });
  }
  function removeSelectOption(fieldIdx: number, optIdx: number) {
    const field = form.customFields[fieldIdx];
    updateField(fieldIdx, { options: (field.options ?? []).filter((_, i) => i !== optIdx) });
  }

  async function handleSave() {
    if (!form.name || !form.company || !form.slug) {
      setError('Name, company, and slug are required.');
      return;
    }
    setSaving(true);
    setError('');

    const payload = {
      slug: form.slug,
      name: form.name,
      company: form.company,
      tagline: form.tagline,
      description: form.description,
      durationMinutes: form.durationMinutes,
      brandingColor: form.brandingColor,
      brandingEmoji: form.brandingEmoji || undefined,
      timeSlots: form.timeSlots,
      customFields: form.customFields,
      bookingWindowWeeks: form.bookingWindowWeeks,
      calendarId: form.calendarId || undefined,
      isPaid: form.isPaid,
      locationType: form.locationType,
      calendarEventTitleTemplate: form.calendarEventTitleTemplate || undefined,
    };

    const url = isNew ? '/api/admin/projects' : `/api/admin/projects/${project!.slug}`;
    const method = isNew ? 'POST' : 'PUT';

    const res = await fetch(url, {
      method,
      headers: { 'Content-Type': 'application/json', 'x-admin-email': adminEmail, 'x-admin-password': adminPassword },
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) { setError(data.error ?? 'Save failed'); setSaving(false); return; }

    onSave();
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 overflow-y-auto p-4">
      <div className="min-h-full flex items-start justify-center">
        <div className="bg-gray-900 border border-gray-800 rounded-2xl w-full max-w-xl my-8 overflow-hidden">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-800">
            <h2 className="text-white font-bold text-lg">
              {isNew ? 'New booking project' : `Edit: ${project!.name}`}
            </h2>
            <button onClick={onCancel} className="text-gray-400 hover:text-white p-1">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <div className="p-6 space-y-6 overflow-y-auto">
            {/* Basic Info */}
            <Section title="Basic Info">
              <Field label="Project name" required>
                <Input value={form.name} onChange={(v) => setField('name', v)} placeholder="AI @ Work: Use Case Lab" />
              </Field>
              <Field label="Company / Brand" required>
                <Input value={form.company} onChange={(v) => setField('company', v)} placeholder="Futureproof" />
              </Field>
              <Field label="Tagline" hint="One short line shown on the booking page">
                <Input value={form.tagline} onChange={(v) => setField('tagline', v)} placeholder="AI Training for Companies" />
              </Field>
              <Field label="Description">
                <textarea
                  value={form.description}
                  onChange={(e) => setField('description', e.target.value)}
                  rows={3}
                  placeholder="Describe what this session is about…"
                  className="admin-input resize-none"
                />
              </Field>
              {isNew && (
                <Field label="URL slug" hint={`booking.chiibitsu.com/${form.slug || 'your-slug'}`}>
                  <Input value={form.slug} onChange={(v) => setField('slug', v.toLowerCase().replace(/[^a-z0-9-]/g, '-'))} placeholder="ai-at-work" />
                </Field>
              )}
            </Section>

            {/* Duration */}
            <Section title="Session Duration">
              <div className="grid grid-cols-4 gap-2">
                {DURATIONS.map((d) => (
                  <button
                    key={d.value}
                    type="button"
                    onClick={() => setField('durationMinutes', d.value)}
                    className={`py-2 px-3 rounded-lg text-sm font-medium transition border ${
                      form.durationMinutes === d.value
                        ? 'bg-indigo-600 border-indigo-600 text-white'
                        : 'border-gray-700 text-gray-400 hover:border-gray-500 hover:text-white'
                    }`}
                  >
                    {d.label}
                  </button>
                ))}
              </div>
            </Section>

            {/* Branding */}
            <Section title="Colour Theme">
              <div className="flex gap-3 flex-wrap">
                {COLORS.map((c) => (
                  <button
                    key={c.name}
                    type="button"
                    title={c.label}
                    onClick={() => setField('brandingColor', c.name)}
                    className={`w-10 h-10 rounded-full transition-all border-4 ${
                      form.brandingColor === c.name ? 'border-white scale-110' : 'border-transparent'
                    }`}
                    style={{ backgroundColor: c.hex }}
                  />
                ))}
              </div>
              <Field label="Emoji (optional)" hint="Shown on the project card">
                <Input value={form.brandingEmoji} onChange={(v) => setField('brandingEmoji', v)} placeholder="⚡" />
              </Field>
            </Section>

            {/* Time Slots */}
            <Section title="Available Times">
              <p className="text-gray-400 text-xs mb-3">
                Each rule sets which days of the week a particular start time is available.
              </p>
              <div className="space-y-3">
                {form.timeSlots.map((slot, i) => {
                  const timeVal = TIME_OPTIONS.find((t) => t.h === slot.startHour && t.m === slot.startMinute);
                  return (
                    <div key={i} className="bg-gray-800 rounded-xl p-4 space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-gray-300 text-sm font-medium">Slot {i + 1}</span>
                        <button onClick={() => removeTimeSlot(i)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                      </div>
                      {/* Day checkboxes */}
                      <div className="flex gap-1.5 flex-wrap">
                        {DAYS.map((day, dayIdx) => (
                          <button
                            key={dayIdx}
                            type="button"
                            onClick={() => toggleDay(i, dayIdx as DayOfWeek)}
                            className={`px-2.5 py-1 rounded-md text-xs font-medium transition ${
                              slot.days.includes(dayIdx as DayOfWeek)
                                ? 'bg-indigo-600 text-white'
                                : 'bg-gray-700 text-gray-400 hover:text-white'
                            }`}
                          >
                            {day}
                          </button>
                        ))}
                      </div>
                      {/* Time picker */}
                      <div className="flex items-center gap-2">
                        <span className="text-gray-400 text-xs">Start time</span>
                        <select
                          value={`${slot.startHour}:${slot.startMinute}`}
                          onChange={(e) => {
                            const [h, m] = e.target.value.split(':').map(Number);
                            updateTimeSlot(i, { startHour: h, startMinute: m });
                          }}
                          className="admin-input flex-1 text-sm"
                        >
                          {TIME_OPTIONS.map((t) => (
                            <option key={t.value} value={t.value}>{t.label}</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  );
                })}
              </div>
              <button
                type="button"
                onClick={addTimeSlot}
                className="mt-3 w-full py-2 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-500 text-sm transition"
              >
                + Add time slot
              </button>
            </Section>

            {/* Custom Fields */}
            <Section title="Extra Form Fields">
              <p className="text-gray-400 text-xs mb-3">
                Questions shown to the person booking, after name / email / phone.
              </p>
              <div className="space-y-3">
                {form.customFields.map((field, i) => (
                  <div key={field.id} className="bg-gray-800 rounded-xl p-4 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-300 text-sm font-medium">Field {i + 1}</span>
                      <button onClick={() => removeField(i)} className="text-gray-500 hover:text-red-400 text-xs">Remove</button>
                    </div>
                    <Field label="Question / Label">
                      <Input value={field.label} onChange={(v) => updateField(i, { label: v })} placeholder="e.g. Company name" />
                    </Field>
                    <div className="flex gap-3">
                      <div className="flex-1">
                        <label className="text-xs text-gray-400 mb-1 block">Type</label>
                        <select
                          value={field.type}
                          onChange={(e) => updateField(i, { type: e.target.value as CustomField['type'] })}
                          className="admin-input text-sm"
                        >
                          <option value="text">Short text</option>
                          <option value="textarea">Long text</option>
                          <option value="select">Dropdown</option>
                        </select>
                      </div>
                      <div className="flex items-end pb-1">
                        <button
                          type="button"
                          onClick={() => updateField(i, { required: !field.required })}
                          className={`flex items-center gap-1.5 text-xs font-medium px-3 py-2 rounded-lg transition ${
                            field.required ? 'bg-indigo-600 text-white' : 'bg-gray-700 text-gray-400'
                          }`}
                        >
                          <span>{field.required ? '✓' : '○'}</span> Required
                        </button>
                      </div>
                    </div>
                    {field.type === 'select' && (
                      <div className="space-y-2">
                        <label className="text-xs text-gray-400">Options</label>
                        {(field.options ?? []).map((opt, oi) => (
                          <div key={oi} className="flex gap-2">
                            <Input value={opt} onChange={(v) => updateSelectOption(i, oi, v)} placeholder={`Option ${oi + 1}`} />
                            <button onClick={() => removeSelectOption(i, oi)} className="text-gray-500 hover:text-red-400 shrink-0">
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ))}
                        <button
                          type="button"
                          onClick={() => addSelectOption(i)}
                          className="text-xs text-indigo-400 hover:text-indigo-300"
                        >
                          + Add option
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
              <button
                type="button"
                onClick={addField}
                className="mt-3 w-full py-2 border border-dashed border-gray-700 rounded-xl text-gray-400 hover:text-white hover:border-gray-500 text-sm transition"
              >
                + Add form field
              </button>
            </Section>

            {/* Settings */}
            <Section title="Settings">
              <Field label="Session type">
                <button
                  type="button"
                  onClick={() => setField('isPaid', !form.isPaid)}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition ${
                    form.isPaid
                      ? 'bg-amber-600/20 text-amber-300 border border-amber-600/40'
                      : 'bg-green-900/20 text-green-400 border border-green-700/40'
                  }`}
                >
                  <span>{form.isPaid ? '💰' : '✓'}</span>
                  {form.isPaid ? 'Paid session' : 'Free session'}
                </button>
              </Field>
              <Field label="Location">
                <button
                  type="button"
                  onClick={() => setField('locationType', form.locationType === 'online' ? 'in_person' : 'online')}
                  className={`flex items-center gap-2 text-sm font-medium px-4 py-2 rounded-lg transition ${
                    form.locationType === 'in_person'
                      ? 'bg-blue-600/20 text-blue-300 border border-blue-600/40'
                      : 'bg-violet-600/20 text-violet-300 border border-violet-600/40'
                  }`}
                >
                  <span>{form.locationType === 'in_person' ? '📍' : '💻'}</span>
                  {form.locationType === 'in_person' ? 'Face to face' : 'Online'}
                </button>
              </Field>
              <Field
                label="Calendar invite title"
                hint="Tokens: {project} {company} {department} {booker}. Leave blank for the default: [{project}] {company} - {department}"
              >
                <input
                  type="text"
                  value={form.calendarEventTitleTemplate}
                  onChange={(e) => setField('calendarEventTitleTemplate', e.target.value)}
                  placeholder="[{project}] {company} - {department}"
                  className="admin-input"
                />
              </Field>
              <Field label="Booking window" hint="How far ahead someone can book">
                <select
                  value={form.bookingWindowWeeks}
                  onChange={(e) => setField('bookingWindowWeeks', Number(e.target.value))}
                  className="admin-input"
                >
                  {[1, 2, 3, 4, 6, 8, 12].map((w) => (
                    <option key={w} value={w}>{w} week{w > 1 ? 's' : ''} ahead</option>
                  ))}
                </select>
              </Field>
              <Field label="Google Calendar ID" hint="Leave blank to use your primary calendar">
                <Input value={form.calendarId} onChange={(v) => setField('calendarId', v)} placeholder="primary" />
              </Field>
            </Section>

            {error && (
              <div className="bg-red-900/30 border border-red-800 text-red-300 text-sm rounded-xl px-4 py-3">
                {error}
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="flex gap-3 px-6 py-4 border-t border-gray-800">
            <button
              onClick={onCancel}
              className="flex-1 py-2.5 rounded-xl border border-gray-700 text-gray-400 hover:text-white text-sm font-medium transition"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving}
              className="flex-1 py-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold transition disabled:opacity-50"
            >
              {saving ? 'Saving…' : isNew ? 'Create project' : 'Save changes'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <h3 className="text-gray-300 font-semibold text-sm mb-3 pb-2 border-b border-gray-800">{title}</h3>
      <div className="space-y-3">{children}</div>
    </div>
  );
}

function Field({ label, hint, required, children }: { label: string; hint?: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-medium text-gray-400 mb-1">
        {label}{required && <span className="text-red-400 ml-0.5">*</span>}
        {hint && <span className="text-gray-500 font-normal ml-1">— {hint}</span>}
      </label>
      {children}
    </div>
  );
}

function Input({ value, onChange, placeholder }: { value: string; onChange: (v: string) => void; placeholder?: string }) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="admin-input"
    />
  );
}
