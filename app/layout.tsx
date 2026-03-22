import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'PassPort Pro – Instant Passport Photos',
  description: 'Upload your photo, remove background, generate 4x6 or A4 passport photo sheets instantly.',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
