"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";

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

export default function Courses() {
  const [studentName, setStudentName] = useState("");
  const [studentId, setStudentId] = useState("");
  const [isTeacher, setIsTeacher] = useState(false);
  const [courses, setCourses] = useState<Course[]>([]);
  const [enrollments, setEnrollments] = useState<Enrollment[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [announcements, setAnnouncements] = useState<
    { id: string; body: string }[]
  >([]);

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

      const { data: annData } = await supabase
        .from("announcements")
        .select("id, body")
        .eq("is_active", true)
        .order("created_at", { ascending: false })
        .limit(3);
      setAnnouncements(annData || []);

      if (profile?.role !== "teacher") {
        await loadEnrollments(supabase, user.id);
      }
      setLoading(false);
    }

    loadData();
  }, [loadEnrollments]);

  function statusFor(courseId: string): string | null {
    const mine = enrollments.filter((e) => e.course_id === courseId);
    if (mine.some((e) => e.status === "active")) return "active";
    if (mine.some((e) => e.status === "pending")) return "pending";
    return null;
  }

  async function requestSubscription(courseId: string) {
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
    return <main className="subpage">جاري تحميل بياناتك...</main>;
  }

  return (
    <main className="subpage">
      <a href="/">← الرئيسية</a>
      {isTeacher && (
        <a href="/teacher" style={{ marginInlineStart: "16px" }}>
          لوحة التحكم
        </a>
      )}

      <h1>مرحبًا بك يا {studentName} ❤️</h1>
      <p>أهلًا بك في منصة متقن.</p>

      {announcements.length > 0 && (
        <section
          style={{
            background: "#1a2c4d",
            border: "1px solid var(--gold)",
            borderRadius: "12px",
            padding: "14px 16px",
            marginTop: "8px",
          }}
        >
          <strong style={{ color: "var(--gold)" }}>📢 إعلانات الأستاذ</strong>
          {announcements.map((a) => (
            <p key={a.id} style={{ margin: "8px 0 0", whiteSpace: "pre-wrap" }}>
              {a.body}
            </p>
          ))}
        </section>
      )}

      <h2>كورسات اللغة العربية</h2>

      {message && <p role="alert">{message}</p>}

      {courses.length === 0 && !message && (
        <p>لا توجد كورسات منشورة حاليًا.</p>
      )}

      {courses.map((course) => {
        const status = statusFor(course.id);
        return (
          <section
            key={course.id}
            style={{
              border: "1px solid #24395e",
              borderRadius: "12px",
              padding: "16px",
              marginTop: "16px",
            }}
          >
            <h3>
              <a href={`/courses/${course.id}`} style={{ color: "var(--gold)" }}>
                {course.title}
              </a>
            </h3>
            <p>{course.description}</p>
            <p>السعر: {course.price} جنيه</p>
            <p>مدة الكورس: {course.duration_days ?? "غير محددة"} يوم</p>

            {isTeacher && <p>أنت الأستاذ 👨‍🏫 إدارة الكورس من لوحة التحكم.</p>}
            {!isTeacher && status === "active" && <p>أنت مشترك في هذا الكورس ✅</p>}
            {!isTeacher && status === "pending" && <p>طلبك قيد المراجعة ⏳</p>}
            {!isTeacher && !status && (
              <button
                onClick={() => requestSubscription(course.id)}
                disabled={busyId === course.id}
              >
                {busyId === course.id ? "جاري إرسال الطلب..." : "اشترك الآن"}
              </button>
            )}
          </section>
        );
      })}
    </main>
  );
}
