// ─────────────────────────────────────────────────────────────────────────────
// SEED PROJECTS — initial data loaded into the database on first setup.
// Once the database is connected, manage projects from the /admin UI instead.
// ─────────────────────────────────────────────────────────────────────────────

export type DayOfWeek = 0 | 1 | 2 | 3 | 4 | 5 | 6; // 0=Sun, 1=Mon, ... 6=Sat

export interface TimeSlotTemplate {
  days: DayOfWeek[];
  startHour: number;   // 24h format, e.g. 9 = 9:00 AM
  startMinute: number; // e.g. 0 or 30
}

export interface CustomField {
  id: string;
  label: string;
  type: 'text' | 'textarea' | 'select';
  options?: string[];
  required: boolean;
  placeholder?: string;
}

export interface ProjectBranding {
  primaryColor: string;   // Tailwind color, e.g. "violet"
  shade: string;          // Tailwind shade, e.g. "700"
  lightShade: string;     // For backgrounds, e.g. "50"
  emoji?: string;         // Optional emoji shown on the card
}

export interface Project {
  slug: string;
  name: string;
  company: string;
  tagline: string;
  description: string;
  durationMinutes: number;
  branding: ProjectBranding;
  timeSlots: TimeSlotTemplate[];
  customFields: CustomField[];
  // Optional: override the default Google Calendar ID for this project
  calendarId?: string;
  // Optional: specific dates to block out (YYYY-MM-DD)
  blockedDates?: string[];
  // How many weeks ahead can someone book?
  bookingWindowWeeks: number;
}

// ─────────────────────────────────────────────────────────────────────────────
// YOUR PROJECTS
// ─────────────────────────────────────────────────────────────────────────────

export const SEED_PROJECTS: Project[] = [
  {
    slug: 'ai-at-work',
    name: 'AI @ Work: Use Case Lab',
    company: 'Futureproof',
    tagline: 'AI Training for Companies',
    description:
      'A hands-on half-day workshop helping your team identify and prototype real AI use cases for your business. Perfect for leadership teams, operations, and product groups ready to move from curiosity to action.',
    durationMinutes: 240, // 4 hours
    branding: {
      primaryColor: 'violet',
      shade: '700',
      lightShade: '50',
      emoji: '⚡',
    },
    timeSlots: [
      // Tuesday and Wednesday, 9 AM–1 PM (morning session)
      { days: [2, 3], startHour: 9, startMinute: 0 },
      // Tuesday and Wednesday, 1 PM–5 PM (afternoon session)
      { days: [2, 3], startHour: 13, startMinute: 0 },
    ],
    customFields: [
      {
        id: 'company_name',
        label: 'Company Name',
        type: 'text',
        required: true,
        placeholder: 'Acme Inc.',
      },
      {
        id: 'team_size',
        label: 'Estimated team size attending',
        type: 'select',
        options: ['1–5', '6–15', '16–30', '30+'],
        required: true,
      },
      {
        id: 'use_case_focus',
        label: 'What area of your business are you hoping to improve with AI?',
        type: 'textarea',
        required: false,
        placeholder: 'e.g. customer support, content creation, operations…',
      },
    ],
    bookingWindowWeeks: 8,
  },
  {
    slug: 'aicos-fit-call',
    name: 'AICOS Fit Call',
    company: 'Lighthouse',
    tagline: 'Discovery Call for AICOS',
    description:
      'A focused 45-minute discovery call to explore if AICOS is the right fit for you or your organisation. We\'ll cover your current challenges, goals, and how AI-powered coaching can help you get there.',
    durationMinutes: 45,
    branding: {
      primaryColor: 'teal',
      shade: '600',
      lightShade: '50',
      emoji: '🧭',
    },
    timeSlots: [
      // Monday, Wednesday, Friday — mornings
      { days: [1, 3, 5], startHour: 10, startMinute: 0 },
      { days: [1, 3, 5], startHour: 11, startMinute: 0 },
      // Monday, Wednesday — afternoons
      { days: [1, 3], startHour: 14, startMinute: 0 },
      { days: [1, 3], startHour: 15, startMinute: 0 },
    ],
    customFields: [
      {
        id: 'role',
        label: 'What\'s your role?',
        type: 'text',
        required: false,
        placeholder: 'e.g. HR Manager, Founder, Coach…',
      },
      {
        id: 'how_did_you_hear',
        label: 'How did you hear about AICOS?',
        type: 'select',
        options: ['Social media', 'Referral', 'Lighthouse website', 'Event / workshop', 'Other'],
        required: false,
      },
      {
        id: 'what_you_want',
        label: 'What are you hoping to get out of this call?',
        type: 'textarea',
        required: false,
        placeholder: 'Tell us a bit about your current situation…',
      },
    ],
    bookingWindowWeeks: 4,
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// SITE CONFIG
// ─────────────────────────────────────────────────────────────────────────────

export const siteConfig = {
  ownerName: 'Chii',
  brandName: 'Chiibitsu Labs',
  tagline: 'Book a session',
  timezone: process.env.NEXT_PUBLIC_TIMEZONE ?? 'Asia/Manila',
};

