"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Row = {
  course_id: string;
  status: string;
  title: string;
  review_note: string | null;
};

type FavRow = {
  lesson_id: string;
  title: string;
  course_id: string;
  course_title: string;
};

export default function MyLessons() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [favorites, setFavorites] = useState<FavRow[]>([]);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "teacher") {
        window.location.href = "/teacher";
        return;
      }

      // review_note is added by the admin setup SQL; fall back pre-setup.
      let list: { course_id: string; status: string; review_note?: string | null }[];
      const withNote = await supabase
        .from("enrollments")
        .select("course_id, status, review_note")
        .eq("student_id", user.id);
      if (withNote.error) {
        const basic = await supabase
          .from("enrollments")
          .select("course_id, status")
          .eq("student_id", user.id);
        list = basic.data || [];
      } else {
        list = withNote.data || [];
      }
      // Favorites need student-features-setup.sql; degrade gracefully.
      const favRes = await supabase
        .from("favorites")
        .select("lesson_id")
        .eq("student_id", user.id);
      if (!favRes.error && (favRes.data || []).length > 0) {
        const lessonIds = (favRes.data || []).map(
          (f: { lesson_id: string }) => f.lesson_id
        );
        const { data: favLessons } = await supabase
          .from("lessons")
          .select("id, title, course_id")
          .in("id", lessonIds);
        const favCourseIds = Array.from(
          new Set((favLessons || []).map((l: { course_id: string }) => l.course_id))
        );
        const { data: favCourses } = await supabase
          .from("courses")
          .select("id, title")
          .in("id", favCourseIds);
        const favTitles: Record<string, string> = {};
        (favCourses || []).forEach((c: { id: string; title: string }) => {
          favTitles[c.id] = c.title;
        });
        setFavorites(
          (favLessons || []).map(
            (l: { id: string; title: string; course_id: string }) => ({
              lesson_id: l.id,
              title: l.title,
              course_id: l.course_id,
              course_title: favTitles[l.course_id] || "كورس",
            })
          )
        );
      }

      if (list.length === 0) {
        setLoading(false);
        return;
      }

      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in(
          "id",
          list.map((e: { course_id: string }) => e.course_id)
        );

      const titles: Record<string, string> = {};
      (courses || []).forEach((c: { id: string; title: string }) => {
        titles[c.id] = c.title;
      });

      setRows(
        list.map((e) => ({
          course_id: e.course_id,
          status: e.status,
          title: titles[e.course_id] || "كورس",
          review_note: e.review_note || null,
        }))
      );
      setLoading(false);
      if (message) setMessage("");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>دروسي</h1>
        <p style={{ margin: "0 0 10px", fontSize: "14px" }}>
          <a href="/support" style={{ color: "var(--gold)" }}>
            🛟 عندك مشكلة؟ كلم الدعم من هنا
          </a>
          {"  ·  "}
          <a href="/assistant" style={{ color: "var(--gold)" }}>
            🤖 اسأل مساعد متقن الذكي
          </a>
        </p>
        {loading && <p>جاري التحميل...</p>}
        {!loading && rows.length === 0 && (
          <p>
            لسه ما اشتركتش في أي كورس.{" "}
            <a href="/courses" style={{ color: "var(--gold)", fontWeight: "bold" }}>
              شوف الكورسات المتاحة
            </a>
          </p>
        )}
        {message && <p role="alert">{message}</p>}
        {rows.map((r) => (
          <section key={r.course_id} className="course">
            <div>
              <h3 style={{ margin: 0, color: "var(--gold)" }}>{r.title}</h3>
              <p style={{ margin: "6px 0 0" }}>
                {r.status === "active" && "اشتراكك شغال ✅"}
                {r.status === "pending" && "طلبك قيد المراجعة ⏳"}
                {r.status === "cancelled" && "طلبك اترفض ❌"}
                {r.status === "expired" && "اشتراكك انتهى — جدد من صفحة الكورس"}
              </p>
              {r.status === "cancelled" && r.review_note && (
                <p style={{ margin: "4px 0 0", fontSize: "14px", color: "#ffb4b4" }}>
                  السبب: {r.review_note}
                </p>
              )}
            </div>
            {(r.status === "active" || r.status === "cancelled" || r.status === "expired") && (
              <a
                href={`/courses/${r.course_id}`}
                className="cta"
                style={{ marginTop: 0, padding: "10px 24px", fontSize: 15 }}
              >
                {r.status === "active" ? "ادخل الكورس" : "صفحة الكورس"}
              </a>
            )}
          </section>
        ))}
        {favorites.length > 0 && (
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ margin: 0, color: "var(--gold)" }}>⭐ المفضلة</h3>
            {favorites.map((f) => (
              <p key={f.lesson_id} style={{ margin: "8px 0 0" }}>
                <a
                  href={`/courses/${f.course_id}`}
                  style={{ color: "var(--gold)", fontWeight: "bold" }}
                >
                  {f.title}
                </a>{" "}
                <span style={{ color: "#8fa0b8", fontSize: "14px" }}>
                  — {f.course_title}
                </span>
              </p>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
