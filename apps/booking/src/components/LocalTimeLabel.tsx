'use client';

import { useEffect, useState } from 'react';
import {
  HOST_TIMEZONE,
  formatDateInZone,
  formatTimeInZone,
  zoneDescription,
} from '@/lib/timezone';

/**
 * One instant, rendered in the viewer's own timezone with the zone named.
 *
 * Server-renders in the host zone so hydration matches, then swaps once mounted
 * — the same pattern as TimezoneChip and the slot rows. The zone label is never
 * omitted: an unlabelled time on a page that mixes zones is worse than no time
 * at all, because the reader has no way to tell which clock it is on.
 */
export function LocalTimeLabel({ iso }: { iso: string }) {
  const [viewerZone, setViewerZone] = useState<string | null>(null);

  useEffect(() => {
    try {
      setViewerZone(Intl.DateTimeFormat().resolvedOptions().timeZone);
    } catch {
      // Very old browsers: keep the host timezone labels.
    }
  }, []);

  const zone = viewerZone ?? HOST_TIMEZONE;
  const at = new Date(iso);

  return (
    <>
      {formatDateInZone(iso, zone)} at {formatTimeInZone(iso, zone)}{' '}
      <span className="text-blue-500">({zoneDescription(zone, at)})</span>
    </>
  );
}
