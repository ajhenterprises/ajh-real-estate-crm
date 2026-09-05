import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'AJH | Real Estate CRM', description: 'Your private real estate closing desk: contacts, transactions, deadlines and documents.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}
