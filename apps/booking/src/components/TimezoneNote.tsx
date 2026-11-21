'use client';

import { useEffect, useState } from 'react';
import { HOST_TIMEZONE, friendlyZoneName, zoneDescription, zonesDiffer } from '@/lib/timezone';

/**
 * Footer line naming the zone booking times are shown in.
 *
 * The project pages render slot times in the visitor's own zone, so a hard-coded
 * "Philippine time" note here contradicted them for every overseas booker.
 * Server-renders the host zone (hydration-safe), then swaps to the viewer's once
 * mounted — and says so explicitly when the two differ, since the session itself
 * is still scheduled on Chii's calendar.
 */
export function TimezoneNote() {
  const [viewerZone, setViewerZone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setViewerZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Very old browsers: keep the host timezone label.
    }
  }, []);

  const zone = viewerZone ?? HOST_TIMEZONE;

  return (
    <>
      All times shown in {zoneDescription(zone)}
      {/* Same clock under a different id (Manila vs Taipei) is nothing to
          clarify — compare offsets, not the id strings. */}
      {viewerZone && zonesDiffer(viewerZone, HOST_TIMEZONE)
        ? ` · sessions run from ${friendlyZoneName(HOST_TIMEZONE)}`
        : ''}
    </>
  );
}
