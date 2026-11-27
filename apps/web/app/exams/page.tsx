"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";

type Row = {
  id: string;
  title: string;
  courseTitle: string;
  best: number | null;
};

export default function ExamsList() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
      const supabase = getBrowserClient();

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
      const teacher = profile?.role === "teacher";

      let courseIds: string[] = [];
      if (teacher) {
        const { data: allCourses } = await supabase
          .from("courses")
          .select("id");
        courseIds = (allCourses || []).map((c: { id: string }) => c.id);
      } else {
        const { data: enrollments } = await supabase
          .from("enrollments")
          .select("course_id")
          .eq("student_id", user.id)
          .eq("status", "active");
        courseIds = (enrollments || []).map(
          (e: { course_id: string }) => e.course_id
        );
      }

      if (courseIds.length === 0) {
        setLoading(false);
        return;
      }

      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in("id", courseIds);
      const titles: Record<string, string> = {};
      (courses || []).forEach((c: { id: string; title: string }) => {
        titles[c.id] = c.title;
      });

      const { data: exams } = await supabase
        .from("exams")
        .select("id, title, course_id")
        .eq("is_published", true)
        .in("course_id", courseIds);

      const { data: attempts } = await supabase
        .from("exam_attempts")
        .select("exam_id, score")
        .eq("student_id", user.id);
      const best: Record<string, number> = {};
      (attempts || []).forEach((a: { exam_id: string; score: number }) => {
        if (!(a.exam_id in best) || a.score > best[a.exam_id]) {
          best[a.exam_id] = a.score;
        }
      });

      setRows(
        ((exams as { id: string; title: string; course_id: string }[]) || []).map(
          (e) => ({
            id: e.id,
            title: e.title,
            courseTitle: titles[e.course_id] || "",
            best: e.id in best ? best[e.id] : null,
          })
        )
      );
      setLoading(false);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>الامتحانات</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && rows.length === 0 && (
          <p>
            مفيش امتحانات متاحة ليك دلوقتي.{" "}
            <a href="/courses" style={{ color: "var(--gold)", fontWeight: "bold" }}>
              شوف الكورسات
            </a>
          </p>
        )}
        {rows.map((r) => (
          <section key={r.id} className="course">
            <div>
              <h3 style={{ margin: 0, color: "var(--gold)" }}>{r.title}</h3>
              <p style={{ margin: "6px 0 0" }}>
                {r.courseTitle}
                {r.best !== null && ` — أفضل نتيجة: ${r.best}%`}
              </p>
            </div>
            <a
              href={`/exams/${r.id}`}
              className="cta"
              style={{ marginTop: 0, padding: "10px 24px", fontSize: 15 }}
            >
              {r.best !== null ? "أعد الامتحان" : "ابدأ الامتحان"}
            </a>
          </section>
        ))}
      </div>
    </main>
  );
}
