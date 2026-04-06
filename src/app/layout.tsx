import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "White Gloves Technologies | Global Attendance System",
  description: "Mark your attendance and manage your profile seamlessly with the White Gloves workforce portal.",
  keywords: "attendance, White Gloves, profile management, workplace tools",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&family=Outfit:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body>
        <div className="main-background">
          <div className="glow-orb" />
          <div className="glow-orb-2" />
          <div className="moving-orb red-orb-1" />
          <div className="moving-orb red-orb-2" />
          {[...Array(15)].map((_, i) => (
             <div key={i} className={`dot-particle p${i % 8}`} style={{ 
               top: `${Math.random() * 100}%`, 
               left: `${Math.random() * 100}%`,
               animationDelay: `${Math.random() * 5}s`
             }} />
          ))}
        </div>
        <div className="app-content-wrapper">
          {children}
        </div>
      </body>
    </html>
  );
}
