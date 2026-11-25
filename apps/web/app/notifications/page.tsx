"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Notif = {
  id: string;
  title: string;
  body: string | null;
  link: string | null;
  read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Notif[]>([]);
  const [message, setMessage] = useState("");

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function load() {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const { data, error } = await supabase
      .from("notifications")
      .select("id, title, body, link, read, created_at")
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) {
      setSupported(false);
    } else {
      setRows((data as Notif[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function markAllRead() {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { error } = await supabase
      .from("notifications")
      .update({ read: true })
      .eq("read", false);
    if (error) setMessage("تعذر التحديث: " + error.message);
    else load();
  }

  const unreadCount = rows.filter((r) => !r.read).length;

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>🔔 الإشعارات</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && !supported && (
          <p>الإشعارات لسه بتتفعّل — جرّب بعد شوية.</p>
        )}
        {message && <p role="alert">{message}</p>}

        {!loading && supported && (
          <>
            {unreadCount > 0 && (
              <button onClick={markAllRead} style={{ marginBottom: "10px", background: "#24395e" }}>
                تحديد الكل كمقروء ({unreadCount})
              </button>
            )}
            {rows.length === 0 && <p>مفيش إشعارات لسه — أول ما يحصل جديد هتلاقيه هنا.</p>}
            {rows.map((n) => {
              const inner = (
                <section
                  className="course"
                  style={{
                    display: "block",
                    opacity: n.read ? 0.65 : 1,
                    borderRight: n.read ? undefined : "3px solid var(--gold)",
                  }}
                >
                  <strong style={{ color: n.read ? undefined : "var(--gold)" }}>
                    {n.title}
                  </strong>
                  {n.body && (
                    <p style={{ margin: "4px 0 0", fontSize: "14px" }}>{n.body}</p>
                  )}
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "#8fa0b8" }}>
                    {new Date(n.created_at).toLocaleString("ar-EG")}
                  </p>
                </section>
              );
              return n.link ? (
                <a key={n.id} href={n.link} style={{ display: "block" }}>
                  {inner}
                </a>
              ) : (
                <div key={n.id}>{inner}</div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
