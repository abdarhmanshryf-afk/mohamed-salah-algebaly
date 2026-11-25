"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const HIDDEN = ["/login", "/register", "/forgot-password", "/reset-password"];

export default function NotificationBell() {
  const pathname = usePathname();
  const [unread, setUnread] = useState(0);
  const [supported, setSupported] = useState(true);

  useEffect(() => {
    let alive = true;
    async function load() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        if (alive) setUnread(0);
        return;
      }
      const { count, error } = await supabase
        .from("notifications")
        .select("id", { count: "exact", head: true })
        .eq("read", false);
      if (!alive) return;
      if (error) {
        setSupported(false); // جدول الإشعارات لسه ما اتعملش
      } else {
        setSupported(true);
        setUnread(count || 0);
      }
    }
    load();
    const t = setInterval(load, 60000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, [pathname]);

  if (!supported || HIDDEN.some((p) => pathname.startsWith(p))) return null;

  return (
    <a
      href="/notifications"
      aria-label="الإشعارات"
      style={{
        position: "fixed",
        top: "14px",
        left: "16px",
        zIndex: 50,
        width: "42px",
        height: "42px",
        borderRadius: "50%",
        background: "var(--surface)",
        border: "1px solid var(--border)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        fontSize: "19px",
      }}
    >
      🔔
      {unread > 0 && (
        <span
          style={{
            position: "absolute",
            top: "-4px",
            right: "-4px",
            background: "var(--accent-red)",
            color: "white",
            borderRadius: "10px",
            minWidth: "18px",
            height: "18px",
            fontSize: "11px",
            fontWeight: "bold",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: "0 4px",
          }}
        >
          {unread > 99 ? "99+" : unread}
        </span>
      )}
    </a>
  );
}
