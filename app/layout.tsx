import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'ADE 2026 — Parties',
  description: 'A mobile-first calendar of Amsterdam Dance Event 2026 parties.',
  manifest: '/manifest.json',
};

export const viewport: Viewport = {
  themeColor: '#0b0b12',
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
