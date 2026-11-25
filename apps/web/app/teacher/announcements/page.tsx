"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Announcement = {
  id: string;
  body: string;
  is_active: boolean;
  created_at: string;
};

export default function TeacherAnnouncements() {
  const [items, setItems] = useState<Announcement[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  async function load() {
    const supabase = client();
    const { data, error } = await supabase
      .from("announcements")
      .select("id, body, is_active, created_at")
      .order("created_at", { ascending: false });
    if (error) setMessage("خطأ تحميل الإعلانات.");
    else setItems((data as Announcement[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function publish() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const { error } = await supabase.from("announcements").insert({ body });
    if (error) {
      setMessage("الإعلان ما اتنشرش، جرب تاني.");
    } else {
      setDraft("");
      await load();
    }
    setBusy(false);
  }

  async function toggle(a: Announcement) {
    const supabase = client();
    await supabase
      .from("announcements")
      .update({ is_active: !a.is_active })
      .eq("id", a.id);
    load();
  }

  async function remove(id: string) {
    const supabase = client();
    await supabase.from("announcements").delete().eq("id", id);
    load();
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>الإعلانات</h1>
      <p>اكتب إعلان وهيظهر لكل الطلاب أول ما يفتحوا المنصة.</p>

      {message && <p role="alert">{message}</p>}

      <section className="card" style={{ marginTop: "16px" }}>
        <h3>إعلان جديد</h3>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="مثال: امتحان شامل يوم الخميس الجاي، راجعوا الوحدة الأولى كويس 📚"
          rows={3}
          style={{
            width: "100%",
            padding: "12px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            fontFamily: "inherit",
            resize: "vertical",
          }}
        />
        <button
          onClick={publish}
          disabled={busy || !draft.trim()}
          style={{
            marginTop: "10px",
            padding: "10px 24px",
            border: 0,
            borderRadius: "10px",
            background: "var(--gold)",
            color: "var(--gold-ink)",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {busy ? "جاري النشر..." : "انشر الإعلان"}
        </button>
      </section>

      {loading && <p>جاري تحميل الإعلانات...</p>}

      {!loading && items.length === 0 && <p>مفيش إعلانات لسه.</p>}

      {items.map((a) => (
        <section
          key={a.id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "14px 16px",
            marginTop: "12px",
            background: a.is_active ? "var(--surface)" : "var(--bg-2)",
            opacity: a.is_active ? 1 : 0.7,
          }}
        >
          <p style={{ margin: 0, whiteSpace: "pre-wrap" }}>{a.body}</p>
          <div
            style={{
              display: "flex",
              gap: "12px",
              marginTop: "10px",
              alignItems: "center",
            }}
          >
            <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
              {new Date(a.created_at).toLocaleDateString("ar-EG", {
                day: "numeric",
                month: "long",
              })}
              {" — "}
              {a.is_active ? "ظاهر للطلاب" : "مخفي"}
            </span>
            <button
              onClick={() => toggle(a)}
              style={{
                border: "1px solid var(--gold)",
                background: "var(--surface)",
                color: "var(--gold)",
                borderRadius: "8px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              {a.is_active ? "إخفاء" : "إظهار"}
            </button>
            <button
              onClick={() => remove(a.id)}
              style={{
                border: "1px solid var(--error)",
                background: "var(--surface)",
                color: "var(--error)",
                borderRadius: "8px",
                padding: "4px 12px",
                cursor: "pointer",
              }}
            >
              حذف
            </button>
          </div>
        </section>
      ))}
    </main>
  );
}
