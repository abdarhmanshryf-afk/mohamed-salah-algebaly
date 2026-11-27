"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";

type DueItem = {
  id: string;
  question_id: string;
  stage: number;
  questions: {
    question_text: string;
    options: string[];
    correct_answer: string;
    exams: { title: string; course_id: string } | null;
  } | null;
};

export default function ReviewPage() {
  const [items, setItems] = useState<DueItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [picked, setPicked] = useState<Record<string, string>>({});

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

      const { data, error } = await supabase
        .from("review_schedule")
        .select(
          "id, question_id, stage, questions(question_text, options, correct_answer, exams(title, course_id))"
        )
        .eq("student_id", user.id)
        .lte("due_at", new Date().toISOString())
        .order("due_at");

      if (error) {
        setNotReady(true);
      } else {
        setItems((data as unknown as DueItem[]) || []);
      }
      setLoading(false);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  async function answer(item: DueItem, option: string) {
    if (picked[item.id]) return;
    setPicked((p) => ({ ...p, [item.id]: option }));
    const correct = option === item.questions?.correct_answer;
    const supabase = getBrowserClient();
    if (!correct) {
      await supabase
        .from("review_schedule")
        .update({
          stage: 0,
          due_at: new Date(Date.now() + 24 * 3600 * 1000).toISOString(),
          last_result: false,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    } else if (item.stage >= 2) {
      await supabase.from("review_schedule").delete().eq("id", item.id);
    } else {
      const days = item.stage === 0 ? 1 : item.stage === 1 ? 3 : 7;
      await supabase
        .from("review_schedule")
        .update({
          stage: item.stage + 1,
          due_at: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
          last_result: true,
          updated_at: new Date().toISOString(),
        })
        .eq("id", item.id);
    }
  }

  function dismiss(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id));
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>🔁 المراجعة الذكية</h1>
        <p style={{ color: "var(--text-muted)" }}>
          الأسئلة اللي غلطت فيها بترجع لك هنا: بعد يوم، بعد 3 أيام، بعد أسبوع —
          لحد ما تثبتها.
        </p>
        {loading && <p>جاري التحميل...</p>}
        {notReady && (
          <p>المراجعة لسه محتاجة سكريبت phase1-features.sql يتشغّل.</p>
        )}
        {!loading && !notReady && items.length === 0 && (
          <p>مفيش أسئلة مستحقة دلوقتي 🎉 راجع تاني بعدين.</p>
        )}
        {items.map((item) => {
          const q = item.questions;
          if (!q) return null;
          const myPick = picked[item.id];
          const answered = !!myPick;
          const wasCorrect = myPick === q.correct_answer;
          return (
            <section
              key={item.id}
              className="course"
              style={{ display: "block" }}
            >
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                من اختبار: {q.exams?.title || "اختبار"}
              </p>
              <h3 style={{ margin: "8px 0" }}>{q.question_text}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {(q.options || []).map((opt) => {
                  let bg = "var(--surface)";
                  let color = "var(--text)";
                  if (answered) {
                    if (opt === q.correct_answer) {
                      bg = "var(--success-bg)";
                      color = "var(--success)";
                    } else if (opt === myPick) {
                      bg = "var(--error-bg)";
                      color = "var(--error)";
                    }
                  }
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(item, opt)}
                      disabled={answered}
                      style={{
                        padding: "8px 16px",
                        border: "1px solid var(--border)",
                        borderRadius: "10px",
                        background: bg,
                        color,
                        cursor: answered ? "default" : "pointer",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {answered && (
                <div style={{ marginTop: "10px" }}>
                  <p style={{ margin: 0, color: wasCorrect ? "var(--success)" : "var(--error)" }}>
                    {wasCorrect
                      ? "إجابة صحيحة ✅ هتتأكد منها مرة كمان بعد شوية."
                      : `إجابة غلط ❌ الصح: ${q.correct_answer} — وهرجعها لك بكرة.`}
                  </p>
                  <button
                    onClick={() => dismiss(item.id)}
                    style={{
                      marginTop: "8px",
                      padding: "6px 16px",
                      border: "none",
                      borderRadius: "8px",
                      background: "var(--gold)",
                      color: "var(--gold-ink)",
                      fontWeight: "bold",
                      cursor: "pointer",
                    }}
                  >
                    اللي بعده ←
                  </button>
                </div>
              )}
            </section>
          );
        })}
      </div>
    </main>
  );
}
