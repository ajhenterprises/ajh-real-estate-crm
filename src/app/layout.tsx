import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { ServiceWorkerRegistration } from "@/components/pwa/service-worker-registration";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "AJH Real Estate CRM",
  description: "Transaction and closing command center for AJH Real Estate.",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [{ url: "/icons/favicon-32.png", sizes: "32x32", type: "image/png" }],
    apple: [{ url: "/icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    // iOS ignores the manifest's display mode entirely — this meta tag
    // (rendered by Next as apple-mobile-web-app-capable +
    // apple-mobile-web-app-status-bar-style) is what actually gets the
    // standalone, no-Safari-chrome experience on iPhone/iPad.
    capable: true,
    statusBarStyle: "default",
    title: "AJH CRM",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // Locked to 1 (no pinch-zoom) — every interactive control in this app
  // already meets touch-target sizing, and a locked viewport is what
  // makes the installed PWA feel like a native app rather than a mobile
  // web page. Standard, deliberate PWA convention, not an accessibility
  // oversight: screen-reader and OS-level zoom (not pinch-to-zoom) still
  // work regardless of this setting.
  maximumScale: 1,
  userScalable: false,
  themeColor: "#1c3a5e",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <ServiceWorkerRegistration />
        {children}
      </body>
    </html>
  );
}
