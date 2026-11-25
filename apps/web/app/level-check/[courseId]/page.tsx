"use client";

import { useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

type LQuestion = {
  id: string;
  question_text: string;
  options: string[];
  correct_answer: string;
  difficulty: number;
};

const MAX_QUESTIONS = 10;
const MAX_SECONDS = 600;

export default function LevelCheck() {
  const { courseId } = useParams() as { courseId: string };
  const [pool, setPool] = useState<LQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [current, setCurrent] = useState<LQuestion | null>(null);
  const [difficulty, setDifficulty] = useState(2);
  const [asked, setAsked] = useState<string[]>([]);
  const [log, setLog] = useState<{ difficulty: number; correct: boolean }[]>([]);
  const [picked, setPicked] = useState("");
  const [secondsLeft, setSecondsLeft] = useState(MAX_SECONDS);
  const [done, setDone] = useState(false);
  const [level, setLevel] = useState(0);
  const startRef = useRef(Date.now());

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  function pickNext(
    questions: LQuestion[],
    askedIds: string[],
    diff: number
  ): LQuestion | null {
    const remaining = questions.filter((q) => !askedIds.includes(q.id));
    if (remaining.length === 0) return null;
    const exact = remaining.filter((q) => q.difficulty === diff);
    const source = exact.length > 0 ? exact : remaining;
    return source[Math.floor(Math.random() * source.length)];
  }

  useEffect(() => {
    async function load() {
      const supabase = client();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      const { data, error } = await supabase.rpc("get_level_questions", {
        p_course_id: courseId,
      });
      if (error) {
        setNotReady(true);
        setLoading(false);
        return;
      }
      const qs = (data as LQuestion[]) || [];
      setPool(qs);
      if (qs.length > 0) {
        setCurrent(pickNext(qs, [], 2));
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [courseId]);

  useEffect(() => {
    if (loading || done) return;
    const t = setInterval(() => {
      const left = MAX_SECONDS - Math.floor((Date.now() - startRef.current) / 1000);
      setSecondsLeft(Math.max(0, left));
      if (left <= 0) finish();
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, done, log]);

  function answer(opt: string) {
    if (picked || !current) return;
    setPicked(opt);
    const correct = opt === current.correct_answer;
    setLog((prev) => [...prev, { difficulty: current.difficulty, correct }]);
  }

  function next() {
    const lastCorrect =
      log.length > 0 ? log[log.length - 1].correct : false;
    const newDiff = Math.min(3, Math.max(1, difficulty + (lastCorrect ? 1 : -1)));
    const newAsked = [...asked, current!.id];
    setAsked(newAsked);
    setDifficulty(newDiff);
    setPicked("");
    if (newAsked.length >= MAX_QUESTIONS) {
      finish([...log]);
      return;
    }
    const nxt = pickNext(pool, newAsked, newDiff);
    if (!nxt) {
      finish();
      return;
    }
    setCurrent(nxt);
  }

  async function finish(finalLog?: { difficulty: number; correct: boolean }[]) {
    if (done) return;
    const entries = finalLog || log;
    setDone(true);
    if (entries.length === 0) {
      setLevel(1);
      return;
    }
    const avg =
      entries.reduce((s, e) => s + (e.correct ? e.difficulty + 0.5 : e.difficulty - 1), 0) /
      entries.length;
    const est = Math.min(3, Math.max(1, Math.round(avg)));
    setLevel(est);
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      await supabase.from("level_checks").insert({
        student_id: user.id,
        course_id: courseId,
        estimated_level: est,
      });
    }
  }

  const mm = Math.floor(secondsLeft / 60);
  const ss = (secondsLeft % 60).toString().padStart(2, "0");

  const levelText: Record<number, { title: string; advice: string }> = {
    1: {
      title: "مبتدئ 🌱",
      advice:
        "ابدأ بمراجعة الدروس من الأول بهدوء، وخد وقتك في كل درس. خريطة الإتقان في صفحة تقدمي هتوريك أضعف الدروس.",
    },
    2: {
      title: "متوسط 💪",
      advice:
        "أساسك كويس! ركز على الدروس الصفرا والحمرا في خريطة الإتقان، وحل الامتحانات تاني.",
    },
    3: {
      title: "متقدم 🏆",
      advice:
        "ممتاز! أنت جاهز للامتحانات النهائية. راجع بس النقاط اللي غلطت فيها هنا.",
    },
  };

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <a href={`/courses/${courseId}`}>← الكورس</a>
        <h1>🎯 اختبار تحديد المستوى</h1>
        {loading && <p>جاري تحميل الأسئلة...</p>}
        {notReady && (
          <p>تحديد المستوى لسه محتاج سكريبت phase1-features.sql يتشغّل.</p>
        )}
        {!loading && !notReady && pool.length === 0 && (
          <p>مفيش أسئلة كفاية للكورس ده لسه.</p>
        )}

        {!loading && !notReady && current && !done && (
          <>
            <p style={{ color: "#8fa0b8" }}>
              ⏱ {mm}:{ss} — سؤال {asked.length + 1} من {MAX_QUESTIONS} كحد أقصى
            </p>
            <section className="course" style={{ display: "block" }}>
              <h3 style={{ margin: "0 0 10px" }}>{current.question_text}</h3>
              <div style={{ display: "flex", flexWrap: "wrap", gap: "8px" }}>
                {(current.options || []).map((opt) => {
                  let bg = "#16294a";
                  let color = "#e8ecf4";
                  if (picked) {
                    if (opt === current.correct_answer) {
                      bg = "#14532d";
                      color = "#7ee2a8";
                    } else if (opt === picked) {
                      bg = "#4c1d1d";
                      color = "#ff9c9c";
                    }
                  }
                  return (
                    <button
                      key={opt}
                      onClick={() => answer(opt)}
                      disabled={!!picked}
                      style={{
                        padding: "8px 16px",
                        border: "1px solid #24395e",
                        borderRadius: "10px",
                        background: bg,
                        color,
                        cursor: picked ? "default" : "pointer",
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
              {picked && (
                <button
                  onClick={next}
                  style={{
                    marginTop: "12px",
                    padding: "10px 22px",
                    border: "none",
                    borderRadius: "10px",
                    background: "var(--gold)",
                    color: "#17233a",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  السؤال اللي بعده ←
                </button>
              )}
            </section>
          </>
        )}

        {done && level > 0 && (
          <section
            className="course"
            style={{ display: "block", textAlign: "center" }}
          >
            <h2 style={{ color: "var(--gold)" }}>مستواك: {levelText[level].title}</h2>
            <p>
              جاوبت صح على {log.filter((l) => l.correct).length} من {log.length}{" "}
              سؤال
            </p>
            <p style={{ color: "#8fa0b8" }}>{levelText[level].advice}</p>
            <a
              href="/progress"
              style={{
                display: "inline-block",
                marginTop: "10px",
                padding: "10px 22px",
                borderRadius: "10px",
                background: "var(--gold)",
                color: "#17233a",
                fontWeight: "bold",
                textDecoration: "none",
              }}
            >
              افتح خريطة الإتقان ←
            </a>
          </section>
        )}
      </div>
    </main>
  );
}
