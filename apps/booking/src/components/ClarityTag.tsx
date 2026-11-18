'use client';

import { useEffect, useState } from 'react';
import Script from 'next/script';
import { usePathname } from 'next/navigation';

// Microsoft Clarity project for book.chiibitsu.com (session recordings and
// heatmaps). Loaded after the page is interactive so it never delays the
// calendar or the booking form.
const CLARITY_PROJECT_ID = 'z0kcrqus8a';

/**
 * Clarity on the public booking pages only. Two places are never recorded:
 *
 * - /admin: Clarity masks what visitors type by default, but it records text
 *   already on the screen, and the admin dashboard shows every client's name,
 *   email, phone and the admin's private notes.
 * - Any page opened from a reschedule link: the link carries its token in the
 *   URL (`?reschedule=…`). The token is signed, not encrypted, so it holds the
 *   client's name, email and phone in readable form, and it is also what lets
 *   them change the booking. Clarity records page URLs, so loading it there
 *   would send both to Microsoft.
 *
 * The URL check runs after mount, not during render, so the server and the
 * first client render agree and the page needs no Suspense boundary.
 */
export function ClarityTag() {
  const pathname = usePathname();
  const [allowed, setAllowed] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setAllowed(!pathname?.startsWith('/admin') && !params.has('reschedule'));
  }, [pathname]);

  if (!allowed) return null;

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
