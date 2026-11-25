"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { logPaymentEvent } from "../../lib/paymentEvents";

type Enrollment = {
  id: string;
  course_id: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  courses: { title: string } | null;
};

type CourseOpt = {
  id: string;
  title: string;
  duration_days: number | null;
  price: number | null;
};

type Student = {
  id: string;
  full_name: string | null;
  phone: string | null;
  created_at: string;
  enrollments: Enrollment[];
};

const statusLabels: Record<string, string> = {
  pending: "معلق",
  active: "نشط",
  expired: "منتهي",
  cancelled: "ملغي",
};

export default function TeacherStudents() {
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [courses, setCourses] = useState<CourseOpt[]>([]);
  const [addCourseId, setAddCourseId] = useState("");
  const [studentQuery, setStudentQuery] = useState("");
  const [addStudentId, setAddStudentId] = useState("");
  const [addBusy, setAddBusy] = useState(false);
  const [addMessage, setAddMessage] = useState("");

  useEffect(() => {
    async function loadStudents() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, created_at, enrollments(id, course_id, status, starts_at, expires_at, courses(title))"
        )
        .eq("role", "student")
        .order("created_at", { ascending: false });

      if (error) {
        setMessage("خطأ تحميل الطلاب: " + error.message);
      } else {
        setStudents((data as unknown as Student[]) || []);
      }
      setLoading(false);
    }

    async function loadCourses() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );
      const { data } = await supabase
        .from("courses")
        .select("id, title, duration_days, price")
        .order("created_at");
      setCourses((data as CourseOpt[]) || []);
    }

    loadStudents();
    loadCourses();
  }, []);

  async function reloadStudents() {
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
    const { data } = await supabase
      .from("profiles")
      .select(
        "id, full_name, phone, created_at, enrollments(id, course_id, status, starts_at, expires_at, courses(title))"
      )
      .eq("role", "student")
      .order("created_at", { ascending: false });
    setStudents((data as unknown as Student[]) || []);
  }

  const MANUAL_NOTE = "أضيف يدويًا بواسطة الأستاذ";

  async function addStudentToCourse() {
    setAddMessage("");
    if (!addCourseId) {
      setAddMessage("اختر الكورس الأول.");
      return;
    }
    if (!addStudentId) {
      setAddMessage("اختر الطالب الأول.");
      return;
    }
    const student = students.find((s) => s.id === addStudentId);
    const course = courses.find((c) => c.id === addCourseId);
    if (!student || !course) return;

    setAddBusy(true);
    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const existing = (student.enrollments || []).find(
      (e) => e.course_id === addCourseId
    );
    if (
      existing &&
      existing.status === "active" &&
      (!existing.expires_at || new Date(existing.expires_at) > new Date())
    ) {
      setAddMessage("الطالب ده مشترك بالفعل في الكورس ده ✅");
      setAddBusy(false);
      return;
    }

    const startsAt = new Date();
    let expiresAt: Date | null = null;
    if (course.duration_days) {
      expiresAt = new Date(startsAt);
      expiresAt.setDate(expiresAt.getDate() + course.duration_days);
    }
    const payload = {
      status: "active",
      starts_at: startsAt.toISOString(),
      expires_at: expiresAt ? expiresAt.toISOString() : null,
      review_note: MANUAL_NOTE,
    };

    let error;
    if (existing) {
      ({ error } = await supabase
        .from("enrollments")
        .update(payload)
        .eq("id", existing.id));
    } else {
      ({ error } = await supabase.from("enrollments").insert({
        student_id: addStudentId,
        course_id: addCourseId,
        ...payload,
      }));
    }

    if (error) {
      setAddMessage(
        "تعذر إضافة الطالب. لو الرسالة فيها row-level security يبقى لازم سكريبت admin-manual-enroll.sql يتشغّل الأول. (" +
          error.message +
          ")"
      );
    } else {
      const enrollmentId = existing ? existing.id : undefined;
      if (!enrollmentId) {
        const { data: created } = await supabase
          .from("enrollments")
          .select("id")
          .eq("student_id", addStudentId)
          .eq("course_id", addCourseId)
          .order("created_at", { ascending: false })
          .limit(1);
        if (created && created[0]) {
          await logPaymentEvent(supabase, created[0].id, "manual_add", course.price, MANUAL_NOTE);
        }
      } else {
        await logPaymentEvent(supabase, enrollmentId, "manual_add", course.price, MANUAL_NOTE);
      }
      setAddMessage(
        "تم ✅ " +
          (student.full_name || "الطالب") +
          " بقى مشترك في " +
          course.title
      );
      setAddStudentId("");
      setStudentQuery("");
      await reloadStudents();
    }
    setAddBusy(false);
  }

  const filteredStudents = students.filter((s) => {
    const q = studentQuery.trim();
    if (!q) return false;
    return (
      (s.full_name || "").includes(q) || (s.phone || "").includes(q)
    );
  });

  if (loading) {
    return <main className="subpage">جاري تحميل الطلاب...</main>;
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>إدارة الطلاب</h1>
      <p>كل الطلاب المسجلين واشتراكاتهم في الكورسات.</p>

      {message && <p role="alert">{message}</p>}

      <section className="card" style={{ marginTop: "16px" }}>
        <h3 style={{ marginTop: 0 }}>إضافة طالب لكورس يدويًا ➕</h3>
        <p style={{ fontSize: "14px" }}>
          للطالب اللي دفع كاش أو بأي طريقة خارج المنصة — بيتفعّل اشتراكه فورًا
          من غير طلب ومراجعة.
        </p>
        <label style={{ display: "block" }}>
          الكورس
          <select
            value={addCourseId}
            onChange={(e) => setAddCourseId(e.target.value)}
            style={{ width: "100%", marginTop: "6px" }}
          >
            <option value="">— اختر الكورس —</option>
            {courses.map((c) => (
              <option key={c.id} value={c.id}>
                {c.title}
              </option>
            ))}
          </select>
        </label>
        <label style={{ display: "block", marginTop: "12px" }}>
          الطالب (ابحث بالاسم أو الهاتف)
          <input
            type="search"
            value={studentQuery}
            onChange={(e) => {
              setStudentQuery(e.target.value);
              setAddStudentId("");
            }}
            placeholder="اكتب جزء من الاسم أو رقم الهاتف..."
            style={{ width: "100%", marginTop: "6px" }}
          />
        </label>
        {studentQuery.trim() && (
          <div style={{ marginTop: "8px" }}>
            {filteredStudents.length === 0 && (
              <p style={{ fontSize: "14px" }}>لا يوجد طالب مطابق للبحث.</p>
            )}
            {filteredStudents.slice(0, 5).map((s) => (
              <button
                key={s.id}
                onClick={() => setAddStudentId(s.id)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "right",
                  marginTop: "6px",
                  padding: "10px 12px",
                  borderRadius: "10px",
                  border: `1px solid ${addStudentId === s.id ? "var(--gold)" : "var(--border)"}`,
                  background: addStudentId === s.id ? "var(--border)" : "var(--bg-2)",
                  color: addStudentId === s.id ? "var(--gold)" : "var(--text-soft)",
                }}
              >
                {s.full_name || "بدون اسم"} — {s.phone || "بدون هاتف"}
              </button>
            ))}
          </div>
        )}
        {addMessage && (
          <p role="status" style={{ marginTop: "10px" }}>
            {addMessage}
          </p>
        )}
        <button
          onClick={addStudentToCourse}
          disabled={addBusy}
          style={{ marginTop: "12px" }}
        >
          {addBusy ? "جاري الإضافة..." : "أضف للكورس ✅"}
        </button>
      </section>

      {students.length === 0 && <p>لا يوجد طلاب مسجلون حتى الآن.</p>}

      {students.map((student) => (
        <section
          key={student.id}
          style={{
            border: "1px solid var(--border)",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <h3>{student.full_name || "طالب بدون اسم"}</h3>
          <p>الهاتف: {student.phone || "غير مسجل"}</p>
          <p>
            انضم في: {new Date(student.created_at).toLocaleDateString("ar-EG")}
          </p>

          {student.enrollments.length === 0 ? (
            <p>لا توجد اشتراكات.</p>
          ) : (
            <ul>
              {student.enrollments.map((enrollment) => (
                <li key={enrollment.id}>
                  {enrollment.courses?.title || "كورس غير معروف"} —{" "}
                  {statusLabels[enrollment.status] || enrollment.status}
                  {enrollment.expires_at &&
                    " (حتى " +
                      new Date(enrollment.expires_at).toLocaleDateString("ar-EG") +
                      ")"}
                </li>
              ))}
            </ul>
          )}
        </section>
      ))}
    </main>
  );
}
