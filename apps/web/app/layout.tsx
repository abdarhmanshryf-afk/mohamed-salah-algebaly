import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteChrome from "./components/SiteChrome";
import PwaRegister from "./components/PwaRegister";
import NotificationBell from "./components/NotificationBell";
import ThemeToggle from "./components/ThemeToggle";

export const metadata: Metadata = {
  title: "متقن | منصة تعليم اللغة العربية",
  description: "منصة متقن لتعليم اللغة العربية للمرحلتين الإعدادية والثانوية",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "متقن",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/icon-192.png",
  },
};

export const viewport: Viewport = {
  themeColor: "var(--bg)",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=IBM+Plex+Sans+Arabic:wght@400;500;700&display=swap"
          rel="stylesheet"
        />
        <script
          dangerouslySetInnerHTML={{
            __html:
              "try{var t=localStorage.getItem('itqan-theme')||'dark';document.documentElement.dataset.theme=t;}catch(e){document.documentElement.dataset.theme='dark';}",
          }}
        />
      </head>
      <body>
        {children}
        <NotificationBell />
        <ThemeToggle />
        <SiteChrome />
        <PwaRegister />
      </body>
    </html>
  );
}
