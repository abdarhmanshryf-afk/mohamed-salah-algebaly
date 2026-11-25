"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";

const HIDDEN = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function ThemeToggle() {
  const pathname = usePathname();
  const [theme, setTheme] = useState<"dark" | "light">("dark");

  useEffect(() => {
    const saved = (localStorage.getItem("itqan-theme") as "dark" | "light") || "dark";
    setTheme(saved);
  }, []);

  function toggle() {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    localStorage.setItem("itqan-theme", next);
    document.documentElement.dataset.theme = next;
  }

  if (HIDDEN.some((p) => pathname.startsWith(p))) return null;

  return (
    <button
      onClick={toggle}
      aria-label={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      title={theme === "dark" ? "الوضع الفاتح" : "الوضع الداكن"}
      style={{
        position: "fixed",
        bottom: "84px",
        left: "16px",
        zIndex: 50,
        width: "42px",
        height: "42px",
        borderRadius: "50%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        fontSize: "19px",
        cursor: "pointer",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 0,
      }}
    >
      {theme === "dark" ? "☀️" : "🌙"}
    </button>
  );
}
