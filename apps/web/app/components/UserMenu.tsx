"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";

const roleLabels: Record<string, string> = {
  teacher: "معلم",
  student: "طالب",
  admin: "أدمن",
};

export default function UserMenu({ name, role }: { name: string; role: string }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDown(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function logout() {
    setBusy(true);
    try {
      await getBrowserClient().auth.signOut();
    } catch {
      // نتجاهل الخطأ ونكمل التحويل؛ الجلسة بتنتهي على العميل برضه.
    }
    window.location.href = "/login";
  }

  const displayName = name.trim() || "حسابي";
  const initial = displayName.charAt(0);
  const dashHref = role === "teacher" ? "/teacher" : role === "admin" ? "/admin" : "/courses";
  const dashLabel = role === "teacher" ? "لوحة التحكم" : role === "admin" ? "لوحة الإدارة" : "كورساتي";

  return (
    <div className="nq-user" ref={wrapRef}>
      <button
        type="button"
        className="nq-user-btn"
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="nq-user-ava" aria-hidden="true">{initial}</span>
        <span className="nq-user-txt">
          <strong>{displayName}</strong>
          <span>{roleLabels[role] || "طالب"}</span>
        </span>
        <span className="nq-user-caret" aria-hidden="true">▾</span>
      </button>
      {open && (
        <div className="nq-user-menu" role="menu">
          <a role="menuitem" href={dashHref}>{dashLabel}</a>
          <a role="menuitem" href="/profile">حسابي</a>
          <a role="menuitem" href="/notifications">الإشعارات</a>
          <button
            role="menuitem"
            type="button"
            className="nq-user-out"
            onClick={logout}
            disabled={busy}
          >
            {busy ? "جاري الخروج..." : "تسجيل الخروج"}
          </button>
        </div>
      )}
    </div>
  );
}
