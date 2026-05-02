import type { Metadata, Viewport } from "next";
import "./globals.css";
import PushNotificationManager from "@/components/PushNotificationManager";

export const metadata: Metadata = {
  title: "White Gloves Technologies | Attendance System",
  description: "Attendance and workforce tracking system for White Gloves Technologies employees.",
  keywords: "attendance, White Gloves, profile management, workplace tools",
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "MWG Attendance",
  },
  manifest: "/manifest.json",
  icons: {
    icon: '/logo.png',
    shortcut: '/logo.png',
    apple: '/logo.png',
  }
};

export const viewport: Viewport = {
  themeColor: "#000000",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};


export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning className="bg-black">
      <head>
        <link rel="icon" href="/logo.png" />
        <link rel="shortcut icon" href="/logo.png" />
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
        <meta name="apple-mobile-web-app-title" content="MWG Attend" />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="font-sans antialiased bg-black text-white selection:bg-brand-red selection:text-white">
        <div className="relative flex min-h-screen flex-col">
          {children}
        </div>
        {/* PWA: Service worker registration + Push notification subscription (admin only) */}
        <PushNotificationManager />
      </body>
    </html>
  );
}
