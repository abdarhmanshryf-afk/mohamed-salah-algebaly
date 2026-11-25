"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Enrollment = {
  id: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  courses: { title: string } | null;
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

  useEffect(() => {
    async function loadStudents() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("profiles")
        .select(
          "id, full_name, phone, created_at, enrollments(id, status, starts_at, expires_at, courses(title))"
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

    loadStudents();
  }, []);

  if (loading) {
    return <main className="subpage">جاري تحميل الطلاب...</main>;
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>إدارة الطلاب</h1>
      <p>كل الطلاب المسجلين واشتراكاتهم في الكورسات.</p>

      {message && <p role="alert">{message}</p>}

      {students.length === 0 && <p>لا يوجد طلاب مسجلون حتى الآن.</p>}

      {students.map((student) => (
        <section
          key={student.id}
          style={{
            border: "1px solid #24395e",
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
