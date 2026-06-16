import Link from 'next/link';
import type { Project } from '@/config/projects';
import { formatDuration } from '@/lib/utils';

interface Props {
  project: Project;
}

const colorMap: Record<string, { bg: string; text: string; border: string; badge: string }> = {
  violet: {
    bg: 'bg-violet-50 hover:bg-violet-100',
    text: 'text-violet-700',
    border: 'border-violet-200 hover:border-violet-400',
    badge: 'bg-violet-100 text-violet-700',
  },
  teal: {
    bg: 'bg-teal-50 hover:bg-teal-100',
    text: 'text-teal-700',
    border: 'border-teal-200 hover:border-teal-400',
    badge: 'bg-teal-100 text-teal-700',
  },
  indigo: {
    bg: 'bg-indigo-50 hover:bg-indigo-100',
    text: 'text-indigo-700',
    border: 'border-indigo-200 hover:border-indigo-400',
    badge: 'bg-indigo-100 text-indigo-700',
  },
  blue: {
    bg: 'bg-blue-50 hover:bg-blue-100',
    text: 'text-blue-700',
    border: 'border-blue-200 hover:border-blue-400',
    badge: 'bg-blue-100 text-blue-700',
  },
  emerald: {
    bg: 'bg-emerald-50 hover:bg-emerald-100',
    text: 'text-emerald-700',
    border: 'border-emerald-200 hover:border-emerald-400',
    badge: 'bg-emerald-100 text-emerald-700',
  },
  rose: {
    bg: 'bg-rose-50 hover:bg-rose-100',
    text: 'text-rose-700',
    border: 'border-rose-200 hover:border-rose-400',
    badge: 'bg-rose-100 text-rose-700',
  },
  amber: {
    bg: 'bg-amber-50 hover:bg-amber-100',
    text: 'text-amber-700',
    border: 'border-amber-200 hover:border-amber-400',
    badge: 'bg-amber-100 text-amber-700',
  },
};

function getColors(color: string) {
  return colorMap[color] ?? colorMap['indigo'];
}

export function ProjectCard({ project }: Props) {
  const colors = getColors(project.branding.primaryColor);

  return (
    <Link href={`/${project.slug}`} className="block group">
      <div
        className={`
          rounded-2xl border-2 p-6 transition-all duration-200
          ${colors.bg} ${colors.border}
          group-hover:shadow-md group-hover:-translate-y-0.5
        `}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              {project.branding.emoji && (
                <span className="text-2xl leading-none">{project.branding.emoji}</span>
              )}
              <span className={`text-xs font-semibold uppercase tracking-wider ${colors.text}`}>
                {project.company}
              </span>
            </div>
            <h3 className="text-lg font-bold text-gray-900 leading-snug mb-2">
              {project.name}
            </h3>
            <p className="text-sm text-gray-600 leading-relaxed line-clamp-3">
              {project.description}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 mt-4 flex-wrap">
          <span className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full ${colors.badge}`}>
            <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            {formatDuration(project.durationMinutes)}
          </span>
          <span className={`inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full ${
            project.isPaid ? 'bg-amber-100 text-amber-700' : 'bg-green-100 text-green-700'
          }`}>
            {project.isPaid ? 'Paid' : 'Free'}
          </span>
          <span className="text-xs text-gray-400">·</span>
          <span className="text-xs text-gray-500">{project.tagline}</span>
        </div>

        <div className={`flex items-center gap-1 mt-4 text-sm font-semibold ${colors.text}`}>
          Book a slot
          <svg className="w-4 h-4 transition-transform group-hover:translate-x-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
          </svg>
        </div>
      </div>
    </Link>
  );
}
