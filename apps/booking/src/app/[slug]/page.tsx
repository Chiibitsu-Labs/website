import { notFound } from 'next/navigation';
import type { Metadata } from 'next';
import { siteConfig } from '@/config/projects';
import { getProjectBySlug } from '@/lib/db';
import { BookingFlow } from '@/components/BookingFlow';
import { formatDuration } from '@/lib/utils';
import { verifyRescheduleToken } from '@/lib/reschedule-token';
import { format, parseISO, addDays, isBefore } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import Link from 'next/link';

const TIMEZONE = process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila';

interface Props {
  params: { slug: string };
  searchParams: { reschedule?: string | string[] };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const project = await getProjectBySlug(params.slug);
  if (!project) return {};
  return {
    title: `Book: ${project.name}`,
    description: project.description,
  };
}

export default async function BookPage({ params, searchParams }: Props) {
  const project = await getProjectBySlug(params.slug);
  if (!project) notFound();

  // Handle reschedule mode
  const rescheduleParam = typeof searchParams.reschedule === 'string' ? searchParams.reschedule : undefined;
  let rescheduleInfo: {
    token: string;
    originalLabel: string;
    prefill: { name: string; email: string; phone: string; company: string; customFields: Record<string, string> };
  } | null = null;
  let rescheduleWindowClosed = false;

  if (rescheduleParam) {
    const payload = verifyRescheduleToken(rescheduleParam);
    if (payload) {
      const canReschedule = isBefore(addDays(new Date(), 7), parseISO(payload.originalStartISO));
      if (!canReschedule) {
        rescheduleWindowClosed = true;
      } else {
        const zonedOriginal = toZonedTime(parseISO(payload.originalStartISO), TIMEZONE);
        rescheduleInfo = {
          token: rescheduleParam,
          originalLabel: format(zonedOriginal, "EEE, MMM d 'at' h:mm a"),
          prefill: {
            name: payload.bookerName,
            email: payload.bookerEmail,
            phone: payload.bookerPhone,
            company: payload.bookerCompany,
            customFields: payload.customFields,
          },
        };
      }
    }
  }

  const headerColors: Record<string, string> = {
    violet: 'bg-violet-700',
    teal: 'bg-teal-600',
    indigo: 'bg-indigo-700',
    blue: 'bg-blue-700',
    emerald: 'bg-emerald-700',
    rose: 'bg-rose-700',
    amber: 'bg-amber-600',
  };

  const headerColor = headerColors[project.branding.primaryColor] ?? 'bg-indigo-700';

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Project header */}
      <div className={`${headerColor} px-4 py-8`}>
        <div className="max-w-lg mx-auto">
          <Link href="/" className="text-white/60 text-sm hover:text-white/90 transition flex items-center gap-1 mb-4">
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            All sessions
          </Link>

          <div className="flex items-start gap-3">
            {project.branding.emoji && (
              <span className="text-3xl leading-none mt-0.5">{project.branding.emoji}</span>
            )}
            <div>
              <p className="text-white/70 text-sm font-medium mb-0.5">{project.company}</p>
              <h1 className="text-white font-bold text-2xl leading-tight">{project.name}</h1>
              <p className="text-white/80 text-sm mt-1">{project.tagline}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 mt-5 text-white/70 text-sm">
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              {formatDuration(project.durationMinutes)}
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 10l4.553-2.069A1 1 0 0121 8.87v6.26a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
              </svg>
              Video call
            </span>
            <span className="flex items-center gap-1.5">
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
              </svg>
              PST (UTC+8)
            </span>
          </div>
        </div>
      </div>

      {/* Description */}
      <div className="max-w-lg mx-auto px-4 py-5">
        <p className="text-gray-600 text-sm leading-relaxed">{project.description}</p>
      </div>

      {/* Booking widget */}
      <div className="max-w-lg mx-auto px-4 pb-16">
        {rescheduleWindowClosed && (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-4 text-sm text-amber-800">
            <p className="font-semibold mb-1">Reschedule window closed</p>
            <p>Bookings can only be rescheduled more than 7 days before the session date. To cancel or get help, reply to your confirmation email.</p>
          </div>
        )}

        {rescheduleInfo && (
          <div className="bg-blue-50 border border-blue-100 rounded-xl p-4 mb-4 text-sm">
            <p className="font-semibold text-blue-900">Rescheduling your booking</p>
            <p className="text-blue-700 mt-0.5">Currently booked: {rescheduleInfo.originalLabel}</p>
            <p className="text-blue-600 text-xs mt-1">Pick a new date and time below. Your original slot will be released once your new booking is confirmed.</p>
          </div>
        )}

        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6">
          {!rescheduleWindowClosed && (
            <>
              <h2 className="font-semibold text-gray-900 text-base mb-5">
                {rescheduleInfo ? 'Choose a new date & time' : 'Select a date & time'}
              </h2>
              <BookingFlow
                project={project}
                rescheduleToken={rescheduleInfo?.token}
                prefill={rescheduleInfo?.prefill}
              />
            </>
          )}
        </div>

        <p className="text-xs text-gray-400 text-center mt-4">
          Powered by {siteConfig.brandName}
        </p>
      </div>
    </div>
  );
}
