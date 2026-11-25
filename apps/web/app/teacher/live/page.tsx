"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Course = { id: string; title: string };
type LiveSession = {
  id: string;
  course_id: string;
  title: string;
  youtube_id: string;
  is_live: boolean;
  created_at: string;
};

function extractYoutubeId(input: string): string | null {
  const text = input.trim();
  if (/^[a-zA-Z0-9_-]{11}$/.test(text)) return text;
  const patterns = [
    /(?:youtube\.com\/(?:watch\?.*v=|live\/|embed\/|shorts\/)|youtu\.be\/)([a-zA-Z0-9_-]{11})/,
  ];
  for (const p of patterns) {
    const m = text.match(p);
    if (m) return m[1];
  }
  return null;
}

export default function TeacherLive() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [sessions, setSessions] = useState<LiveSession[]>([]);
  const [form, setForm] = useState({ course_id: "", title: "", link: "" });
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
    const [{ data: courseData }, { data: sessionData }] = await Promise.all([
      supabase.from("courses").select("id, title").order("created_at"),
      supabase
        .from("live_sessions")
        .select("id, course_id, title, youtube_id, is_live, created_at")
        .order("created_at", { ascending: false }),
    ]);
    if (!sessionData) {
      setMessage(
        "صفحة البث لسه محتاجة تشغل سكربت الإعداد الأخير (features2) في Supabase SQL Editor."
      );
    }
    const courseList = (courseData as Course[]) || [];
    setCourses(courseList);
    setSessions((sessionData as LiveSession[]) || []);
    if (courseList.length > 0 && !form.course_id) {
      setForm((f) => ({ ...f, course_id: courseList[0].id }));
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function startLive() {
    const videoId = extractYoutubeId(form.link);
    if (!form.course_id || !videoId) {
      setMessage("حط لينك البث من يوتيوب (أو كود الفيديو).");
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = client();
    const { error } = await supabase.from("live_sessions").insert({
      course_id: form.course_id,
      title: form.title.trim() || "بث مباشر",
      youtube_id: videoId,
    });
    if (error) {
      setMessage("البث ما اتضافش: " + error.message);
    } else {
      setForm((f) => ({ ...f, title: "", link: "" }));
      setMessage("البث ظهر للطلاب المشتركين ✅");
      await load();
    }
    setBusy(false);
  }

  async function toggle(s: LiveSession) {
    const supabase = client();
    await supabase
      .from("live_sessions")
      .update({ is_live: !s.is_live })
      .eq("id", s.id);
    load();
  }

  async function remove(id: string) {
    const supabase = client();
    await supabase.from("live_sessions").delete().eq("id", id);
    load();
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>البث المباشر</h1>
      <p>
        اعمل بث مباشر (غير مدرج) من يوتيوب، وحط اللينك هنا — الطلاب المشتركين
        هيتفرجوا من جوه المنصة على طول.
      </p>

      {message && <p role="alert">{message}</p>}

      <section className="card" style={{ marginTop: "16px" }}>
        <h3>بدء بث جديد</h3>
        <label>الكورس</label>
        <select
          value={form.course_id}
          onChange={(e) => setForm({ ...form, course_id: e.target.value })}
          style={{
            width: "100%",
            padding: "10px",
            borderRadius: "10px",
            border: "1px solid var(--border)",
            fontFamily: "inherit",
            marginBottom: "8px",
          }}
        >
          {courses.map((c) => (
            <option key={c.id} value={c.id}>
              {c.title}
            </option>
          ))}
        </select>
        <label>عنوان الحصة (اختياري)</label>
        <input
          value={form.title}
          onChange={(e) => setForm({ ...form, title: e.target.value })}
          placeholder="مثال: مراجعة الوحدة الأولى"
          style={{ display: "block", width: "100%", marginBottom: "8px" }}
        />
        <label>لينك البث من يوتيوب</label>
        <input
          value={form.link}
          onChange={(e) => setForm({ ...form, link: e.target.value })}
          placeholder="https://youtube.com/watch?v=... أو https://youtu.be/..."
          style={{ display: "block", width: "100%", direction: "ltr" }}
        />
        <button
          onClick={startLive}
          disabled={busy || !form.link.trim()}
          style={{
            marginTop: "10px",
            padding: "10px 24px",
            border: 0,
            borderRadius: "10px",
            background: "var(--error)",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {busy ? "..." : "🔴 ابدأ البث للطلاب"}
        </button>
      </section>

      {loading && <p>جاري التحميل...</p>}

      {!loading && sessions.length === 0 && <p>مفيش بثوث لسه.</p>}

      {sessions.map((s) => {
        const course = courses.find((c) => c.id === s.course_id);
        return (
          <section
            key={s.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "14px 16px",
              marginTop: "12px",
              background: "var(--surface)",
              opacity: s.is_live ? 1 : 0.7,
            }}
          >
            <strong style={{ color: "var(--gold)" }}>
              {s.is_live ? "🔴 " : "⚫ "}
              {s.title}
            </strong>
            <p style={{ margin: "4px 0", color: "var(--text-muted)" }}>
              {course?.title || ""} —{" "}
              {s.is_live ? "ظاهر للطلاب الآن" : "متوقف"}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => toggle(s)}
                style={{
                  padding: "6px 14px",
                  border: "1px solid var(--gold)",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  color: "var(--gold)",
                  cursor: "pointer",
                }}
              >
                {s.is_live ? "إنهاء البث" : "إعادة إظهار"}
              </button>
              <button
                onClick={() => remove(s.id)}
                style={{
                  padding: "6px 14px",
                  border: "1px solid var(--error)",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  color: "var(--error)",
                  cursor: "pointer",
                }}
              >
                حذف
              </button>
            </div>
          </section>
        );
      })}
    </main>
  );
}
