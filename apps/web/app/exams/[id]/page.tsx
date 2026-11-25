"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type Question = {
  id: string;
  question_text: string;
  options: string[];
  sort_order: number;
};

type Result = {
  score: number;
  correct: number;
  total: number;
};

export default function ExamPage() {
  const params = useParams();
  const examId = params.id as string;

  const [examTitle, setExamTitle] = useState("");
  const [courseId, setCourseId] = useState("");
  const [questions, setQuestions] = useState<Question[]>([]);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [result, setResult] = useState<Result | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState("");

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  useEffect(() => {
    async function load() {
      const supabase = client();

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();
      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: exam } = await supabase
        .from("exams")
        .select("id, title, course_id")
        .eq("id", examId)
        .single();

      if (!exam) {
        setMessage("الاختبار ده مش متاح ليك.");
        setLoading(false);
        return;
      }

      setExamTitle(exam.title);
      setCourseId(exam.course_id);

      const { data: qs, error: qError } = await supabase.rpc(
        "get_exam_questions",
        { p_exam_id: examId }
      );

      if (qError) {
        setMessage("مش قادرين نحمل الأسئلة دلوقتي.");
        setLoading(false);
        return;
      }

      setQuestions((qs as Question[]) || []);
      setLoading(false);
    }

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [examId]);

  async function submit() {
    if (Object.keys(answers).length < questions.length) {
      setMessage("جاوب على كل الأسئلة قبل التسليم.");
      return;
    }
    setSubmitting(true);
    setMessage("");

    const supabase = client();
    const { data, error } = await supabase.rpc("submit_exam", {
      p_exam_id: examId,
      p_answers: answers,
    });

    if (error) {
      setMessage("حصل خطأ في التسليم، جرب تاني.");
      setSubmitting(false);
      return;
    }

    setResult(data as Result);
    setSubmitting(false);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  if (loading) {
    return <main className="subpage">جاري تحميل الاختبار...</main>;
  }

  return (
    <main className="subpage">
      <a href={courseId ? `/courses/${courseId}` : "/courses"}>← الكورس</a>
      <h1>{examTitle}</h1>

      {message && <p role="alert">{message}</p>}

      {result && (
        <div
          className="notice"
          style={{ textAlign: "center", fontSize: "18px" }}
        >
          <strong style={{ fontSize: "34px", color: "var(--gold)" }}>
            {result.score}%
          </strong>
          <p>
            أجبت صح على {result.correct} من {result.total} أسئلة
            {result.score >= 50 ? " 🎉" : " — راجع الدروس وحاول تاني 💪"}
          </p>
        </div>
      )}

      {!result && questions.length === 0 && !message && (
        <p>الاختبار ده مفيهوش أسئلة لسه.</p>
      )}

      {!result &&
        questions.map((q, i) => (
          <section
            key={q.id}
            style={{
              border: "1px solid #24395e",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "16px",
              background: "#16294a",
            }}
          >
            <h3 style={{ margin: "0 0 12px", color: "var(--gold)" }}>
              {i + 1}. {q.question_text}
            </h3>
            {q.options.map((opt, k) => (
              <label
                key={k}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "10px",
                  padding: "10px 12px",
                  marginTop: "8px",
                  borderRadius: "10px",
                  border:
                    answers[q.id] === opt
                      ? "2px solid var(--navy)"
                      : "1px solid #e0e4ea",
                  cursor: "pointer",
                  fontWeight: "normal",
                }}
              >
                <input
                  type="radio"
                  name={q.id}
                  checked={answers[q.id] === opt}
                  onChange={() =>
                    setAnswers((a) => ({ ...a, [q.id]: opt }))
                  }
                  style={{ width: "18px", height: "18px", flexShrink: 0 }}
                />
                {opt}
              </label>
            ))}
          </section>
        ))}

      {!result && questions.length > 0 && (
        <button
          onClick={submit}
          disabled={submitting}
          style={{
            marginTop: "24px",
            width: "100%",
            padding: "14px",
            border: 0,
            borderRadius: "10px",
            background: "var(--navy)",
            color: "white",
            fontSize: "17px",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {submitting ? "جاري التصحيح..." : "سلّم الإجابات"}
        </button>
      )}
    </main>
  );
}
