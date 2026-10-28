import './globals.css';
import { BRANDING } from '@/config/branding.js';

export const metadata = {
  title: { default: BRANDING.productName, template: `%s · ${BRANDING.productName}` },
  description: `${BRANDING.companyName} people, attendance and leave.`,
  manifest: '/manifest.json',
  icons: { icon: BRANDING.logo, apple: BRANDING.logo },
  appleWebApp: { capable: true, statusBarStyle: 'default', title: BRANDING.productName },
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  viewportFit: 'cover',
  themeColor: '#e61e2a',
};

// Sets the saved theme before the first paint (light is the default).
const THEME_SCRIPT = `try{var t=localStorage.getItem('theme');if(t==='dark')document.documentElement.dataset.theme='dark'}catch(e){}`;

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        {/* eslint-disable-next-line @next/next/no-page-custom-font */}
        <link
          href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-screen font-sans">{children}</body>
    </html>
  );
}
