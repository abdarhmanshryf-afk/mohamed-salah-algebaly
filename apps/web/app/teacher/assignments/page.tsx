"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Course = { id: string; title: string };
type Lesson = { id: string; title: string; sort_order: number };
type Assignment = {
  id: string;
  lesson_id: string;
  title: string;
  description: string | null;
  created_at: string;
};
type Submission = {
  id: string;
  student_id: string;
  file_path: string;
  score: number | null;
  feedback: string | null;
  submitted_at: string;
  studentName?: string;
};

export default function TeacherAssignments() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [openAssignment, setOpenAssignment] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>(
    {}
  );
  const [form, setForm] = useState({ lesson_id: "", title: "", description: "" });
  const [grades, setGrades] = useState<
    Record<string, { score: string; feedback: string }>
  >({});
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  useEffect(() => {
    async function loadCourses() {
      const supabase = client();
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .order("created_at");
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
    async function loadCourseData() {
      setLoading(true);
      setMessage("");
      setOpenAssignment(null);
      const supabase = client();

      const { data: lessonData } = await supabase
        .from("lessons")
        .select("id, title, sort_order")
        .eq("course_id", courseId)
        .order("sort_order");
      const lessonList = (lessonData as Lesson[]) || [];
      setLessons(lessonList);

      if (lessonList.length > 0) {
        const { data: assignmentData } = await supabase
          .from("assignments")
          .select("id, lesson_id, title, description, created_at")
          .in(
            "lesson_id",
            lessonList.map((l) => l.id)
          )
          .order("created_at", { ascending: false });
        setAssignments((assignmentData as Assignment[]) || []);
      } else {
        setAssignments([]);
      }
      setLoading(false);
    }
    loadCourseData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  async function createAssignment() {
    if (!form.lesson_id || !form.title.trim()) {
      setMessage("اختر الدرس واكتب عنوان الواجب.");
      return;
    }
    setBusy(true);
    setMessage("");
    const supabase = client();
    const { error } = await supabase.from("assignments").insert({
      lesson_id: form.lesson_id,
      title: form.title.trim(),
      description: form.description.trim() || null,
    });
    if (error) {
      setMessage("الواجب ما اتضافش: " + error.message);
    } else {
      setForm({ lesson_id: "", title: "", description: "" });
      setMessage("تم إضافة الواجب ✅");
      setCourseId((c) => c);
      const { data: assignmentData } = await supabase
        .from("assignments")
        .select("id, lesson_id, title, description, created_at")
        .in(
          "lesson_id",
          lessons.map((l) => l.id)
        )
        .order("created_at", { ascending: false });
      setAssignments((assignmentData as Assignment[]) || []);
    }
    setBusy(false);
  }

  async function removeAssignment(id: string) {
    if (!window.confirm("متأكد إنك عايز تحذف الواجب ده وكل حلوله؟")) return;
    const supabase = client();
    await supabase.from("assignments").delete().eq("id", id);
    setAssignments((prev) => prev.filter((a) => a.id !== id));
  }

  async function loadSubmissions(assignmentId: string) {
    if (openAssignment === assignmentId) {
      setOpenAssignment(null);
      return;
    }
    setOpenAssignment(assignmentId);
    const supabase = client();
    const { data } = await supabase
      .from("assignment_submissions")
      .select("id, student_id, file_path, score, feedback, submitted_at")
      .eq("assignment_id", assignmentId)
      .order("submitted_at", { ascending: false });
    const subs = (data as Submission[]) || [];

    const ids = Array.from(new Set(subs.map((s) => s.student_id)));
    const names: Record<string, string> = {};
    if (ids.length > 0) {
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, full_name")
        .in("id", ids);
      (profiles || []).forEach((p: { id: string; full_name: string | null }) => {
        names[p.id] = p.full_name || "طالب";
      });
    }
    subs.forEach((s) => {
      s.studentName = names[s.student_id] || "طالب";
      setGrades((g) => ({
        ...g,
        [s.id]: {
          score: s.score?.toString() || "",
          feedback: s.feedback || "",
        },
      }));
    });
    setSubmissions((prev) => ({ ...prev, [assignmentId]: subs }));
  }

  async function downloadSubmission(path: string) {
    const supabase = client();
    const { data, error } = await supabase.storage
      .from("submissions")
      .createSignedUrl(path, 600);
    if (error || !data?.signedUrl) {
      setMessage("مش قادرين نفتح الملف دلوقتي.");
      return;
    }
    const full = data.signedUrl.startsWith("http")
      ? data.signedUrl
      : `${process.env.NEXT_PUBLIC_SUPABASE_URL}/storage/v1${data.signedUrl}`;
    window.open(full, "_blank", "noopener");
  }

  async function saveGrade(submissionId: string, assignmentId: string) {
    const g = grades[submissionId];
    if (!g || g.score === "") {
      setMessage("اكتب الدرجة الأول.");
      return;
    }
    const score = parseInt(g.score, 10);
    if (isNaN(score) || score < 0 || score > 100) {
      setMessage("الدرجة لازم تكون رقم من 0 لـ 100.");
      return;
    }
    const supabase = client();
    const { error } = await supabase
      .from("assignment_submissions")
      .update({ score, feedback: g.feedback.trim() || null })
      .eq("id", submissionId);
    if (error) {
      setMessage("الدرجة ما اتحفظتش: " + error.message);
    } else {
      setMessage("تم حفظ الدرجة ✅");
      setSubmissions((prev) => ({
        ...prev,
        [assignmentId]: prev[assignmentId].map((s) =>
          s.id === submissionId
            ? { ...s, score, feedback: g.feedback.trim() || null }
            : s
        ),
      }));
    }
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>الواجبات</h1>
      <p>أضف واجب على أي درس، والطالب يرفع حله، وإنت تصحح وتدي الدرجة.</p>

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

      {lessons.length > 0 && (
        <section className="card" style={{ marginTop: "8px" }}>
          <h3>واجب جديد</h3>
          <label>الدرس</label>
          <select
            value={form.lesson_id}
            onChange={(e) => setForm({ ...form, lesson_id: e.target.value })}
            style={{
              width: "100%",
              padding: "10px",
              borderRadius: "10px",
              border: "1px solid var(--border)",
              fontFamily: "inherit",
              marginBottom: "8px",
            }}
          >
            <option value="">اختر الدرس...</option>
            {lessons.map((l) => (
              <option key={l.id} value={l.id}>
                الدرس {l.sort_order}: {l.title}
              </option>
            ))}
          </select>
          <label>عنوان الواجب</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            placeholder="مثال: واجب الوحدة الأولى"
            style={{ display: "block", width: "100%", marginBottom: "8px" }}
          />
          <label>تفاصيل (اختياري)</label>
          <input
            value={form.description}
            onChange={(e) =>
              setForm({ ...form, description: e.target.value })
            }
            placeholder="مثال: حل صفحة 12 كاملة وصور الحل"
            style={{ display: "block", width: "100%" }}
          />
          <button
            onClick={createAssignment}
            disabled={busy}
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
            {busy ? "..." : "أضف الواجب"}
          </button>
        </section>
      )}

      {loading && courses.length > 0 && <p>جاري التحميل...</p>}

      {!loading && courseId && assignments.length === 0 && (
        <p style={{ marginTop: "16px" }}>مفيش واجبات في الكورس ده لسه.</p>
      )}

      {assignments.map((a) => {
        const lesson = lessons.find((l) => l.id === a.lesson_id);
        const subs = submissions[a.id] || [];
        return (
          <section
            key={a.id}
            style={{
              border: "1px solid var(--border)",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "16px",
              background: "var(--surface)",
            }}
          >
            <h3 style={{ margin: "0 0 4px", color: "var(--gold)" }}>
              {a.title}
            </h3>
            <p style={{ margin: "0 0 8px", color: "var(--text-muted)" }}>
              {lesson ? `الدرس ${lesson.sort_order}: ${lesson.title}` : ""}
              {a.description ? ` — ${a.description}` : ""}
            </p>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => loadSubmissions(a.id)}
                style={{
                  padding: "8px 16px",
                  border: 0,
                  borderRadius: "8px",
                  background: "var(--gold)",
                  color: "var(--gold-ink)",
                  cursor: "pointer",
                }}
              >
                {openAssignment === a.id ? "إخفاء الحلول" : "عرض الحلول"}
              </button>
              <button
                onClick={() => removeAssignment(a.id)}
                style={{
                  padding: "8px 16px",
                  border: "1px solid #ff6b61",
                  borderRadius: "8px",
                  background: "var(--surface)",
                  color: "#ff6b61",
                  cursor: "pointer",
                }}
              >
                حذف
              </button>
            </div>

            {openAssignment === a.id && (
              <div
                style={{
                  marginTop: "12px",
                  borderTop: "1px solid var(--border)",
                  paddingTop: "12px",
                }}
              >
                {subs.length === 0 && <p>مفيش حلول اتسلمت لسه.</p>}
                {subs.map((s) => (
                  <div
                    key={s.id}
                    style={{
                      background: "var(--bg-2)",
                      borderRadius: "10px",
                      padding: "12px",
                      marginTop: "8px",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        flexWrap: "wrap",
                        gap: "8px",
                      }}
                    >
                      <strong style={{ color: "var(--gold)" }}>
                        {s.studentName}
                      </strong>
                      <span style={{ color: "var(--text-muted)", fontSize: "13px" }}>
                        {new Date(s.submitted_at).toLocaleDateString("ar-EG", {
                          day: "numeric",
                          month: "long",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div
                      style={{
                        display: "flex",
                        gap: "8px",
                        marginTop: "8px",
                        flexWrap: "wrap",
                        alignItems: "center",
                      }}
                    >
                      <button
                        onClick={() => downloadSubmission(s.file_path)}
                        style={{
                          padding: "6px 14px",
                          border: "1px solid var(--gold)",
                          borderRadius: "8px",
                          background: "var(--surface)",
                          color: "var(--gold)",
                          cursor: "pointer",
                        }}
                      >
                        📄 افتح الحل
                      </button>
                      <input
                        value={grades[s.id]?.score || ""}
                        onChange={(e) =>
                          setGrades((g) => ({
                            ...g,
                            [s.id]: {
                              ...(g[s.id] || { score: "", feedback: "" }),
                              score: e.target.value,
                            },
                          }))
                        }
                        placeholder="الدرجة /100"
                        type="number"
                        min="0"
                        max="100"
                        style={{
                          width: "110px",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <input
                        value={grades[s.id]?.feedback || ""}
                        onChange={(e) =>
                          setGrades((g) => ({
                            ...g,
                            [s.id]: {
                              ...(g[s.id] || { score: "", feedback: "" }),
                              feedback: e.target.value,
                            },
                          }))
                        }
                        placeholder="ملاحظة للطالب (اختياري)"
                        style={{
                          flex: 1,
                          minWidth: "150px",
                          padding: "6px 10px",
                          borderRadius: "8px",
                          border: "1px solid var(--border)",
                        }}
                      />
                      <button
                        onClick={() => saveGrade(s.id, a.id)}
                        style={{
                          padding: "6px 14px",
                          border: 0,
                          borderRadius: "8px",
                          background: "#2e9e5b",
                          color: "white",
                          cursor: "pointer",
                        }}
                      >
                        احفظ
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        );
      })}
    </main>
  );
}
