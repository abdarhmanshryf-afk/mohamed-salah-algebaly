"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";

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
    return getBrowserClient();
  }

  async function load() {
    try {
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
    } catch {
      setMessage("حصل خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
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

  // الحذف محتاج سياسة notif_delete_own (سكريبت phase4-notifications.sql).
  // لو لسه ما اشتغلتش، الحذف بيرجع صفر صفوف من غير خطأ — فبنقول للمستخدم بصراحة.
  const deleteNotReady =
    "الحذف لسه مش متفعّل على قاعدة البيانات — شغّل سكريبت phase4-notifications.sql في Supabase، وبعدها الحذف هيشتغل.";

  async function removeOne(id: string) {
    setMessage("");
    const supabase = client();
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("id", id)
      .select("id");
    if (error) {
      setMessage("تعذر حذف الإشعار: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setMessage(deleteNotReady);
      return;
    }
    setRows((rs) => rs.filter((r) => r.id !== id));
  }

  async function removeRead() {
    setMessage("");
    const supabase = client();
    const { data, error } = await supabase
      .from("notifications")
      .delete()
      .eq("read", true)
      .select("id");
    if (error) {
      setMessage("تعذر الحذف: " + error.message);
      return;
    }
    if (!data || data.length === 0) {
      setMessage(deleteNotReady);
      return;
    }
    const gone = data.map((d: { id: string }) => d.id);
    setRows((rs) => rs.filter((r) => !gone.includes(r.id)));
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
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginBottom: "10px" }}>
              {unreadCount > 0 && (
                <button onClick={markAllRead} style={{ background: "var(--border)" }}>
                  تحديد الكل كمقروء ({unreadCount})
                </button>
              )}
              {rows.some((r) => r.read) && (
                <button onClick={removeRead} style={{ background: "var(--border)" }}>
                  مسح المقروء
                </button>
              )}
            </div>
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
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                    {new Date(n.created_at).toLocaleString("ar-EG")}
                  </p>
                </section>
              );
              return (
                <div key={n.id} className="notif-row">
                  {n.link ? (
                    <a href={n.link} className="notif-row-body">
                      {inner}
                    </a>
                  ) : (
                    <div className="notif-row-body">{inner}</div>
                  )}
                  <button
                    type="button"
                    className="notif-row-del"
                    onClick={() => removeOne(n.id)}
                    aria-label="حذف الإشعار"
                    title="حذف الإشعار"
                  >
                    ✕
                  </button>
                </div>
              );
            })}
          </>
        )}
      </div>
    </main>
  );
}
