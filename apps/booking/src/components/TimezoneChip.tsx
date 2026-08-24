'use client';

import { useEffect, useState } from 'react';
import { HOST_TIMEZONE, friendlyZoneName, zoneAbbreviation } from '@/lib/timezone';

/**
 * Shows the timezone the booking times are displayed in. Server-renders the
 * host timezone (so hydration matches), then swaps to the viewer's own zone
 * once mounted — matching what BookingFlow renders the slot times in.
 */
export function TimezoneChip() {
  const [viewerZone, setViewerZone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setViewerZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Very old browsers: keep the host timezone label.
    }
  }, []);

  const zone = viewerZone ?? HOST_TIMEZONE;
  const abbr = zoneAbbreviation(zone);

  return (
    <span className="flex items-center gap-1.5">
      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
      </svg>
      {friendlyZoneName(zone)}{abbr ? ` (${abbr})` : ''}
    </span>
  );
}
