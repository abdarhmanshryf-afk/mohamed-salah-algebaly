"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Student = { id: string; full_name: string | null };

type Report = {
  student: string | null;
  year: number;
  month: number;
  attempts: { exam: string; score: number; date: string }[];
  completed_lessons: number;
  enrollments: { course: string; status: string; starts_at: string | null; expires_at: string | null }[];
};

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

const statusLabels: Record<string, string> = {
  active: "نشط",
  pending: "قيد المراجعة",
  expired: "منتهي",
  cancelled: "ملغي",
};

export default function TeacherReports() {
  const now = new Date();
  const [students, setStudents] = useState<Student[]>([]);
  const [studentId, setStudentId] = useState("");
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [report, setReport] = useState<Report | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "student")
        .order("full_name");
      setStudents((data as Student[]) || []);
    }
    load();
  }, []);

  async function fetchReport() {
    if (!studentId) return;
    setBusy(true);
    setMessage("");
    setReport(null);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data, error } = await supabase.rpc("get_student_month_report", {
      p_student_id: studentId,
      p_year: year,
      p_month: month,
    });
    if (error) {
      setMessage(
        "التقرير الشهري لسه مش مفعّل — شغّل سكريبت phase2-features.sql في SQL Editor. (" +
          error.message +
          ")"
      );
    } else {
      setReport(data as Report);
    }
    setBusy(false);
  }

  return (
    <main className="subpage">
      <h1>📄 تقرير طالب الشهري</h1>
      <p style={{ color: "#8fa0b8" }}>
        اختار الطالب والشهر وهتشوف امتحاناته ودروسه واشتراكاته — ومن المتصفح تقدر تطبعه PDF.
      </p>
      <section className="course" style={{ display: "block" }}>
        <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
          <select
            value={studentId}
            onChange={(e) => setStudentId(e.target.value)}
            style={{ padding: "8px", flex: 1, minWidth: "180px" }}
          >
            <option value="">اختار الطالب...</option>
            {students.map((s) => (
              <option key={s.id} value={s.id}>
                {s.full_name || "طالب بدون اسم"}
              </option>
            ))}
          </select>
          <select
            value={month}
            onChange={(e) => setMonth(parseInt(e.target.value, 10))}
            style={{ padding: "8px" }}
          >
            {MONTHS.map((m, i) => (
              <option key={m} value={i + 1}>
                {m}
              </option>
            ))}
          </select>
          <input
            type="number"
            value={year}
            onChange={(e) => setYear(parseInt(e.target.value, 10) || now.getFullYear())}
            style={{ width: "90px", padding: "8px" }}
          />
          <button onClick={fetchReport} disabled={busy || !studentId}>
            {busy ? "جاري التحميل..." : "عرض التقرير"}
          </button>
        </div>
      </section>
      {message && <p role="alert">{message}</p>}

      {report && (
        <section className="course" style={{ display: "block" }}>
          <h2 style={{ marginTop: 0, color: "var(--gold)" }}>
            {report.student || "الطالب"} — {MONTHS[report.month - 1]} {report.year}
          </h2>
          <p>
            الدروس المكتملة (إجمالي): <strong>{report.completed_lessons}</strong>
          </p>
          <h3>امتحانات الشهر ({report.attempts.length})</h3>
          {report.attempts.length === 0 && <p>مفيش امتحانات في الشهر ده.</p>}
          {report.attempts.map((a, i) => (
            <p key={i} style={{ margin: "4px 0", fontSize: "14px" }}>
              • {a.exam}: <strong style={{ color: "var(--gold)" }}>{a.score}%</strong>{" "}
              — {new Date(a.date).toLocaleDateString("ar-EG")}
            </p>
          ))}
          <h3>الاشتراكات</h3>
          {report.enrollments.map((e, i) => (
            <p key={i} style={{ margin: "4px 0", fontSize: "14px" }}>
              • {e.course} — {statusLabels[e.status] || e.status}
              {e.expires_at && " (حتى " + new Date(e.expires_at).toLocaleDateString("ar-EG") + ")"}
            </p>
          ))}
          <button onClick={() => window.print()} style={{ marginTop: "10px" }}>
            🖨 اطبع / احفظ PDF
          </button>
        </section>
      )}
    </main>
  );
}
