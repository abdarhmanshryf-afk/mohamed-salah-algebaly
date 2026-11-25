"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Row = {
  courseId: string;
  title: string;
  total: number;
  done: number;
};

export default function MyProgress() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

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
        window.location.href = "/teacher/grades";
        return;
      }

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id")
        .eq("student_id", user.id)
        .eq("status", "active");

      const courseIds = (enrollments || []).map(
        (e: { course_id: string }) => e.course_id
      );
      if (courseIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds);

      const { data: lessons } = await supabase
        .from("lessons")
        .select("id, course_id")
        .eq("is_published", true)
        .in("course_id", courseIds);

      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed")
        .eq("student_id", user.id);

      const doneSet = new Set(
        (progressData || [])
          .filter((p: { completed: boolean }) => p.completed)
          .map((p: { lesson_id: string }) => p.lesson_id)
      );

      const perCourse: Record<string, { total: number; done: number }> = {};
      (lessons || []).forEach((l: { id: string; course_id: string }) => {
        if (!perCourse[l.course_id]) perCourse[l.course_id] = { total: 0, done: 0 };
        perCourse[l.course_id].total += 1;
        if (doneSet.has(l.id)) perCourse[l.course_id].done += 1;
      });

      setRows(
        ((courses as { id: string; title: string }[]) || []).map((c) => ({
          courseId: c.id,
          title: c.title,
          total: perCourse[c.id]?.total || 0,
          done: perCourse[c.id]?.done || 0,
        }))
      );
      setLoading(false);
    }
    load();
  }, []);

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>تقدمي</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && rows.length === 0 && (
          <p>
            لسه ما عندكش اشتراك شغال.{" "}
            <a href="/courses" style={{ color: "var(--navy)", fontWeight: "bold" }}>
              شوف الكورسات
            </a>
          </p>
        )}
        {rows.map((r) => {
          const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
          return (
            <section
              key={r.courseId}
              className="course"
              style={{ display: "block" }}
            >
              <h3 style={{ margin: 0, color: "var(--navy)" }}>{r.title}</h3>
              <p style={{ margin: "8px 0" }}>
                خلّصت {r.done} من {r.total} دروس ({pct}%)
                {pct === 100 && " 🎉"}
              </p>
              <div className="progress-bar">
                <div className="progress-fill" style={{ width: `${pct}%` }} />
              </div>
              <a
                href={`/courses/${r.courseId}`}
                style={{
                  display: "inline-block",
                  marginTop: "12px",
                  color: "var(--navy)",
                  fontWeight: "bold",
                }}
              >
                {pct === 100 ? "راجع الكورس" : "كمّل من حيث وقفت ←"}
              </a>
            </section>
          );
        })}
      </div>
    </main>
  );
}
