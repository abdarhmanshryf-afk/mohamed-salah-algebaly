"use client";

import { useEffect, useRef, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";
import { askItqanAI } from "../lib/ai";

type LessonMastery = {
  id: string;
  title: string;
  mastery: number;
};

type Row = {
  courseId: string;
  title: string;
  total: number;
  done: number;
  lessons: LessonMastery[];
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
  const [dueReview, setDueReview] = useState(0);
  const [profileName, setProfileName] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [aiBusy, setAiBusy] = useState<"" | "study-plan" | "weakness">("");
  const [aiReply, setAiReply] = useState("");
  const [reportMeta, setReportMeta] = useState<{
    month: string;
    exams: { title: string; score: number }[];
    date: string;
  } | null>(null);
  const reportPdfRef = useRef<{ save: (n: string) => void } | null>(null);
  const attemptsListRef = useRef<{ exam_id: string; score: number; created_at: string }[]>([]);
  const examsRef = useRef<{ id: string; title: string }[]>([]);
  const [plan, setPlan] = useState<
    { lesson_title: string; course_title: string; course_id: string; mastery: number }[]
  >([]);

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
        .select("role, full_name")
        .eq("id", user.id)
        .single();
      setProfileName(profile?.full_name || "");
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
      const [attemptsRes, notesRes, allProgressRes, dueRes] = await Promise.all([
        supabase
          .from("exam_attempts")
          .select("exam_id, score, created_at")
          .eq("student_id", user.id),
        supabase
          .from("lesson_notes")
          .select("lesson_id, note, lessons(title, course_id)")
          .eq("student_id", user.id),
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed")
          .eq("student_id", user.id),
        supabase
          .from("review_schedule")
          .select("id")
          .eq("student_id", user.id)
          .lte("due_at", new Date().toISOString()),
      ]);
      if (!dueRes.error) setDueReview((dueRes.data || []).length);
      const totalDone = (allProgressRes.data || []).filter(
        (p: { completed: boolean }) => p.completed
      ).length;
      const attemptsList = (attemptsRes.data || []) as {
        exam_id: string;
        score: number;
        created_at: string;
      }[];
      attemptsListRef.current = attemptsList;
      const attemptScores = attemptsList.map((a) => a.score);
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
        .select("id, course_id, title, sort_order")
        .eq("is_published", true)
        .in("course_id", courseIds);

      const { data: courseExams } = await supabase
        .from("exams")
        .select("id, course_id, title")
        .in("course_id", courseIds);
      examsRef.current = (courseExams || []) as { id: string; title: string }[];

      const examBestByCourse: Record<string, number> = {};
      const examCourse: Record<string, string> = {};
      (courseExams || []).forEach((e: { id: string; course_id: string }) => {
        examCourse[e.id] = e.course_id;
      });
      attemptsList.forEach((a) => {
        const cid = examCourse[a.exam_id];
        if (!cid) return;
        if (!(cid in examBestByCourse) || a.score > examBestByCourse[cid]) {
          examBestByCourse[cid] = a.score;
        }
      });

      const { data: progressData } = await supabase
        .from("lesson_progress")
        .select("lesson_id, completed, watched_seconds, duration_seconds")
        .eq("student_id", user.id);

      const doneSet = new Set(
        (progressData || [])
          .filter((p: { completed: boolean }) => p.completed)
          .map((p: { lesson_id: string }) => p.lesson_id)
      );

      const progressMap: Record<
        string,
        { completed: boolean; watched_seconds: number; duration_seconds: number }
      > = {};
      (progressData || []).forEach(
        (p: {
          lesson_id: string;
          completed: boolean;
          watched_seconds: number;
          duration_seconds: number;
        }) => {
          progressMap[p.lesson_id] = p;
        }
      );

      const perCourse: Record<string, { total: number; done: number }> = {};
      const masteryByCourse: Record<string, LessonMastery[]> = {};
      type LessonRow = {
        id: string;
        course_id: string;
        title: string;
        sort_order: number;
      };
      ((lessons as LessonRow[]) || [])
        .slice()
        .sort((a, b) => a.sort_order - b.sort_order)
        .forEach((l) => {
          if (!perCourse[l.course_id]) perCourse[l.course_id] = { total: 0, done: 0 };
          perCourse[l.course_id].total += 1;
          if (doneSet.has(l.id)) perCourse[l.course_id].done += 1;

          const p = progressMap[l.id];
          const base = p?.completed
            ? 100
            : p && p.duration_seconds > 0
              ? Math.min(100, Math.round((p.watched_seconds / p.duration_seconds) * 100))
              : 0;
          const examBest = examBestByCourse[l.course_id];
          const mastery =
            examBest === undefined ? base : Math.round(0.6 * base + 0.4 * examBest);
          if (!masteryByCourse[l.course_id]) masteryByCourse[l.course_id] = [];
          masteryByCourse[l.course_id].push({ id: l.id, title: l.title, mastery });
        });

      const rowList = ((courses as { id: string; title: string }[]) || []).map(
        (c) => ({
          courseId: c.id,
          title: c.title,
          total: perCourse[c.id]?.total || 0,
          done: perCourse[c.id]?.done || 0,
          lessons: masteryByCourse[c.id] || [],
        })
      );
      setRows(rowList);

      const weak: {
        lesson_title: string;
        course_title: string;
        course_id: string;
        mastery: number;
      }[] = [];
      rowList.forEach((r) => {
        r.lessons.forEach((l) => {
          if (l.mastery < 80) {
            weak.push({
              lesson_title: l.title,
              course_title: r.title,
              course_id: r.courseId,
              mastery: l.mastery,
            });
          }
        });
      });
      weak.sort((a, b) => a.mastery - b.mastery);
      setPlan(weak.slice(0, 6));
      const anyComplete = rowList.some((r) => r.total > 0 && r.done === r.total);
      setPoints(totalDone * 10 + passes * 50 + perfects * 50);
      setBadges(buildBadges(totalDone, passes, perfects, anyComplete));
      setLoading(false);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function askAI(mode: "study-plan" | "weakness") {
    setAiBusy(mode);
    setAiReply("");
    const coursesSummary = rows
      .map((r) => `${r.title}: خلّص ${r.done} من ${r.total} دروس`)
      .join("\n");
    const attemptsSummary = attemptsListRef.current
      .slice(0, 15)
      .map((a) => {
        const t = examsRef.current.find((e) => e.id === a.exam_id)?.title || "امتحان";
        return `${t}: ${a.score}%`;
      })
      .join("\n");
    const weakLessons = rows
      .flatMap((r) => r.lessons.map((l) => ({ course: r.title, ...l })))
      .filter((l) => l.mastery < 50)
      .slice(0, 12)
      .map((l) => `${l.title} (${l.course}): إتقان ${l.mastery}%`)
      .join("\n");
    const context =
      `الطالب: ${profileName || "طالب"}\nنقاطه: ${points}\n\nتقدمه في الكورسات:\n${coursesSummary || "لسه مفيش"}` +
      `\n\nدرجات امتحاناته:\n${attemptsSummary || "لسه مفيش"}` +
      `\n\nدروس إتقانها ضعيف (أقل من 50%):\n${weakLessons || "مفيش"}`;
    const reply = await askItqanAI(mode, context);
    setAiReply(reply);
    setAiBusy("");
  }

  async function generateReport() {
    setReportBusy(true);
    const now = new Date();
    const month = now.toLocaleDateString("ar-EG", { month: "long", year: "numeric" });
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const titles: Record<string, string> = {};
    examsRef.current.forEach((e) => {
      titles[e.id] = e.title;
    });
    const exams = attemptsListRef.current
      .filter((a) => new Date(a.created_at) >= monthStart)
      .map((a) => ({ title: titles[a.exam_id] || "اختبار", score: a.score }));
    setReportMeta({ month, exams, date: now.toLocaleDateString("ar-EG") });
    await new Promise((r) => setTimeout(r, 200));
    try {
      const el = document.getElementById("monthly-report-render");
      if (!el) throw new Error("missing");
      const html2canvas = (await import("html2canvas")).default;
      const { jsPDF } = await import("jspdf");
      const canvas = await html2canvas(el, { backgroundColor: "var(--bg)", scale: 2 });
      const img = canvas.toDataURL("image/png");
      const pdf = new jsPDF({
        orientation: "portrait",
        unit: "px",
        format: [canvas.width, canvas.height],
        hotfixes: ["px_scaling"],
      });
      pdf.addImage(img, "PNG", 0, 0, canvas.width, canvas.height);
      pdf.save(`itqan-report-${now.getFullYear()}-${now.getMonth() + 1}.pdf`);
    } catch {
      // ignore generation errors silently
    }
    setReportBusy(false);
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>تقدمي</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && rows.length > 0 && (
          <p>
            <button
              onClick={generateReport}
              disabled={reportBusy}
              style={{
                padding: "10px 18px",
                borderRadius: "10px",
                background: "var(--surface)",
                border: "1px solid var(--gold)",
                color: "var(--gold)",
                fontWeight: "bold",
                cursor: "pointer",
              }}
            >
              {reportBusy ? "جاري تجهيز التقرير..." : "⬇ حمّل تقريرك الشهري PDF"}
            </button>
          </p>
        )}
        {!loading && dueReview > 0 && (
          <p>
            <a
              href="/review"
              style={{
                display: "inline-block",
                padding: "10px 18px",
                borderRadius: "10px",
                background: "var(--gold-dim)",
                border: "1px solid var(--gold)",
                color: "var(--gold)",
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              🔁 عندك {dueReview} سؤال مستحق المراجعة — ابدأ المراجعة
            </a>
          </p>
        )}
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
                    border: "1px solid var(--border)",
                    background: b.earned ? "var(--gold-dim)" : "transparent",
                    color: b.earned ? "var(--gold)" : "var(--text-dim)",
                    fontSize: "14px",
                  }}
                >
                  {b.icon} {b.name}
                </span>
              ))}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "12px" }}>
              <button
                onClick={() => askAI("study-plan")}
                disabled={aiBusy !== ""}
                style={{ background: "var(--border)" }}
              >
                {aiBusy === "study-plan" ? "المساعد بيخطط..." : "📅 اعملي خطة مذاكرة"}
              </button>
              <button
                onClick={() => askAI("weakness")}
                disabled={aiBusy !== ""}
                style={{ background: "var(--border)" }}
              >
                {aiBusy === "weakness" ? "المساعد بيحلّل..." : "🎯 نقاط ضعفي المتوقعة"}
              </button>
            </div>
            {aiReply && (
              <div
                style={{
                  background: "var(--surface-2)",
                  borderRadius: "10px",
                  padding: "12px",
                  marginTop: "10px",
                  fontSize: "15px",
                }}
              >
                <p style={{ margin: 0, color: "var(--gold)", fontSize: "13px" }}>
                  🤖 مساعد متقن
                </p>
                <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>{aiReply}</p>
              </div>
            )}
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
              {r.lessons.length > 0 && (
                <div style={{ marginTop: "12px" }}>
                  <p style={{ margin: "0 0 6px", fontSize: "14px", color: "var(--text-muted)" }}>
                    خريطة الإتقان: 🟢 80%+ 🟡 50-79% 🔴 أقل من 50%
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "6px" }}>
                    {r.lessons.map((l) => (
                      <span
                        key={l.id}
                        title={`${l.title}: ${l.mastery}%`}
                        style={{
                          padding: "4px 10px",
                          borderRadius: "14px",
                          fontSize: "13px",
                          border: "1px solid var(--border)",
                          color:
                            l.mastery >= 80
                              ? "var(--success)"
                              : l.mastery >= 50
                                ? "var(--gold)"
                                : "var(--error)",
                        }}
                      >
                        {l.mastery >= 80 ? "🟢" : l.mastery >= 50 ? "🟡" : "🔴"}{" "}
                        {l.title} {l.mastery}%
                      </span>
                    ))}
                  </div>
                </div>
              )}
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
        {!loading && rows.length > 0 && (
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ margin: 0, color: "var(--gold)" }}>
              💡 خطة المذاكرة المقترحة
            </h3>
            {plan.length === 0 ? (
              <p style={{ margin: "8px 0 0" }}>
                ممتاز! كل دروسك فوق 80% — راجع بس اللي تحب. 🎉
              </p>
            ) : (
              <>
                <p style={{ margin: "8px 0", fontSize: "14px", color: "var(--text-muted)" }}>
                  مرتبة من الأضعف — ابدأ بيها:
                </p>
                {plan.map((p, i) => (
                  <p key={i} style={{ margin: "8px 0 0" }}>
                    <strong style={{ color: "var(--error)" }}>{p.mastery}%</strong>{" "}
                    <a
                      href={`/courses/${p.course_id}`}
                      style={{ color: "var(--gold)", fontWeight: "bold" }}
                    >
                      {p.lesson_title}
                    </a>{" "}
                    <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
                      — {p.course_title}
                    </span>
                  </p>
                ))}
              </>
            )}
          </section>
        )}
        {reportMeta && (
          <div
            id="monthly-report-render"
            dir="rtl"
            style={{
              position: "fixed",
              left: "-3000px",
              top: 0,
              width: "794px",
              background: "var(--bg)",
              color: "var(--text)",
              fontFamily: "inherit",
              boxSizing: "border-box",
              padding: "40px",
            }}
          >
            <div
              style={{
                border: "3px solid var(--gold)",
                borderRadius: "12px",
                padding: "32px",
              }}
            >
              <div style={{ textAlign: "center", marginBottom: "20px" }}>
                <div style={{ color: "var(--gold)", fontSize: "18px" }}>منصة متقن</div>
                <div style={{ color: "var(--gold)", fontSize: "30px", fontWeight: "bold" }}>
                  تقرير شهر {reportMeta.month}
                </div>
                <div style={{ color: "var(--text-muted)", fontSize: "14px", marginTop: "6px" }}>
                  الطالب: {profileName || "—"} — صدر في {reportMeta.date}
                </div>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", padding: "14px 0" }}>
                <strong style={{ color: "var(--gold)" }}>النقاط والشارات</strong>
                <p style={{ margin: "6px 0" }}>
                  مجموع النقاط: <strong>{points}</strong> — الشارات المكتسبة:{" "}
                  {badges.filter((b) => b.earned).map((b) => b.name).join("، ") || "لسه"}
                </p>
              </div>
              <div style={{ borderTop: "1px solid var(--border)", padding: "14px 0" }}>
                <strong style={{ color: "var(--gold)" }}>تقدم الكورسات</strong>
                {rows.map((r) => (
                  <p key={r.courseId} style={{ margin: "6px 0" }}>
                    {r.title}: خلّص {r.done} من {r.total} دروس (
                    {r.total > 0 ? Math.round((r.done / r.total) * 100) : 0}%)
                  </p>
                ))}
              </div>
              <div style={{ borderTop: "1px solid var(--border)", padding: "14px 0" }}>
                <strong style={{ color: "var(--gold)" }}>امتحانات الشهر ده</strong>
                {reportMeta.exams.length === 0 ? (
                  <p style={{ margin: "6px 0", color: "var(--text-muted)" }}>
                    مفيش امتحانات الشهر ده.
                  </p>
                ) : (
                  reportMeta.exams.map((e, i) => (
                    <p key={i} style={{ margin: "6px 0" }}>
                      {e.title}: {e.score}%
                    </p>
                  ))
                )}
              </div>
              <p style={{ color: "var(--text-muted)", fontSize: "12px", textAlign: "center" }}>
                الأستاذ محمد صلاح الجبالي — منصة متقن
              </p>
            </div>
          </div>
        )}
        {notes.length > 0 && (
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ margin: 0, color: "var(--gold)" }}>📝 ملاحظاتك</h3>
            {notes.map((n) => (
              <div
                key={n.lesson_id}
                style={{ borderTop: "1px solid var(--border)", padding: "8px 0" }}
              >
                <a
                  href={`/courses/${n.course_id}`}
                  style={{ color: "var(--gold)", fontWeight: "bold" }}
                >
                  {n.lesson_title}
                </a>{" "}
                <span style={{ color: "var(--text-muted)", fontSize: "14px" }}>
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
