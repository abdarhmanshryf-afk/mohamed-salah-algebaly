import type { Metadata } from "next";
import "./globals.css";
import SiteChrome from "./components/SiteChrome";

export const metadata: Metadata = {
  title: "متقن | منصة تعليم اللغة العربية",
  description: "منصة متقن لتعليم اللغة العربية للمرحلتين الإعدادية والثانوية",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>
        {children}
        <SiteChrome />
      </body>
    </html>
  );
}
