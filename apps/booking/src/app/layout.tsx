import type { Metadata } from 'next';
import './globals.css';
import { siteConfig } from '@/config/projects';
import { SpeedInsights } from '@vercel/speed-insights/next';
import { Analytics } from '@vercel/analytics/next';

export const metadata: Metadata = {
  title: {
    default: `Book a Session — ${siteConfig.brandName}`,
    template: `%s — ${siteConfig.brandName}`,
  },
  description: `Book a session with ${siteConfig.ownerName} at ${siteConfig.brandName}`,
  metadataBase: new URL(process.env.NEXT_PUBLIC_BASE_URL ?? 'https://booking.chiibitsu.com'),
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-white text-gray-900">
        {children}
        <SpeedInsights />
        <Analytics />
      </body>
    </html>
  );
}
