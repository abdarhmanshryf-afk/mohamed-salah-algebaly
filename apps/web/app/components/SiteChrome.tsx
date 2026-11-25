"use client";

import { usePathname } from "next/navigation";
import { WHATSAPP_NUMBER } from "../config";

const icons: Record<string, React.ReactNode> = {
  home: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 10.5L12 3l9 7.5" />
      <path d="M5 9.5V21h5v-6h4v6h5V9.5" />
    </svg>
  ),
  list: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <line x1="4" y1="6" x2="20" y2="6" />
      <line x1="4" y1="12" x2="20" y2="12" />
      <line x1="4" y1="18" x2="14" y2="18" />
    </svg>
  ),
  play: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinejoin="round">
      <path d="M8 5v14l11-7z" />
    </svg>
  ),
  pencil: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 20h9" />
      <path d="M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" />
    </svg>
  ),
  clock: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round">
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 3" />
    </svg>
  ),
  users: (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H7a4 4 0 00-4 4v2" />
      <circle cx="10" cy="7" r="4" />
      <path d="M21 21v-2a4 4 0 00-3-3.87" />
      <path d="M15 3.13a4 4 0 010 7.75" />
    </svg>
  ),
};

const items = [
  { href: "/", label: "الرئيسية", icon: icons.home },
  { href: "/courses", label: "الكورسات", icon: icons.list },
  { href: "/my", label: "دروسي", icon: icons.play },
  { href: "/exams", label: "امتحانات", icon: icons.pencil },
  { href: "/progress", label: "تقدمي", icon: icons.clock },
  { href: "/rooms", label: "غرف", icon: icons.users },
];

const hiddenPrefixes = [
  "/teacher",
  "/admin",
  "/login",
  "/register",
  "/forgot-password",
  "/reset-password",
];

export default function SiteChrome() {
  const pathname = usePathname();
  if (hiddenPrefixes.some((p) => pathname.startsWith(p))) return null;

  return (
    <>
      <a
        className="whats-float"
        href={`https://wa.me/${WHATSAPP_NUMBER}`}
        target="_blank"
        rel="noopener"
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
          <path d="M12 2a10 10 0 00-8.6 15.1L2 22l5-1.3A10 10 0 1012 2zm5 13.6c-.2.6-1.2 1.2-1.7 1.2-.4.1-1 .1-1.6-.1-.4-.1-.9-.3-1.5-.6-2.6-1.1-4.3-3.8-4.4-4-.1-.2-1.1-1.4-1.1-2.7s.7-1.9.9-2.2c.2-.2.5-.3.7-.3h.5c.2 0 .4 0 .6.4l.9 2.1c.1.2.1.4 0 .6l-.4.6-.5.5c-.2.2-.3.4-.1.7.2.3.8 1.3 1.7 2.1 1.2 1.1 2.2 1.4 2.5 1.5.3.1.5.1.7-.1l1-1.2c.2-.3.4-.2.7-.1l2 1c.3.1.5.2.6.4 0 .1 0 .6-.2 1.1z" />
        </svg>
        دعم فني
      </a>
      <nav className="bottom-nav">
        {items.map((it) => {
          const active =
            it.href === "/"
              ? pathname === "/"
              : pathname.startsWith(it.href);
          return (
            <a key={it.href} href={it.href} className={active ? "active" : ""}>
              {it.icon}
              {it.label}
            </a>
          );
        })}
      </nav>
    </>
  );
}
