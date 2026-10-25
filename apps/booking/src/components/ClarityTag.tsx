'use client';

import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Microsoft Clarity project for book.chiibitsu.com (session recordings and
// heatmaps). Loaded after the page is interactive so it never delays the
// calendar or the booking form.
const CLARITY_PROJECT_ID = 'z0kcrqus8a';

/**
 * Clarity on the public booking pages only, never on /admin.
 *
 * Clarity masks what visitors type into fields by default, but it records
 * text already on the screen. The admin dashboard shows every client's name,
 * email, phone and the admin's private notes, so a recording there would send
 * all of it to Microsoft.
 */
export function ClarityTag() {
  const pathname = usePathname();
  if (pathname?.startsWith('/admin')) return null;

  return (
    <Script id="microsoft-clarity" strategy="afterInteractive">
      {`(function(c,l,a,r,i,t,y){
        c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
        t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
        y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y);
      })(window, document, "clarity", "script", "${CLARITY_PROJECT_ID}");`}
    </Script>
  );
}
