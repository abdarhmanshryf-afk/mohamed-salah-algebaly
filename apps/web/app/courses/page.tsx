
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Course = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration_days: number | null;
};

export default function Courses() {
  const [studentName, setStudentName] = useState("");
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadData() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setStudentName(profile?.full_name || "طالبنا العزيز");

      const { data, error } = await supabase
        .from("courses")
        .select("id, title, description, price, duration_days")
        .eq("is_published", true);

      if (error) {
        setMessage("تعذر تحميل الكورسات حاليًا.");
      } else {
        setCourses(data || []);
      }

      setLoading(false);
    }

    loadData();
  }, []);

  if (loading) {
    return <main className="subpage">جاري تحميل بياناتك...</main>;
  }

  return (
    <main className="subpage">
      <a href="/">← الرئيسية</a>

      <h1>مرحبًا بك يا {studentName} ❤️</h1>
      <p>أهلًا بك في منصة الأستاذ محمد صلاح الجبالي.</p>

      <h2>كورسات اللغة العربية</h2>

      {message && <p role="alert">{message}</p>}

      {courses.length === 0 && !message && (
        <p>لا توجد كورسات منشورة حاليًا.</p>
      )}

      {courses.map((course) => (
        <section
          key={course.id}
          style={{
            border: "1px solid #ddd",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <h3>{course.title}</h3>
          <p>{course.description}</p>
          <p>السعر: {course.price} جنيه</p>
          <p>مدة الكورس: {course.duration_days ?? "غير محددة"} يوم</p>
        </section>
      ))}
    </main>
  );
}
