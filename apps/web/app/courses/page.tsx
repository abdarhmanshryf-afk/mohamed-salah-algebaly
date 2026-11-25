
"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function Courses() {
  const [studentName, setStudentName] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function loadStudent() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data: { user } } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data } = await supabase
        .from("profiles")
        .select("full_name")
        .eq("id", user.id)
        .single();

      setStudentName(data?.full_name || "طالبنا العزيز");
      setLoading(false);
    }

    loadStudent();
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

      <p>قريبًا ستجد هنا جميع الكورسات التعليمية الخاصة بك.</p>
    </main>
  );
}
