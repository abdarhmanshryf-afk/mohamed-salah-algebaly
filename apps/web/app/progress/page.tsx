"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Row = {
  courseId: string;
  title: string;
  total: number;
  done: number;
};

type NoteRow = {
  lesson_id: string;
  note: string;
  lesson_title: string;
  course_id: string;
  course_title: string;
};

function buildBadges(
  totalDone: number,
  passes: number,
  perfects: number,
  anyComplete: boolean
) {
  return [
    { icon: "🎖️", name: "البداية", earned: totalDone >= 1 },
    { icon: "📚", name: "مثابر", earned: totalDone >= 5 },
    { icon: "🔥", name: "مجتهد", earned: totalDone >= 15 },
    { icon: "🏆", name: "ناجح", earned: passes >= 1 },
    { icon: "💯", name: "متقن", earned: perfects >= 1 },
    { icon: "🎓", name: "ختامها مسك", earned: anyComplete },
  ];
}

export default function MyProgress() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [points, setPoints] = useState(0);
  const [badges, setBadges] = useState<{ icon: string; name: string; earned: boolean }[]>([]);
  const [notes, setNotes] = useState<NoteRow[]>([]);

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

      // Points/badges/notes data. Notes need student-features-setup.sql.
      const [attemptsRes, notesRes, allProgressRes] = await Promise.all([
        supabase.from("exam_attempts").select("score").eq("student_id", user.id),
        supabase
          .from("lesson_notes")
          .select("lesson_id, note, lessons(title, course_id)")
          .eq("student_id", user.id),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed")
          .eq("student_id", user.id),
      ]);
      const totalDone = (allProgressRes.data || []).filter(
        (p: { completed: boolean }) => p.completed
      ).length;
      const attemptScores = (attemptsRes.data || []).map(
        (a: { score: number }) => a.score
      );
      const passes = attemptScores.filter((s: number) => s >= 50).length;
      const perfects = attemptScores.filter((s: number) => s === 100).length;

      const noteData = (notesRes.data || []) as unknown as {
        lesson_id: string;
        note: string;
        lessons: { title: string; course_id: string } | null;
      }[];
      if (!notesRes.error && noteData.length > 0) {
        const noteCourseIds = Array.from(
          new Set(
            noteData
              .map((n) => n.lessons?.course_id || "")
              .filter(Boolean)
          )
        );
        const { data: noteCourses } = await supabase
          .from("courses")
          .select("id, title")
          .in("id", noteCourseIds);
        const noteTitles: Record<string, string> = {};
        (noteCourses || []).forEach((c: { id: string; title: string }) => {
          noteTitles[c.id] = c.title;
        });
        setNotes(
          noteData.map((n) => ({
            lesson_id: n.lesson_id,
            note: n.note,
            lesson_title: n.lessons?.title || "درس",
            course_id: n.lessons?.course_id || "",
            course_title: noteTitles[n.lessons?.course_id || ""] || "كورس",
          }))
        );
      }

      if (courseIds.length === 0) {
        setPoints(totalDone * 10 + passes * 50 + perfects * 50);
        setBadges(buildBadges(totalDone, passes, perfects, false));
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

      const rowList = ((courses as { id: string; title: string }[]) || []).map(
        (c) => ({
          courseId: c.id,
          title: c.title,
          total: perCourse[c.id]?.total || 0,
          done: perCourse[c.id]?.done || 0,
        })
      );
      setRows(rowList);
      const anyComplete = rowList.some((r) => r.total > 0 && r.done === r.total);
      setPoints(totalDone * 10 + passes * 50 + perfects * 50);
      setBadges(buildBadges(totalDone, passes, perfects, anyComplete));
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
            <a href="/courses" style={{ color: "var(--gold)", fontWeight: "bold" }}>
              شوف الكورسات
            </a>
          </p>
        )}
        {!loading && (points > 0 || badges.some((b) => b.earned)) && (
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ margin: 0, color: "var(--gold)" }}>
              🏅 نقاطك وشاراتك
            </h3>
            <p style={{ margin: "8px 0", fontSize: "18px" }}>
              عندك <strong style={{ color: "var(--gold)" }}>{points}</strong>{" "}
              نقطة
            </p>
            <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
              {badges.map((b) => (
                <span
                  key={b.name}
                  title={b.name}
                  style={{
                    padding: "6px 12px",
                    borderRadius: "20px",
                    border: "1px solid #24395e",
                    background: b.earned ? "#3a2f10" : "transparent",
                    color: b.earned ? "var(--gold)" : "#3a4d70",
                    fontSize: "14px",
                  }}
                >
                  {b.icon} {b.name}
                </span>
              ))}
            </div>
          </section>
        )}
        {rows.map((r) => {
          const pct = r.total > 0 ? Math.round((r.done / r.total) * 100) : 0;
          return (
            <section
              key={r.courseId}
              className="course"
              style={{ display: "block" }}
            >
              <h3 style={{ margin: 0, color: "var(--gold)" }}>{r.title}</h3>
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
                  color: "var(--gold)",
                  fontWeight: "bold",
                }}
              >
                {pct === 100 ? "راجع الكورس" : "كمّل من حيث وقفت ←"}
              </a>
            </section>
          );
        })}
        {notes.length > 0 && (
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ margin: 0, color: "var(--gold)" }}>📝 ملاحظاتك</h3>
            {notes.map((n) => (
              <div
                key={n.lesson_id}
                style={{ borderTop: "1px solid #24395e", padding: "8px 0" }}
              >
                <a
                  href={`/courses/${n.course_id}`}
                  style={{ color: "var(--gold)", fontWeight: "bold" }}
                >
                  {n.lesson_title}
                </a>{" "}
                <span style={{ color: "#8fa0b8", fontSize: "14px" }}>
                  — {n.course_title}
                </span>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>
                  {n.note}
                </p>
              </div>
            ))}
          </section>
        )}
      </div>
    </main>
  );
}
