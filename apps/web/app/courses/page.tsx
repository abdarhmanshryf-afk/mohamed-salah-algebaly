"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import NotificationBell from "../components/NotificationBell";

type Course = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration_days: number | null;
};

type Enrollment = {
  course_id: string;
  status: string;
};

type Notification = {
  id: string;
  title: string;
  body: string;
  link: string | null;
  read: boolean;
};

export default function Courses() {
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [myCourses, setMyCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [ratings, setRatings] = useState<
    Record<string, { avg: number; count: number }>
  >({});
  const [announcements, setAnnouncements] = useState<
    { id: string; body: string }[]
  >([]);
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [lessonsDone, setLessonsDone] = useState(0);
  const [examsDone, setExamsDone] = useState(0);
  const [progressPct, setProgressPct] = useState(0);
  const [menuOpen, setMenuOpen] = useState(false);

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  const loadEnrollments = useCallback(
    async (supabase: SupabaseClient, uid: string) => {
      const { data } = await supabase
        .from("enrollments")
        .select("course_id, status")
        .eq("student_id", uid);
      setEnrollments((data as Enrollment[]) || []);
    },
    []
  );

  useEffect(() => {
    async function loadData() {
      const supabase = client();

      const { data: { user }, error: authError } =
        await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      setStudentId(user.id);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, role")
        .eq("id", user.id)
        .single();

      setStudentName(profile?.full_name || "طالبنا العزيز");

      if (profile?.role === "teacher") {
        setIsTeacher(true);
      }

      const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, price, duration_days")
        .eq("is_published", true);

      if (error) {
        setMessage("خطأ تحميل الكورسات: " + error.message);
      } else {
        setCourses(data || []);
      }

      // Ratings need student-features-setup.sql; degrade gracefully.
      const ratingsRes = await supabase
        .from("course_ratings")
        .select("course_id, stars")
        .eq("is_hidden", false);
      if (!ratingsRes.error) {
        const acc: Record<string, { sum: number; count: number }> = {};
        (ratingsRes.data || []).forEach(
          (r: { course_id: string; stars: number }) => {
            if (!acc[r.course_id]) acc[r.course_id] = { sum: 0, count: 0 };
            acc[r.course_id].sum += r.stars;
            acc[r.course_id].count += 1;
          }
        );
        const out: Record<string, { avg: number; count: number }> = {};
        Object.keys(acc).forEach((id) => {
          out[id] = {
            avg: Math.round((acc[id].sum / acc[id].count) * 10) / 10,
            count: acc[id].count,
          };
        });
        setRatings(out);
      }

      const { data: annData } = await supabase
        .from("announcements")
        .select("id, body")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      setAnnouncements(annData || []);

      // Dashboard stats; each degrades gracefully if its table/RLS is missing.
      const [progressRes, attemptsRes, notifRes] = await Promise.all([
        supabase
          .from("lesson_progress")
          .select("lesson_id, completed")
          .eq("student_id", user.id),
        supabase
          .from("exam_attempts")
          .select("exam_id, score")
          .eq("student_id", user.id),
        supabase
          .from("notifications")
          .select("id, title, body, link, read")
          .eq("student_id", user.id)
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      if (!progressRes.error) {
        setLessonsDone(
          (progressRes.data || []).filter(
            (p: { completed: boolean }) => p.completed
          ).length
        );
      }
      if (!attemptsRes.error) {
        setExamsDone((attemptsRes.data || []).length);
      }
      if (!notifRes.error) {
        setNotifications((notifRes.data as Notification[]) || []);
      }

      if (profile?.role !== "teacher") {
        await loadEnrollments(supabase, user.id);
      }
      setLoading(false);
    }

    loadData();
  }, [loadEnrollments]);

  // My enrolled courses + progress %, derived once enrollments are known.
  useEffect(() => {
    async function loadMine() {
      const activeIds = enrollments
        .filter((e) => e.status === "active")
        .map((e) => e.course_id);
      if (!activeIds.length || !studentId) return;
      const supabase = client();
      const { data: mine } = await supabase
        .from("courses")
        .select("id, title, description, price, duration_days")
        .in("id", activeIds);
      setMyCourses((mine as Course[]) || []);

      const { data: lessonRows } = await supabase
        .from("lessons")
        .select("id, course_id")
        .in("course_id", activeIds);
      const totalLessons = (lessonRows || []).length;
      if (!totalLessons) return;
      const lessonIds = (lessonRows || []).map((l: { id: string }) => l.id);
      const { data: doneRows } = await supabase
        .from("lesson_progress")
        .select("lesson_id")
        .eq("student_id", studentId)
        .eq("completed", true)
        .in("lesson_id", lessonIds);
      const done = (doneRows || []).length;
      setProgressPct(Math.round((done / totalLessons) * 100));
    }
    loadMine();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enrollments, studentId]);

  function statusFor(courseId: string): string | null {
    const mine = enrollments.filter((e) => e.course_id === courseId);
    if (mine.some((e) => e.status === "active")) return "active";
    if (mine.some((e) => e.status === "pending")) return "pending";
    return null;
  }

  async function requestSubscription(courseId: string, price: number) {
    if (price > 0) {
      // Paid courses subscribe from the course page (payment proof flow).
      window.location.href = `/courses/${courseId}`;
      return;
    }
    setBusyId(courseId);
    setMessage("");

    const supabase = client();
    const { error } = await supabase
      .from("enrollments")
      .insert({ student_id: studentId, course_id: courseId });

    if (error) {
      setMessage("خطأ إرسال الطلب: " + error.message);
    } else {
      setMessage("تم إرسال طلب الاشتراك، الأستاذ هيراجعه قريبًا إن شاء الله.");
      await loadEnrollments(supabase, studentId);
    }

    setBusyId(null);
  }

  if (loading) {
    return (
      <main className="nq nqd">
        <div className="nqd-loading">جاري تحميل بياناتك...</div>
      </main>
    );
  }

  const activeCount = enrollments.filter((e) => e.status === "active").length;

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
        <NotificationBell />
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
          <a href="/">الرئيسية</a>
          <a href="/courses" className="active">
            الكورسات
          </a>
          <a href="/my">دروسي</a>
          <a href="/exams">الامتحانات</a>
          <a href="/my">مذكراتي</a>
          <a href="/progress">تقارير الأداء</a>
          <a href="/rooms">غرف التعلم</a>
          <a
            href="https://wa.me/201096786432"
            target="_blank"
            rel="noopener noreferrer"
          >
            الدعم الفني
          </a>
          <a href="/profile">الإعدادات</a>
          {isTeacher && (
            <a href="/teacher" className="nqd-teacher-link">
              لوحة تحكم الأستاذ
            </a>
          )}
        </nav>
      </aside>

      <div className="nqd-main">
        <div className="nqd-headrow">
          <div>
            <h1>مرحبًا بك يا {studentName} ❤️</h1>
            <p>أهلًا بك في منصة متقن.</p>
          </div>
          <span className="nqd-bell-desktop">
            <NotificationBell />
          </span>
        </div>

        <section className="nqd-welcome">
          <div className="nqd-welcome-text">
            <h2>استمر في التعلم، أنت تبلي بلاءً حسنًا!</h2>
            <p>
              أكملت {progressPct}٪ من دروس كورساتك. ثباتك اليوم هو تفوقك بكرة إن
              شاء الله.
            </p>
            <a href="/my" className="nqd-btn-primary">
              استكمل الدروس ←
            </a>
          </div>
          <div className="nqd-welcome-art">
            <img src="/illustrations/welcome-student.png" alt="" />
          </div>
        </section>

        <section className="nqd-stats">
          <div className="nqd-stat">
            <span className="nqd-stat-num">{activeCount}</span>
            <span className="nqd-stat-label">كورساتي</span>
          </div>
          <div className="nqd-stat">
            <span className="nqd-stat-num">{lessonsDone}</span>
            <span className="nqd-stat-label">دروس مكتملة</span>
          </div>
          <div className="nqd-stat">
            <span className="nqd-stat-num">{examsDone}</span>
            <span className="nqd-stat-label">امتحانات</span>
          </div>
        </section>

        {(announcements.length > 0 || notifications.length > 0) && (
          <section className="nqd-notifs">
            <h3>أحدث الإشعارات</h3>
            {notifications.map((n) => (
              <a
                key={n.id}
                href={n.link || "/notifications"}
                className="nqd-notif"
              >
                <strong>{n.title}</strong>
                <span>{n.body}</span>
              </a>
            ))}
            {announcements.map((a) => (
              <div key={a.id} className="nqd-notif nqd-ann">
                <strong>📢 إعلان الأستاذ</strong>
                <span style={{ whiteSpace: "pre-wrap" }}>{a.body}</span>
              </div>
            ))}
          </section>
        )}

        {myCourses.length > 0 && (
          <>
            <h3 className="nqd-section-title">كورساتي الحالية</h3>
            <div className="nqd-grid">
              {myCourses.map((course) => (
                <section key={course.id} className="nqd-card">
                  <h4>{course.title}</h4>
                  <p>{course.description}</p>
                  <div className="nqd-card-foot">
                    <span className="nqd-badge-active">مشترك ✅</span>
                    <a href={`/courses/${course.id}`} className="nqd-btn-ghost">
                      دخول الكورس ←
                    </a>
                  </div>
                </section>
              ))}
            </div>
          </>
        )}

        <h3 className="nqd-section-title">كورسات اللغة العربية</h3>

        {message && <p role="alert" className="nqd-msg">{message}</p>}

        {courses.length === 0 && !message && (
          <p>لا توجد كورسات منشورة حاليًا.</p>
        )}

        <div className="nqd-grid">
          {courses.map((course) => {
            const status = statusFor(course.id);
            return (
              <section key={course.id} className="nqd-card">
                <h4>
                  <a href={`/courses/${course.id}`}>{course.title}</a>
                </h4>
                {ratings[course.id] && (
                  <p className="nqd-rating">
                    ⭐ {ratings[course.id].avg} من 5 ({ratings[course.id].count}{" "}
                    تقييم)
                  </p>
                )}
                <p>{course.description}</p>
                <p className="nqd-meta">
                  السعر: {course.price} جنيه · المدة:{" "}
                  {course.duration_days ?? "غير محددة"} يوم
                </p>

                {isTeacher && <p>أنت الأستاذ 👨‍🏫 إدارة الكورس من لوحة التحكم.</p>}
                {!isTeacher && status === "active" && (
                  <p className="nqd-badge-active">أنت مشترك في هذا الكورس ✅</p>
                )}
                {!isTeacher && status === "pending" && (
                  <p className="nqd-badge-pending">طلبك قيد المراجعة ⏳</p>
                )}
                {!isTeacher && !status && (
                  <button
                    className="nqd-btn-primary"
                    onClick={() => requestSubscription(course.id, course.price)}
                    disabled={busyId === course.id}
                  >
                    {busyId === course.id ? "جاري إرسال الطلب..." : "اشترك الآن"}
                  </button>
                )}
              </section>
            );
          })}
        </div>
      </div>
    </main>
  );
}
