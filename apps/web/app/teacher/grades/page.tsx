"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Course = { id: string; title: string };
type Exam = { id: string; title: string };
type EnrollmentRow = {
  student_id: string;
  profiles: { full_name: string | null } | { full_name: string | null }[] | null;
};
type AttemptRow = { exam_id: string; student_id: string; score: number };

type StudentGrade = {
  studentId: string;
  name: string;
  bestScore: number | null;
  attempts: number;
};

export default function TeacherGrades() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [gradesByExam, setGradesByExam] = useState<
    Record<string, StudentGrade[]>
  >({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  useEffect(() => {
    async function loadCourses() {
      const supabase = client();
      const { data, error } = await supabase
        .from("courses")
        .select("id, title")
        .order("created_at");
      if (error) {
        setMessage("خطأ تحميل الكورسات.");
        setLoading(false);
        return;
      }
      const list = (data as Course[]) || [];
      setCourses(list);
      if (list.length > 0) setCourseId(list[0].id);
      else setLoading(false);
    }
    loadCourses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!courseId) return;
    async function loadGrades() {
      setLoading(true);
      setMessage("");
      const supabase = client();

      const { data: examData } = await supabase
        .from("exams")
        .select("id, title")
        .eq("course_id", courseId)
        .order("created_at");
      const examList = (examData as Exam[]) || [];
      setExams(examList);

      const { data: enrollData, error: enrollError } = await supabase
        .from("enrollments")
        .select("student_id, profiles(full_name)")
        .eq("course_id", courseId)
        .eq("status", "active");
      if (enrollError) {
        setMessage("خطأ تحميل الطلاب.");
        setLoading(false);
        return;
      }
      const enrolled = ((enrollData as unknown as EnrollmentRow[]) || []).map(
        (en) => ({
          student_id: en.student_id,
          full_name: Array.isArray(en.profiles)
            ? en.profiles[0]?.full_name || null
            : en.profiles?.full_name || null,
        })
      );

      if (examList.length > 0) {
        const { data: attemptData } = await supabase
          .from("exam_attempts")
          .select("exam_id, student_id, score")
          .in(
            "exam_id",
            examList.map((e) => e.id)
          );
        const attempts = (attemptData as AttemptRow[]) || [];

        const map: Record<string, StudentGrade[]> = {};
        examList.forEach((exam) => {
          map[exam.id] = enrolled.map((en) => {
            const mine = attempts.filter(
              (a) => a.exam_id === exam.id && a.student_id === en.student_id
            );
            return {
              studentId: en.student_id,
              name: en.full_name || "طالب",
              bestScore:
                mine.length > 0
                  ? Math.max(...mine.map((a) => Math.round(a.score)))
                  : null,
              attempts: mine.length,
            };
          });
        });
        setGradesByExam(map);
      }

      setLoading(false);
    }
    loadGrades();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>الدرجات</h1>
      <p>نتائج الطلاب في اختبارات كل كورس ومين لسه ما حلش.</p>

      {message && <p role="alert">{message}</p>}

      {courses.length === 0 && !loading && <p>لا توجد كورسات بعد.</p>}

      {courses.length > 0 && (
        <div style={{ margin: "16px 0" }}>
          <label style={{ display: "block", marginBottom: "6px" }}>
            اختر الكورس
          </label>
          <select
            value={courseId}
            onChange={(e) => setCourseId(e.target.value)}
            style={{
              padding: "10px 14px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              fontFamily: "inherit",
              minWidth: "250px",
            }}
          >
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </div>
      )}

      {loading && courses.length > 0 && <p>جاري تحميل الدرجات...</p>}

      {!loading && courseId && exams.length === 0 && (
        <p>مفيش اختبارات في الكورس ده لسه.</p>
      )}

      {!loading &&
        exams.map((exam) => {
          const rows = gradesByExam[exam.id] || [];
          const taken = rows.filter((r) => r.bestScore !== null);
          const avg =
            taken.length > 0
              ? Math.round(
                  taken.reduce((s, r) => s + (r.bestScore || 0), 0) /
                    taken.length
                )
              : 0;
          return (
            <section
              key={exam.id}
              style={{
                border: "1px solid var(--border)",
                borderRadius: "12px",
                padding: "16px",
                marginTop: "16px",
                background: "var(--surface)",
              }}
            >
              <h3 style={{ margin: "0 0 4px", color: "var(--gold)" }}>
                {exam.title}
              </h3>
              <p style={{ margin: "0 0 12px", color: "var(--text-muted)" }}>
                حلّه {taken.length} من {rows.length} طالب
                {taken.length > 0 && ` — متوسط الدرجات ${avg}%`}
              </p>

              {rows.length === 0 && (
                <p>مفيش طلاب مشتركين في الكورس ده لسه.</p>
              )}

              {rows.map((r) => (
                <div
                  key={r.studentId}
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    padding: "10px 0",
                    borderTop: "1px solid var(--border)",
                  }}
                >
                  <span>{r.name}</span>
                  {r.bestScore === null ? (
                    <span style={{ color: "var(--text-muted)" }}>لم يحل بعد</span>
                  ) : (
                    <span>
                      <strong
                        style={{
                          color:
                            r.bestScore >= 50 ? "var(--success)" : "var(--error)",
                        }}
                      >
                        {r.bestScore}%
                      </strong>
                      <span
                        style={{ color: "var(--text-muted)", fontSize: "13px" }}
                      >
                        {" "}
                        ({r.attempts}{" "}
                        {r.attempts === 1 ? "محاولة" : "محاولات"})
                      </span>
                    </span>
                  )}
                </div>
              ))}
            </section>
          );
        })}
    </main>
  );
}
