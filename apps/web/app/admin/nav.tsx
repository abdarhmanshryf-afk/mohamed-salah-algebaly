"use client";

import { usePathname } from "next/navigation";

const links = [
  { href: "/admin", label: "الإحصائيات" },
  { href: "/admin/users", label: "المستخدمون" },
  { href: "/admin/courses", label: "الكورسات" },
  { href: "/admin/subscriptions", label: "الاشتراكات" },
  { href: "/admin/analytics", label: "التحليلات" },
  { href: "/admin/ledger", label: "الحسابات" },
  { href: "/teacher", label: "لوحة المدرس" },
];

export default function AdminNav() {
  const pathname = usePathname();

  return (
    <header
      className="static-header"
      style={{ flexWrap: "wrap", gap: "10px", rowGap: "8px" }}
    >
      <a className="brand" href="/admin" style={{ fontSize: 20 }}>
        لوحة الإدارة 👑
      </a>
      <nav
        style={{
          display: "flex",
          gap: "8px",
          flexWrap: "wrap",
          alignItems: "center",
        }}
      >
        {links.map((l) => {
          const active =
            l.href === "/admin"
              ? pathname === "/admin"
              : pathname.startsWith(l.href);
          return (
            <a
              key={l.href}
              href={l.href}
              style={{
                padding: "7px 14px",
                borderRadius: "20px",
                border: `1px solid ${active ? "var(--gold)" : "var(--border)"}`,
                background: active ? "var(--gold)" : "transparent",
                color: active ? "var(--gold-ink)" : "var(--text-soft)",
                fontWeight: "bold",
                fontSize: "14px",
                whiteSpace: "nowrap",
              }}
            >
              {l.label}
            </a>
          );
        })}
      </nav>
    </header>
  );
}
