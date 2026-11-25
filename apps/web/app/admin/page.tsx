"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type ProfileRow = { id: string; role: string; created_at: string };
type EnrollmentRow = {
  id: string;
  status: string;
  created_at: string;
  course_id: string;
};
type CourseRow = { id: string; price: number; is_published: boolean };

const statusLabels: Record<string, string> = {
  active: "نشط",
  pending: "معلق",
  expired: "منتهي",
  cancelled: "ملغي/مرفوض",
};

function dayKey(iso: string) {
  return iso.slice(0, 10);
}

export default function AdminHome() {
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [profiles, setProfiles] = useState<ProfileRow[]>([]);
  const [enrollments, setEnrollments] = useState<EnrollmentRow[]>([]);
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [lessonsCount, setLessonsCount] = useState(0);
  const [attemptsCount, setAttemptsCount] = useState(0);

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const [p, e, c, l, a] = await Promise.all([
        supabase.from("profiles").select("id, role, created_at"),
        supabase.from("enrollments").select("id, status, created_at, course_id"),
        supabase.from("courses").select("id, price, is_published"),
        supabase.from("lessons").select("id", { count: "exact", head: true }),
        supabase.from("exam_attempts").select("id", { count: "exact", head: true }),
      ]);

      if (p.error || e.error || c.error) {
        setMessage(
          "خطأ تحميل الإحصائيات: " +
            (p.error?.message || e.error?.message || c.error?.message)
        );
        setLoading(false);
        return;
      }

      setProfiles((p.data as ProfileRow[]) || []);
      setEnrollments((e.data as EnrollmentRow[]) || []);
      setCourses((c.data as CourseRow[]) || []);
      setLessonsCount(l.count ?? 0);
      setAttemptsCount(a.count ?? 0);
      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return <main className="subpage">جاري تحميل الإحصائيات...</main>;
  }

  const students = profiles.filter((x) => x.role === "student").length;
  const teachers = profiles.filter((x) => x.role === "teacher").length;
  const byStatus: Record<string, number> = {};
  enrollments.forEach((x) => {
    byStatus[x.status] = (byStatus[x.status] || 0) + 1;
  });

  const priceOf: Record<string, number> = {};
  courses.forEach((c) => {
    priceOf[c.id] = c.price;
  });
  const activeRevenue = enrollments
    .filter((x) => x.status === "active")
    .reduce((sum, x) => sum + (priceOf[x.course_id] || 0), 0);

  // Registrations and requests per day, last 14 days.
  const days: string[] = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(dayKey(d.toISOString()));
  }
  const regsPerDay: Record<string, number> = {};
  const reqsPerDay: Record<string, number> = {};
  profiles.forEach((x) => {
    const k = dayKey(x.created_at);
    regsPerDay[k] = (regsPerDay[k] || 0) + 1;
  });
  enrollments.forEach((x) => {
    const k = dayKey(x.created_at);
    reqsPerDay[k] = (reqsPerDay[k] || 0) + 1;
  });
  const maxReg = Math.max(1, ...days.map((d) => regsPerDay[d] || 0));
  const maxReq = Math.max(1, ...days.map((d) => reqsPerDay[d] || 0));

  const barChart = (data: Record<string, number>, max: number, color: string) => (
    <div
      style={{
        display: "flex",
        alignItems: "flex-end",
        gap: "4px",
        height: "120px",
        marginTop: "16px",
      }}
    >
      {days.map((d) => {
        const v = data[d] || 0;
        return (
          <div
            key={d}
            title={`${d.slice(5)}: ${v}`}
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "4px",
              minWidth: 0,
            }}
          >
            <span style={{ fontSize: "11px", color: "var(--text-soft)" }}>{v || ""}</span>
            <div
              style={{
                width: "100%",
                maxWidth: "26px",
                height: `${Math.max(2, Math.round((v / max) * 80))}px`,
                background: color,
                borderRadius: "4px 4px 0 0",
              }}
            />
            <span style={{ fontSize: "10px", color: "#687386" }}>
              {d.slice(8)}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <main className="subpage">
      <h1>إحصائيات المنصة</h1>
      <p>نظرة شاملة على التسجيلات والاشتراكات والمبيعات.</p>

      {message && <p role="alert">{message}</p>}

      <div className="cards">
        <div className="card">
          <h3>{students}</h3>
          <p>طالب مسجل</p>
        </div>
        <div className="card">
          <h3>{teachers}</h3>
          <p>حساب مدرس</p>
        </div>
        <div className="card">
          <h3>{courses.length}</h3>
          <p>كورس ({courses.filter((c) => c.is_published).length} منشور)</p>
        </div>
        <div className="card">
          <h3>{lessonsCount}</h3>
          <p>درس</p>
        </div>
        <div className="card">
          <h3>{byStatus["pending"] || 0}</h3>
          <p>طلب اشتراك معلق</p>
        </div>
        <div className="card">
          <h3>{byStatus["active"] || 0}</h3>
          <p>اشتراك نشط</p>
        </div>
        <div className="card">
          <h3>{activeRevenue} جنيه</h3>
          <p>قيمة الاشتراكات النشطة</p>
        </div>
        <div className="card">
          <h3>{attemptsCount}</h3>
          <p>محاولة امتحان</p>
        </div>
      </div>

      <div className="card" style={{ marginTop: "24px" }}>
        <h3>التسجيلات الجديدة — آخر 14 يوم</h3>
        {barChart(regsPerDay, maxReg, "var(--gold)")}
      </div>

      <div className="card" style={{ marginTop: "18px" }}>
        <h3>طلبات الاشتراك — آخر 14 يوم</h3>
        {barChart(reqsPerDay, maxReq, "#4a9e6b")}
      </div>

      <div className="card" style={{ marginTop: "18px" }}>
        <h3>الاشتراكات حسب الحالة</h3>
        <div style={{ display: "flex", gap: "18px", flexWrap: "wrap", marginTop: "10px" }}>
          {Object.entries(statusLabels).map(([k, label]) => (
            <div key={k} style={{ textAlign: "center" }}>
              <div style={{ fontSize: "26px", fontWeight: "bold", color: "var(--gold)" }}>
                {byStatus[k] || 0}
              </div>
              <div style={{ color: "var(--text-soft)", fontSize: "14px" }}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </main>
  );
}
