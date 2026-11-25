"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Course = { id: string; title: string };
type Exam = {
  id: string;
  course_id: string;
  title: string;
  is_published: boolean;
};
type QuestionDraft = {
  text: string;
  options: string[];
  correct: number;
};

const emptyQuestion = (): QuestionDraft => ({
  text: "",
  options: ["", "", "", ""],
  correct: 0,
});

export default function TeacherExams() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [courseId, setCourseId] = useState("");
  const [exams, setExams] = useState<Exam[]>([]);
  const [title, setTitle] = useState("");
  const [questions, setQuestions] = useState<QuestionDraft[]>([emptyQuestion()]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  const loadExams = useCallback(
    async (cid: string) => {
      if (!cid) {
        setExams([]);
        return;
      }
      const supabase = client();
      const { data } = await supabase
        .from("exams")
        .select("id, course_id, title, is_published")
        .eq("course_id", cid)
        .order("created_at", { ascending: false });
      setExams((data as Exam[]) || []);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    async function load() {
      const supabase = client();
      const { data } = await supabase
        .from("courses")
        .select("id, title")
        .order("created_at");
      const list = (data as Course[]) || [];
      setCourses(list);
      if (list.length > 0) {
        setCourseId(list[0].id);
        await loadExams(list[0].id);
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function updateQuestion(i: number, patch: Partial<QuestionDraft>) {
    setQuestions((qs) => qs.map((q, j) => (j === i ? { ...q, ...patch } : q)));
  }

  function updateOption(i: number, k: number, value: string) {
    setQuestions((qs) =>
      qs.map((q, j) =>
        j === i
          ? { ...q, options: q.options.map((o, m) => (m === k ? value : o)) }
          : q
      )
    );
  }

  async function saveExam() {
    setMessage("");
    if (!courseId) return;
    if (!title.trim()) {
      setMessage("اكتب عنوان الاختبار الأول.");
      return;
    }
    const cleaned = questions
      .map((q) => ({
        ...q,
        text: q.text.trim(),
        options: q.options.map((o) => o.trim()),
      }))
      .filter((q) => q.text && q.options.every((o) => o));
    if (cleaned.length === 0) {
      setMessage("أضف سؤالًا واحدًا على الأقل بأربع اختيارات كاملة.");
      return;
    }

    setSaving(true);
    const supabase = client();

    const { data: exam, error: examError } = await supabase
      .from("exams")
      .insert({ course_id: courseId, title: title.trim(), is_published: true })
      .select("id")
      .single();

    if (examError || !exam) {
      setMessage("خطأ إنشاء الاختبار: " + (examError?.message || ""));
      setSaving(false);
      return;
    }

    const rows = cleaned.map((q, i) => ({
      exam_id: exam.id,
      question_text: q.text,
      options: q.options,
      correct_answer: q.options[q.correct],
      sort_order: i + 1,
    }));

    const { error: qError } = await supabase.from("questions").insert(rows);

    if (qError) {
      setMessage("اتعمل الاختبار بس حصل خطأ في حفظ الأسئلة: " + qError.message);
    } else {
      setMessage("تم نشر الاختبار ✅");
      setTitle("");
      setQuestions([emptyQuestion()]);
      await loadExams(courseId);
    }
    setSaving(false);
  }

  async function togglePublish(exam: Exam) {
    const supabase = client();
    await supabase
      .from("exams")
      .update({ is_published: !exam.is_published })
      .eq("id", exam.id);
    await loadExams(courseId);
  }

  async function deleteExam(exam: Exam) {
    if (!window.confirm(`حذف الاختبار "${exam.title}" وكل أسئلته؟`)) return;
    const supabase = client();
    const { error } = await supabase.from("exams").delete().eq("id", exam.id);
    if (error) {
      setMessage("خطأ في الحذف: " + error.message);
      return;
    }
    await loadExams(courseId);
  }

  if (loading) {
    return <main className="subpage">جاري التحميل...</main>;
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>الاختبارات</h1>
      <p>أنشئ اختبارات اختيار من متعدد لطلاب الكورس.</p>

      {message && <p role="alert">{message}</p>}

      <label>الكورس</label>
      <select
        value={courseId}
        onChange={async (e) => {
          setCourseId(e.target.value);
          await loadExams(e.target.value);
        }}
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #d5dae3",
          fontSize: "16px",
          marginTop: "6px",
        }}
      >
        {courses.map((c) => (
          <option key={c.id} value={c.id}>
            {c.title}
          </option>
        ))}
      </select>

      <h2 style={{ color: "var(--navy)", marginTop: "28px" }}>اختبارات الكورس</h2>
      {exams.length === 0 && <p>لا توجد اختبارات في هذا الكورس بعد.</p>}
      {exams.map((exam) => (
        <section
          key={exam.id}
          style={{
            border: "1px solid #e0e4ea",
            borderRadius: "12px",
            padding: "14px 16px",
            marginTop: "12px",
            background: "white",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "10px",
          }}
        >
          <strong style={{ color: "var(--navy)" }}>
            {exam.title} {!exam.is_published && "(مسودة)"}
          </strong>
          <span>
            <button
              onClick={() => togglePublish(exam)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid var(--navy)",
                background: "white",
                color: "var(--navy)",
                cursor: "pointer",
                marginInlineEnd: "8px",
              }}
            >
              {exam.is_published ? "إخفاء" : "نشر"}
            </button>
            <button
              onClick={() => deleteExam(exam)}
              style={{
                padding: "8px 14px",
                borderRadius: "8px",
                border: "1px solid #b3372f",
                background: "white",
                color: "#b3372f",
                cursor: "pointer",
              }}
            >
              حذف
            </button>
          </span>
        </section>
      ))}

      <h2 style={{ color: "var(--navy)", marginTop: "34px" }}>اختبار جديد</h2>
      <label>عنوان الاختبار</label>
      <input
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="مثال: اختبار الوحدة الأولى"
        style={{
          width: "100%",
          padding: "12px",
          borderRadius: "10px",
          border: "1px solid #d5dae3",
          fontSize: "16px",
          marginTop: "6px",
        }}
      />

      {questions.map((q, i) => (
        <section
          key={i}
          style={{
            border: "1px solid #e0e4ea",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
            background: "white",
          }}
        >
          <label>السؤال {i + 1}</label>
          <input
            value={q.text}
            onChange={(e) => updateQuestion(i, { text: e.target.value })}
            placeholder="نص السؤال"
            style={{
              width: "100%",
              padding: "12px",
              borderRadius: "10px",
              border: "1px solid #d5dae3",
              fontSize: "16px",
              marginTop: "6px",
            }}
          />
          {q.options.map((opt, k) => (
            <div
              key={k}
              style={{
                display: "flex",
                alignItems: "center",
                gap: "8px",
                marginTop: "10px",
              }}
            >
              <input
                type="radio"
                name={`correct-${i}`}
                checked={q.correct === k}
                onChange={() => updateQuestion(i, { correct: k })}
                title="الإجابة الصحيحة"
                style={{ width: "18px", height: "18px", flexShrink: 0 }}
              />
              <input
                value={opt}
                onChange={(e) => updateOption(i, k, e.target.value)}
                placeholder={`الاختيار ${k + 1}`}
                style={{
                  flex: 1,
                  padding: "10px",
                  borderRadius: "10px",
                  border: "1px solid #d5dae3",
                  fontSize: "15px",
                }}
              />
            </div>
          ))}
          <p style={{ fontSize: "13px", color: "var(--muted)", margin: "8px 0 0" }}>
            علّم الدائرة جنب الإجابة الصحيحة
          </p>
          {questions.length > 1 && (
            <button
              type="button"
              onClick={() => setQuestions((qs) => qs.filter((_, j) => j !== i))}
              style={{
                marginTop: "10px",
                padding: "6px 12px",
                borderRadius: "8px",
                border: "1px solid #b3372f",
                background: "white",
                color: "#b3372f",
                cursor: "pointer",
                fontSize: "14px",
              }}
            >
              حذف السؤال
            </button>
          )}
        </section>
      ))}

      <button
        type="button"
        onClick={() => setQuestions((qs) => [...qs, emptyQuestion()])}
        style={{
          marginTop: "16px",
          padding: "10px 20px",
          borderRadius: "10px",
          border: "1px solid var(--navy)",
          background: "white",
          color: "var(--navy)",
          fontWeight: "bold",
          cursor: "pointer",
        }}
      >
        + أضف سؤالًا
      </button>

      <div>
        <button
          onClick={saveExam}
          disabled={saving}
          style={{
            marginTop: "20px",
            padding: "14px 28px",
            border: 0,
            borderRadius: "10px",
            background: "var(--navy)",
            color: "white",
            fontSize: "17px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {saving ? "جاري الحفظ..." : "انشر الاختبار"}
        </button>
      </div>
    </main>
  );
}
