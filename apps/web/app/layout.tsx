import type { Metadata, Viewport } from "next";
import "./globals.css";
import SiteChrome from "./components/SiteChrome";
import PwaRegister from "./components/PwaRegister";

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
  themeColor: "#0c1a33",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <SiteChrome />
        <PwaRegister />
      </body>
    </html>
  );
}
