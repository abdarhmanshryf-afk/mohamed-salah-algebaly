import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "منصة الأستاذ محمد صلاح الجبالي",
  description: "منصة تعليم اللغة العربية للمرحلتين الإعدادية والثانوية",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="ar" dir="rtl">
      <body>{children}</body>
    </html>
  );
}
