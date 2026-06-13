'use client';

import { useState, useEffect, useCallback } from 'react';
import { format, addMonths, subMonths, startOfMonth, endOfMonth, eachDayOfInterval, isSameMonth, isToday, isBefore, startOfDay, addWeeks, isSameDay, parseISO } from 'date-fns';
import type { Project } from '@/config/projects';
import { formatDuration } from '@/lib/utils';
import type { TimeSlot } from '@/lib/google-calendar';

type Step = 'calendar' | 'timeslot' | 'form' | 'submitting' | 'done' | 'pending';

interface FormData {
  name: string;
  email: string;
  phone: string;
  company: string;
  customFields: Record<string, string>;
}

interface BookingResult {
  projectName: string;
  company: string;
  name: string;
  email: string;
  startISO: string;
  endISO: string;
}

const colorStyles: Record<string, {
  header: string;
  btn: string;
  btnOutline: string;
  selectedDay: string;
  selectedSlot: string;
  dot: string;
  step: string;
}> = {
  violet: {
    header: 'bg-violet-700',
    btn: 'bg-violet-700 hover:bg-violet-800 text-white',
    btnOutline: 'border-violet-300 text-violet-700 hover:bg-violet-50',
    selectedDay: 'bg-violet-700 text-white',
    selectedSlot: 'bg-violet-700 border-violet-700 text-white',
    dot: 'bg-violet-400',
    step: 'bg-violet-700',
  },
  teal: {
    header: 'bg-teal-600',
    btn: 'bg-teal-600 hover:bg-teal-700 text-white',
    btnOutline: 'border-teal-300 text-teal-600 hover:bg-teal-50',
    selectedDay: 'bg-teal-600 text-white',
    selectedSlot: 'bg-teal-600 border-teal-600 text-white',
    dot: 'bg-teal-400',
    step: 'bg-teal-600',
  },
  indigo: {
    header: 'bg-indigo-700',
    btn: 'bg-indigo-700 hover:bg-indigo-800 text-white',
    btnOutline: 'border-indigo-300 text-indigo-700 hover:bg-indigo-50',
    selectedDay: 'bg-indigo-700 text-white',
    selectedSlot: 'bg-indigo-700 border-indigo-700 text-white',
    dot: 'bg-indigo-400',
    step: 'bg-indigo-700',
  },
  blue: {
    header: 'bg-blue-700',
    btn: 'bg-blue-700 hover:bg-blue-800 text-white',
    btnOutline: 'border-blue-300 text-blue-700 hover:bg-blue-50',
    selectedDay: 'bg-blue-700 text-white',
    selectedSlot: 'bg-blue-700 border-blue-700 text-white',
    dot: 'bg-blue-400',
    step: 'bg-blue-700',
  },
  emerald: {
    header: 'bg-emerald-700',
    btn: 'bg-emerald-700 hover:bg-emerald-800 text-white',
    btnOutline: 'border-emerald-300 text-emerald-700 hover:bg-emerald-50',
    selectedDay: 'bg-emerald-700 text-white',
    selectedSlot: 'bg-emerald-700 border-emerald-700 text-white',
    dot: 'bg-emerald-400',
    step: 'bg-emerald-700',
  },
  rose: {
    header: 'bg-rose-700',
    btn: 'bg-rose-700 hover:bg-rose-800 text-white',
    btnOutline: 'border-rose-300 text-rose-700 hover:bg-rose-50',
    selectedDay: 'bg-rose-700 text-white',
    selectedSlot: 'bg-rose-700 border-rose-700 text-white',
    dot: 'bg-rose-400',
    step: 'bg-rose-700',
  },
  amber: {
    header: 'bg-amber-600',
    btn: 'bg-amber-600 hover:bg-amber-700 text-white',
    btnOutline: 'border-amber-300 text-amber-600 hover:bg-amber-50',
    selectedDay: 'bg-amber-600 text-white',
    selectedSlot: 'bg-amber-600 border-amber-600 text-white',
    dot: 'bg-amber-400',
    step: 'bg-amber-600',
  },
};

function getStyles(color: string) {
  return colorStyles[color] ?? colorStyles.indigo;
}

interface Props {
  project: Project;
}

export function BookingFlow({ project }: Props) {
  const styles = getStyles(project.branding.primaryColor);
  const [step, setStep] = useState<Step>('calendar');
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [slots, setSlots] = useState<TimeSlot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<TimeSlot | null>(null);
  const [form, setForm] = useState<FormData>({
    name: '',
    email: '',
    phone: '',
    company: '',
    customFields: {},
  });
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [result, setResult] = useState<BookingResult | null>(null);

  const today = startOfDay(new Date());
  const maxDate = addWeeks(today, project.bookingWindowWeeks);

  const fetchSlots = useCallback(async (date: Date) => {
    setLoadingSlots(true);
    setSlots([]);
    try {
      const dateStr = format(date, 'yyyy-MM-dd');
      const res = await fetch(`/api/availability?slug=${project.slug}&date=${dateStr}`);
      const data = await res.json();
      setSlots(data.slots ?? []);
    } catch {
      setSlots([]);
    } finally {
      setLoadingSlots(false);
    }
  }, [project.slug]);

  useEffect(() => {
    if (selectedDate) {
      fetchSlots(selectedDate);
    }
  }, [selectedDate, fetchSlots]);

  // Calendar helpers
  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const daysInMonth = eachDayOfInterval({ start: monthStart, end: monthEnd });
  const startPadding = monthStart.getDay(); // 0=Sun

  function isDayDisabled(day: Date) {
    if (isBefore(day, today)) return true;
    if (isBefore(maxDate, day)) return true;
    // Check if this day has any configured slots
    const dayOfWeek = day.getDay() as 0 | 1 | 2 | 3 | 4 | 5 | 6;
    const hasSlot = project.timeSlots.some((t) => t.days.includes(dayOfWeek));
    if (!hasSlot) return true;
    // Check blocked dates
    if (project.blockedDates?.includes(format(day, 'yyyy-MM-dd'))) return true;
    return false;
  }

  function validateForm(): boolean {
    const errors: Record<string, string> = {};
    if (!form.name.trim()) errors.name = 'Name is required';
    if (!form.email.trim()) errors.email = 'Email is required';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) errors.email = 'Invalid email';

    for (const field of project.customFields) {
      if (field.required && !form.customFields[field.id]?.trim()) {
        errors[field.id] = `${field.label} is required`;
      }
    }
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!validateForm() || !selectedSlot) return;

    setStep('submitting');
    setSubmitError('');

    try {
      const res = await fetch('/api/book', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slug: project.slug,
          startISO: selectedSlot.startISO,
          endISO: selectedSlot.endISO,
          name: form.name,
          email: form.email,
          phone: form.phone,
          company: form.customFields.company_name || form.company,
          customFields: form.customFields,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setSubmitError(data.error ?? 'Something went wrong');
        setStep('form');
        return;
      }

      if (data.pendingApproval) {
        setStep('pending');
        return;
      }

      setResult(data.booking);
      setStep('done');
    } catch {
      setSubmitError('Network error. Please try again.');
      setStep('form');
    }
  }

  // ─── STEP: Calendar ────────────────────────────────────────────────────────
  if (step === 'calendar') {
    return (
      <div className="animate-fade-in">
        <p className="text-sm text-gray-500 mb-4">Select a date to see available times</p>

        {/* Month nav */}
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            disabled={isBefore(endOfMonth(subMonths(currentMonth, 1)), today)}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="font-semibold text-gray-900">
            {format(currentMonth, 'MMMM yyyy')}
          </span>
          <button
            onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            disabled={isBefore(maxDate, startOfMonth(addMonths(currentMonth, 1)))}
            className="p-2 rounded-lg hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition"
          >
            <svg className="w-5 h-5 text-gray-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Day headers */}
        <div className="grid grid-cols-7 mb-1">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((d) => (
            <div key={d} className="text-center text-xs font-medium text-gray-400 py-1">
              {d}
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: startPadding }).map((_, i) => (
            <div key={`pad-${i}`} />
          ))}
          {daysInMonth.map((day) => {
            const disabled = isDayDisabled(day);
            const isSelected = selectedDate ? isSameDay(day, selectedDate) : false;
            const today_ = isToday(day);

            return (
              <button
                key={day.toISOString()}
                disabled={disabled}
                onClick={() => {
                  setSelectedDate(day);
                  setStep('timeslot');
                }}
                className={`
                  aspect-square rounded-lg text-sm font-medium transition-all
                  flex items-center justify-center relative
                  ${disabled
                    ? 'text-gray-300 cursor-not-allowed'
                    : isSelected
                    ? `${styles.selectedDay} shadow-sm`
                    : today_
                    ? 'text-gray-900 ring-2 ring-gray-300 hover:ring-0 hover:bg-gray-100'
                    : `text-gray-700 hover:bg-gray-100`
                  }
                `}
              >
                {format(day, 'd')}
                {!disabled && !isSelected && (
                  <span className={`absolute bottom-0.5 left-1/2 -translate-x-1/2 w-1 h-1 rounded-full ${styles.dot} opacity-60`} />
                )}
              </button>
            );
          })}
        </div>

        <p className="mt-4 text-xs text-gray-400 text-center">
          Times shown in Philippines Standard Time (PST)
        </p>
      </div>
    );
  }

  // ─── STEP: Time slots ─────────────────────────────────────────────────────
  if (step === 'timeslot') {
    return (
      <div className="animate-slide-up">
        <button
          onClick={() => { setStep('calendar'); setSelectedSlot(null); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-4 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          {selectedDate ? format(selectedDate, 'EEEE, MMMM d') : 'Back'}
        </button>

        <p className="text-sm font-semibold text-gray-700 mb-3">Available times</p>

        {loadingSlots ? (
          <div className="flex items-center justify-center py-8">
            <div className="w-6 h-6 border-2 border-gray-200 border-t-gray-500 rounded-full animate-spin" />
          </div>
        ) : slots.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500 text-sm">No slots available on this day.</p>
            <button
              onClick={() => setStep('calendar')}
              className="mt-3 text-sm text-gray-600 underline"
            >
              Pick a different date
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-2">
            {slots.map((slot) => (
              <button
                key={slot.startISO}
                disabled={!slot.available}
                onClick={() => {
                  setSelectedSlot(slot);
                  setStep('form');
                }}
                className={`
                  w-full py-3 px-4 rounded-xl border-2 text-sm font-medium transition-all
                  flex items-center justify-between
                  ${!slot.available
                    ? 'border-gray-100 text-gray-300 cursor-not-allowed bg-gray-50'
                    : `border-gray-200 text-gray-700 hover:border-${project.branding.primaryColor}-400 hover:bg-${project.branding.primaryColor}-50`
                  }
                `}
              >
                <span>{slot.label} – {slot.endLabel}</span>
                {slot.available ? (
                  <span className="text-xs text-gray-400">{formatDuration(project.durationMinutes)}</span>
                ) : (
                  <span className="text-xs text-gray-300">Unavailable</span>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ─── STEP: Form ───────────────────────────────────────────────────────────
  if (step === 'form') {
    return (
      <div className="animate-slide-up">
        <button
          onClick={() => { setStep('timeslot'); }}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 mb-1 transition"
        >
          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          Back
        </button>

        {/* Slot summary */}
        {selectedSlot && selectedDate && (
          <div className="bg-gray-50 rounded-xl p-3 mb-5 text-sm text-gray-600">
            <span className="font-semibold text-gray-800">{format(selectedDate, 'EEE, MMM d')}</span>
            {' · '}
            {selectedSlot.label} – {selectedSlot.endLabel}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Core fields */}
          <Field label="Full name" error={formErrors.name} required>
            <input
              type="text"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="Your full name"
              className="input-field"
            />
          </Field>

          <Field label="Email" error={formErrors.email} required>
            <input
              type="email"
              value={form.email}
              onChange={(e) => setForm({ ...form, email: e.target.value })}
              placeholder="you@example.com"
              className="input-field"
            />
          </Field>

          <Field label="Phone number" error={formErrors.phone}>
            <input
              type="tel"
              value={form.phone}
              onChange={(e) => setForm({ ...form, phone: e.target.value })}
              placeholder="+63 917 000 0000"
              className="input-field"
            />
          </Field>

          {/* Hide core company field if project has its own company_name custom field */}
          {!project.customFields.some((f) => f.id === 'company_name') && (
            <Field label="Company / Organisation" error={formErrors.company}>
              <input
                type="text"
                value={form.company}
                onChange={(e) => setForm({ ...form, company: e.target.value })}
                placeholder="Where are you from?"
                className="input-field"
              />
            </Field>
          )}

          {/* Custom fields */}
          {project.customFields.map((field) => (
            <Field key={field.id} label={field.label} error={formErrors[field.id]} required={field.required}>
              {field.type === 'textarea' ? (
                <textarea
                  value={form.customFields[field.id] ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, customFields: { ...form.customFields, [field.id]: e.target.value } })
                  }
                  placeholder={field.placeholder}
                  rows={3}
                  className="input-field resize-none"
                />
              ) : field.type === 'select' ? (
                <select
                  value={form.customFields[field.id] ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, customFields: { ...form.customFields, [field.id]: e.target.value } })
                  }
                  className="input-field"
                >
                  <option value="">Select an option…</option>
                  {field.options?.map((opt) => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="text"
                  value={form.customFields[field.id] ?? ''}
                  onChange={(e) =>
                    setForm({ ...form, customFields: { ...form.customFields, [field.id]: e.target.value } })
                  }
                  placeholder={field.placeholder}
                  className="input-field"
                />
              )}
            </Field>
          ))}

          {submitError && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3">
              {submitError}
            </div>
          )}

          <button
            type="submit"
            className={`w-full py-3.5 rounded-xl font-semibold text-sm transition ${styles.btn}`}
          >
            Confirm booking
          </button>

          <p className="text-xs text-gray-400 text-center">
            A confirmation email will be sent to your email address.
          </p>
        </form>
      </div>
    );
  }

  // ─── STEP: Submitting ────────────────────────────────────────────────────
  if (step === 'submitting') {
    return (
      <div className="flex flex-col items-center justify-center py-12 animate-fade-in">
        <div className="w-10 h-10 border-3 border-gray-200 border-t-gray-700 rounded-full animate-spin mb-4" />
        <p className="text-gray-500 text-sm">Booking your slot…</p>
      </div>
    );
  }

  // ─── STEP: Pending approval ───────────────────────────────────────────────
  if (step === 'pending' && selectedSlot && selectedDate) {
    return (
      <div className="text-center animate-slide-up">
        <div className="w-16 h-16 bg-amber-100 rounded-full flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">Request received!</h3>
        <p className="text-gray-500 text-sm mb-6">
          Chii will confirm your booking within <strong>24 hours</strong>.<br/>
          Check your email for updates.
        </p>
        <div className="bg-gray-50 rounded-2xl p-5 text-left mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{project.name}</p>
          <p className="text-base font-semibold text-gray-900">
            {format(selectedDate, 'EEEE, MMMM d, yyyy')}
          </p>
          <p className="text-gray-600 text-sm mt-0.5">
            {selectedSlot.label} – {selectedSlot.endLabel}
          </p>
        </div>
        <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline">
          Back to home
        </a>
      </div>
    );
  }

  // ─── STEP: Done ───────────────────────────────────────────────────────────
  if (step === 'done' && result) {
    const startZoned = parseISO(result.startISO);
    const endZoned = parseISO(result.endISO);

    return (
      <div className="text-center animate-slide-up">
        <div className={`w-16 h-16 ${styles.btn} rounded-full flex items-center justify-center mx-auto mb-4`}>
          <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <h3 className="text-xl font-bold text-gray-900 mb-1">You&apos;re booked!</h3>
        <p className="text-gray-500 text-sm mb-6">
          A confirmation has been sent to <strong>{result.email}</strong>
        </p>

        <div className="bg-gray-50 rounded-2xl p-5 text-left mb-6">
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">{result.projectName}</p>
          <p className="text-base font-semibold text-gray-900">
            {format(startZoned, 'EEEE, MMMM d, yyyy')}
          </p>
          <p className="text-gray-600 text-sm mt-0.5">
            {format(startZoned, 'h:mm a')} – {format(endZoned, 'h:mm a')}
          </p>
        </div>

        <a href="/" className="text-sm text-gray-500 hover:text-gray-700 underline">
          Book another session
        </a>
      </div>
    );
  }

  return null;
}

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">
        {label}
        {required && <span className="text-red-400 ml-0.5">*</span>}
      </label>
      {children}
      {error && <p className="mt-1 text-xs text-red-500">{error}</p>}
    </div>
  );
}
