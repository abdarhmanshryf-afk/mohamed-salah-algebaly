"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";
import NotificationBell from "../components/NotificationBell";

type Stats = {
  students: number;
  courses: number;
  lessons: number;
  pendingRequests: number;
  activeSubscriptions: number;
};

type Activity = { text: string; icon: string; at: string };
type RecentStudent = { name: string; at: string };

const MONTHS = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

export default function TeacherHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [teacherName, setTeacherName] = useState("");
  const [message, setMessage] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [chartPoints, setChartPoints] = useState<number[]>([]);
  const [chartLabels, setChartLabels] = useState<string[]>([]);
  const [recentStudents, setRecentStudents] = useState<RecentStudent[]>([]);
  const [activities, setActivities] = useState<Activity[]>([]);

  useEffect(() => {
    async function loadStats() {
      try {
        const supabase = getBrowserClient();

        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (user) {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role, full_name")
            .eq("id", user.id)
            .single();
          if (prof?.full_name) setTeacherName(prof.full_name);
          if (
            user.id === "1297f9ef-89c8-45d9-82a4-01d5f48206fc" ||
            prof?.role === "admin"
          ) {
            setIsAdmin(true);
          }
        }

        const [students, courses, lessons, pending, active] = await Promise.all([
          supabase
            .from("profiles")
            .select("id", { count: "exact", head: true })
            .eq("role", "student"),
          supabase.from("courses").select("id", { count: "exact", head: true }),
          supabase.from("lessons").select("id", { count: "exact", head: true }),
          supabase
            .from("enrollments")
            .select("id", { count: "exact", head: true })
            .eq("status", "pending"),
          supabase
            .from("enrollments")
            .select("id", { count: "exact", head: true })
            .eq("status", "active"),
        ]);

        if (students.error || courses.error || pending.error || active.error) {
          setMessage("خطأ تحميل الإحصائيات.");
          return;
        }

        setStats({
          students: students.count ?? 0,
          courses: courses.count ?? 0,
          lessons: lessons.count ?? 0,
          pendingRequests: pending.count ?? 0,
          activeSubscriptions: active.count ?? 0,
        });

        // Enrollment chart: cumulative enrollments per month, last 6 months.
        const { data: enrRows } = await supabase
          .from("enrollments")
          .select("created_at")
          .order("created_at", { ascending: true });
        if (enrRows) {
          const now = new Date();
          const buckets: { key: string; label: string; end: Date }[] = [];
          for (let i = 5; i >= 0; i--) {
            const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
            buckets.push({
              key: `${d.getFullYear()}-${d.getMonth()}`,
              label: MONTHS[d.getMonth()],
              end: new Date(d.getFullYear(), d.getMonth() + 1, 1),
            });
          }
          const counts = buckets.map(
            (b) =>
              enrRows.filter((r: { created_at: string }) => new Date(r.created_at) < b.end)
                .length
          );
          setChartPoints(counts);
          setChartLabels(buckets.map((b) => b.label));

          const recent = enrRows.slice(-4).reverse() as unknown as {
            created_at: string;
          }[];
          void recent;
        }

        // Recent enrolled students (names via profiles; degrade gracefully).
        const { data: recentEnr } = await supabase
          .from("enrollments")
          .select("student_id, created_at")
          .order("created_at", { ascending: false })
          .limit(4);
        if (recentEnr && recentEnr.length) {
          const ids = recentEnr.map((r: { student_id: string }) => r.student_id);
          const { data: profs } = await supabase
            .from("profiles")
            .select("id, full_name")
            .in("id", ids);
          const nameMap: Record<string, string> = {};
          (profs || []).forEach((p: { id: string; full_name: string }) => {
            nameMap[p.id] = p.full_name;
          });
          setRecentStudents(
            recentEnr.map((r: { student_id: string; created_at: string }) => ({
              name: nameMap[r.student_id] || "طالب",
              at: r.created_at,
            }))
          );
        }

        // Activity feed: latest lessons, exams and enrollments merged.
        const [lesRes, exRes] = await Promise.all([
          supabase
            .from("lessons")
            .select("title, created_at")
            .order("created_at", { ascending: false })
            .limit(2),
          supabase
            .from("exams")
            .select("title, created_at")
            .order("created_at", { ascending: false })
            .limit(2),
        ]);
        const acts: Activity[] = [];
        (recentEnr || [])
          .slice(0, 2)
          .forEach((r: { created_at: string }) =>
            acts.push({ text: "تم تسجيل طالب جديد", icon: "👤", at: r.created_at })
          );
        ((lesRes.data || []) as { title: string; created_at: string }[]).forEach((l) =>
          acts.push({ text: `تم إضافة درس جديد: ${l.title}`, icon: "📗", at: l.created_at })
        );
        ((exRes.data || []) as { title: string; created_at: string }[]).forEach((x) =>
          acts.push({ text: `تم إنشاء اختبار جديد: ${x.title}`, icon: "✅", at: x.created_at })
        );
        acts.sort((a, b) => +new Date(b.at) - +new Date(a.at));
        setActivities(acts.slice(0, 4));
      } catch {
        setMessage("خطأ تحميل الإحصائيات.");
      }
    }

    loadStats();
  }, []);

  function timeAgo(iso: string): string {
    const mins = Math.max(0, Math.round((Date.now() - +new Date(iso)) / 60000));
    if (mins < 60) return mins <= 1 ? "منذ دقيقة" : `منذ ${mins} دقيقة`;
    const hours = Math.round(mins / 60);
    if (hours < 24) return hours === 1 ? "منذ ساعة" : `منذ ${hours} ساعة`;
    const days = Math.round(hours / 24);
    return days === 1 ? "منذ يوم" : `منذ ${days} يوم`;
  }

  // Chart geometry
  const CW = 560;
  const CH = 200;
  const maxV = Math.max(1, ...chartPoints);
  const pts = chartPoints.map((v, i) => {
    const x = chartPoints.length > 1 ? (i / (chartPoints.length - 1)) * (CW - 40) + 20 : CW / 2;
    const y = CH - 30 - (v / maxV) * (CH - 70);
    return { x, y, v };
  });
  const linePath = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p.x},${p.y}`).join(" ");
  const areaPath =
    pts.length > 1
      ? `${linePath} L${pts[pts.length - 1].x},${CH - 30} L${pts[0].x},${CH - 30} Z`
      : "";

  return (
    <main className="nq nqd">
      <div className="nqd-topbar">
        <button
          className="nqd-burger"
          onClick={() => setMenuOpen((v) => !v)}
          aria-label="القائمة"
        >
          ☰
        </button>
        <a href="/" className="nqd-toplogo">
          متقن
        </a>
        <span className="nqd-topspacer" />
        <NotificationBell inline />
      </div>

      {menuOpen && (
        <button
          className="nqd-overlay"
          aria-label="إغلاق القائمة"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside className={`nqd-side${menuOpen ? " open" : ""}`}>
        <a href="/" className="nqd-logo">
          <span className="nqd-logo-badge">🎓</span> متقن
        </a>
        <nav className="nqd-nav">
          <a href="/teacher" className="active">
            الرئيسية
          </a>
          <a href="/teacher/courses">إدارة الكورسات</a>
          <a href="/teacher/courses">إدارة المحاضرات</a>
          <a href="/teacher/students">إدارة الطلاب</a>
          <a href="/teacher/exams">الامتحانات</a>
          <a href="/teacher/exams">الأسئلة وبنك الأسئلة</a>
          <a href="/teacher/reports">النتائج والتقارير</a>
          <a href="/teacher/courses">المرفقات</a>
          <a href="/notifications">الإشعارات</a>
          <a href="/profile">الإعدادات</a>
          <a href="/" className="nqd-teacher-link">
            صفحة المنصة الرئيسية
          </a>
        </nav>
      </aside>

      <div className="nqd-main">
        <div className="nqd-headrow">
          <div>
            <h1>لوحة تحكم الأستاذ</h1>
            <p>نظرة سريعة على المنصة وإدارة المحتوى والاشتراكات.</p>
          </div>
          <span className="nqd-bell-desktop">
            <NotificationBell inline />
          </span>
        </div>

        {message && <p role="alert" className="nqd-msg">{message}</p>}
        {!stats && !message && <p>جاري تحميل الإحصائيات...</p>}

        {stats && (
          <>
            <section className="nqd-stats nqd-stats-4">
              <div className="nqd-stat">
                <span className="nqd-stat-ico nqd-ico-blue">👥</span>
                <span className="nqd-stat-num">{stats.students}</span>
                <span className="nqd-stat-label">إجمالي الطلاب</span>
              </div>
              <div className="nqd-stat">
                <span className="nqd-stat-ico nqd-ico-purple">🎬</span>
                <span className="nqd-stat-num">{stats.courses}</span>
                <span className="nqd-stat-label">الكورسات</span>
              </div>
              <div className="nqd-stat">
                <span className="nqd-stat-ico nqd-ico-green">📖</span>
                <span className="nqd-stat-num">{stats.lessons}</span>
                <span className="nqd-stat-label">المحاضرات</span>
              </div>
              <div className="nqd-stat">
                <span className="nqd-stat-ico nqd-ico-gold">✅</span>
                <span className="nqd-stat-num">{stats.activeSubscriptions}</span>
                <span className="nqd-stat-label">اشتراكات نشطة</span>
              </div>
            </section>

            <div className="nqd-teacher-mid">
              <section className="nqd-panel nqd-chart-panel">
                <h3>إحصائيات التسجيل</h3>
                {pts.length > 1 ? (
                  <svg
                    viewBox={`0 0 ${CW} ${CH}`}
                    className="nqd-chart"
                    role="img"
                    aria-label="منحنى التسجيلات"
                  >
                    <defs>
                      <linearGradient id="nqdFill" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="#2f6fb2" stopOpacity=".25" />
                        <stop offset="100%" stopColor="#2f6fb2" stopOpacity="0" />
                      </linearGradient>
                    </defs>
                    <path d={areaPath} fill="url(#nqdFill)" />
                    <path
                      d={linePath}
                      fill="none"
                      stroke="#2f6fb2"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                    />
                    {pts.map((p, i) => (
                      <circle key={i} cx={p.x} cy={p.y} r="4" fill="#2f6fb2" />
                    ))}
                    {pts.map((p, i) => (
                      <text
                        key={`l${i}`}
                        x={p.x}
                        y={CH - 10}
                        textAnchor="middle"
                        fontSize="12"
                        fill="#7a8ea5"
                      >
                        {chartLabels[i]}
                      </text>
                    ))}
                  </svg>
                ) : (
                  <p className="nqd-empty">لسه مفيش تسجيلات كفاية للرسم.</p>
                )}
              </section>

              <section className="nqd-welcome nqd-welcome-teacher">
                <div className="nqd-welcome-text">
                  <h2>مرحبًا بك أستاذ {teacherName || "محمد"} 👋</h2>
                  <p>نتمنى لك يومًا موفقًا.</p>
                  {stats.pendingRequests > 0 && (
                    <a href="/teacher/requests" className="nqd-btn-primary">
                      عندك {stats.pendingRequests} طلب اشتراك معلق ←
                    </a>
                  )}
                </div>
                <div className="nqd-welcome-art">
                  <img src="/illustrations/books.png" alt="" />
                </div>
              </section>
            </div>

            <div className="nqd-panels nqd-panels-3">
              <section className="nqd-panel">
                <h3>أحدث الطلاب المسجلين</h3>
                {recentStudents.length === 0 && (
                  <p className="nqd-empty">لسه مفيش تسجيلات.</p>
                )}
                {recentStudents.map((s, i) => (
                  <div key={i} className="nqd-row">
                    <span className="nqd-row-ico nqd-ico-blue">👤</span>
                    <span className="nqd-row-text">{s.name}</span>
                    <span className="nqd-row-go">{timeAgo(s.at)}</span>
                  </div>
                ))}
              </section>

              <section className="nqd-panel">
                <h3>آخر الأنشطة</h3>
                {activities.length === 0 && (
                  <p className="nqd-empty">مفيش أنشطة حديثة.</p>
                )}
                {activities.map((a, i) => (
                  <div key={i} className="nqd-row">
                    <span className="nqd-row-ico nqd-ico-green">{a.icon}</span>
                    <span className="nqd-row-text">{a.text}</span>
                    <span className="nqd-row-go">{timeAgo(a.at)}</span>
                  </div>
                ))}
              </section>

              <section className="nqd-panel">
                <h3>اختصارات سريعة</h3>
                <a href="/teacher/courses" className="nqd-row">
                  <span className="nqd-row-ico nqd-ico-blue">➕</span>
                  <span className="nqd-row-text">إضافة كورس</span>
                </a>
                <a href="/teacher/courses" className="nqd-row">
                  <span className="nqd-row-ico nqd-ico-purple">▶</span>
                  <span className="nqd-row-text">إضافة محاضرة</span>
                </a>
                <a href="/teacher/exams" className="nqd-row">
                  <span className="nqd-row-ico nqd-ico-green">✅</span>
                  <span className="nqd-row-text">إنشاء اختبار</span>
                </a>
                <a href="/teacher/announcements" className="nqd-row">
                  <span className="nqd-row-ico nqd-ico-gold">📢</span>
                  <span className="nqd-row-text">إعلان جديد</span>
                </a>
              </section>
            </div>
          </>
        )}

        <h3 className="nqd-section-title">كل أدوات الإدارة</h3>
        <div className="nqd-grid">
          {isAdmin && (
            <a className="nqd-card nqd-linkcard" href="/admin">
              <h4>لوحة الإدارة 👑</h4>
              <p>إدارة المستخدمين والكورسات والاشتراكات والإحصائيات.</p>
            </a>
          )}
          <a className="nqd-card nqd-linkcard" href="/teacher/requests">
            <h4>طلبات الاشتراك</h4>
            <p>قبول أو رفض طلبات الطلاب وتحديد مدة الاشتراك.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/courses">
            <h4>إدارة الكورسات</h4>
            <p>إضافة كورس جديد وتعديل السعر والمدة والنشر.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/exams">
            <h4>الاختبارات</h4>
            <p>إنشاء اختبارات اختيار من متعدد لطلاب الكورس.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/grades">
            <h4>الدرجات</h4>
            <p>نتائج الطلاب في الاختبارات ومين لسه ما حلش.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/announcements">
            <h4>الإعلانات</h4>
            <p>اكتب إعلان يظهر لكل الطلاب على المنصة.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/assignments">
            <h4>الواجبات</h4>
            <p>أضف واجب على درس وصحح حلول الطلاب.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/live">
            <h4>البث المباشر</h4>
            <p>ابدأ حصة لايف لطلاب كورس من جوه المنصة.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/students">
            <h4>إدارة الطلاب</h4>
            <p>عرض الطلاب واشتراكاتهم في الكورسات.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/subscriptions">
            <h4>الاشتراكات</h4>
            <p>متابعة الاشتراكات النشطة والمعلقة والمنتهية.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/tickets">
            <h4>تذاكر الدعم</h4>
            <p>رد على استفسارات ومشاكل الطلاب.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/groups">
            <h4>المجموعات</h4>
            <p>اعمل مجموعات لطلابك بأكواد دعوة.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/challenges">
            <h4>التحديات</h4>
            <p>تحديات بنقاط تحفّز طلابك.</p>
          </a>
          <a className="nqd-card nqd-linkcard" href="/teacher/reports">
            <h4>تقارير الطلاب</h4>
            <p>تقرير شهري لأي طالب، جاهز للطباعة PDF.</p>
          </a>
        </div>
      </div>
    </main>
  );
}
