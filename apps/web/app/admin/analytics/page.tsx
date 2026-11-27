"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../../lib/supabase-browser";

type DayRow = { day: string; count: number };

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

function last14Days(): string[] {
  const out: string[] = [];
  for (let i = 13; i >= 0; i--) {
    out.push(dayKey(new Date(Date.now() - i * 86400000).toISOString()));
  }
  return out;
}

function BarChart({ title, rows }: { title: string; rows: DayRow[] }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  return (
    <section className="course" style={{ display: "block" }}>
      <h3 style={{ margin: "0 0 10px", color: "var(--gold)" }}>{title}</h3>
      <div
        style={{
          display: "flex",
          alignItems: "flex-end",
          gap: "3px",
          height: "90px",
        }}
      >
        {rows.map((r) => (
          <div
            key={r.day}
            title={`${r.day}: ${r.count}`}
            style={{
              flex: 1,
              height: `${Math.max(4, (r.count / max) * 100)}%`,
              background: r.count > 0 ? "var(--gold)" : "var(--border)",
              borderRadius: "3px 3px 0 0",
            }}
          />
        ))}
      </div>
      <p style={{ margin: "6px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
        آخر 14 يوم — مرّر على أي عمود يقولك التاريخ والعدد
      </p>
    </section>
  );
}

export default function AdminAnalytics() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [signups, setSignups] = useState<DayRow[]>([]);
  const [attemptsByDay, setAttemptsByDay] = useState<DayRow[]>([]);
  const [avgScore, setAvgScore] = useState(0);
  const [totalAttempts, setTotalAttempts] = useState(0);
  const [revenue, setRevenue] = useState(0);
  const [activeSubs, setActiveSubs] = useState(0);
  const [topCourse, setTopCourse] = useState("");
  const [completions, setCompletions] = useState<number | null>(null);

  useEffect(() => {
    async function load() {
      try {
      const supabase = getBrowserClient();

      const [p, e, c, a, lp] = await Promise.all([
        supabase.from("profiles").select("id, role, created_at"),
        supabase.from("enrollments").select("id, status, created_at, course_id"),
        supabase.from("courses").select("id, title, price"),
        supabase.from("exam_attempts").select("id, score, created_at"),
        supabase
          .from("lesson_progress")
          .select("id", { count: "exact", head: true })
          .eq("completed", true),
      ]);

      if (p.error || e.error || c.error || a.error) {
        setMessage("مش قادرين نحمل التحليلات — اتأكد إنك أدمن.");
        setLoading(false);
        return;
      }

      const days = last14Days();
      const signupMap: Record<string, number> = {};
      (p.data || []).forEach((x: { created_at: string }) => {
        const d = dayKey(x.created_at);
        signupMap[d] = (signupMap[d] || 0) + 1;
      });
      setSignups(days.map((d) => ({ day: d, count: signupMap[d] || 0 })));

      const attemptMap: Record<string, number> = {};
      let sum = 0;
      (a.data || []).forEach((x: { score: number; created_at: string }) => {
        const d = dayKey(x.created_at);
        attemptMap[d] = (attemptMap[d] || 0) + 1;
        sum += x.score || 0;
      });
      setAttemptsByDay(days.map((d) => ({ day: d, count: attemptMap[d] || 0 })));
      setTotalAttempts((a.data || []).length);
      setAvgScore(
        (a.data || []).length > 0
          ? Math.round((sum / (a.data || []).length) * 10) / 10
          : 0
      );

      const priceByCourse: Record<string, number> = {};
      const titleByCourse: Record<string, string> = {};
      (c.data || []).forEach(
        (x: { id: string; price: number; title: string }) => {
          priceByCourse[x.id] = x.price || 0;
          titleByCourse[x.id] = x.title;
        }
      );
      const actives = (e.data || []).filter(
        (x: { status: string }) => x.status === "active"
      );
      setActiveSubs(actives.length);
      setRevenue(
        actives.reduce(
          (s: number, x: { course_id: string }) =>
            s + (priceByCourse[x.course_id] || 0),
          0
        )
      );
      const byCourse: Record<string, number> = {};
      (e.data || []).forEach((x: { course_id: string; status: string }) => {
        if (x.status === "active") {
          byCourse[x.course_id] = (byCourse[x.course_id] || 0) + 1;
        }
      });
      const top = Object.entries(byCourse).sort((x, y) => y[1] - x[1])[0];
      setTopCourse(top ? `${titleByCourse[top[0]]} (${top[1]} مشترك)` : "—");

      if (!lp.error) setCompletions(lp.count || 0);
      setLoading(false);
      } catch {
        setMessage("حصل خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى.");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const cards: { label: string; value: string }[] = [
    { label: "إجمالي الامتحانات المحلولة", value: String(totalAttempts) },
    { label: "متوسط درجات الامتحانات", value: `${avgScore}%` },
    { label: "الاشتراكات النشطة", value: String(activeSubs) },
    { label: "إيراد الاشتراكات النشطة", value: `${revenue} جنيه` },
    { label: "أكتر كورس عليه طلب", value: topCourse },
    {
      label: "دروس مكتملة (كل الطلاب)",
      value: completions === null ? "—" : String(completions),
    },
  ];

  return (
    <main className="subpage">
      <h1>📊 التحليلات المتقدمة</h1>
      {loading && <p>جاري التحميل...</p>}
      {message && <p role="alert">{message}</p>}
      {!loading && !message && (
        <>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
              gap: "10px",
            }}
          >
            {cards.map((c) => (
              <section
                key={c.label}
                className="course"
                style={{ display: "block", textAlign: "center" }}
              >
                <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                  {c.label}
                </p>
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "20px",
                    fontWeight: "bold",
                    color: "var(--gold)",
                  }}
                >
                  {c.value}
                </p>
              </section>
            ))}
          </div>
          <BarChart title="📈 تسجيلات الطلاب الجداد" rows={signups} />
          <BarChart title="✍️ الامتحانات المحلولة يوميًا" rows={attemptsByDay} />
        </>
      )}
    </main>
  );
}
