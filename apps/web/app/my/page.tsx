"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Row = {
  course_id: string;
  status: string;
  title: string;
};

export default function MyLessons() {
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();
      if (profile?.role === "teacher") {
        window.location.href = "/teacher";
        return;
      }

      const { data: enrollments } = await supabase
        .from("enrollments")
        .select("course_id, status")
        .eq("student_id", user.id);

      const list = enrollments || [];
      if (list.length === 0) {
        setLoading(false);
        return;
      }

      const { data: courses } = await supabase
        .from("courses")
        .select("id, title")
        .in(
          "id",
          list.map((e: { course_id: string }) => e.course_id)
        );

      const titles: Record<string, string> = {};
      (courses || []).forEach((c: { id: string; title: string }) => {
        titles[c.id] = c.title;
      });

      setRows(
        list.map((e: { course_id: string; status: string }) => ({
          course_id: e.course_id,
          status: e.status,
          title: titles[e.course_id] || "كورس",
        }))
      );
      setLoading(false);
      if (message) setMessage("");
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>دروسي</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && rows.length === 0 && (
          <p>
            لسه ما اشتركتش في أي كورس.{" "}
            <a href="/courses" style={{ color: "var(--gold)", fontWeight: "bold" }}>
              شوف الكورسات المتاحة
            </a>
          </p>
        )}
        {message && <p role="alert">{message}</p>}
        {rows.map((r) => (
          <section key={r.course_id} className="course">
            <div>
              <h3 style={{ margin: 0, color: "var(--gold)" }}>{r.title}</h3>
              <p style={{ margin: "6px 0 0" }}>
                {r.status === "active" ? "اشتراكك شغال ✅" : "طلبك قيد المراجعة ⏳"}
              </p>
            </div>
            {r.status === "active" && (
              <a
                href={`/courses/${r.course_id}`}
                className="cta"
                style={{ marginTop: 0, padding: "10px 24px", fontSize: 15 }}
              >
                ادخل الكورس
              </a>
            )}
          </section>
        ))}
      </div>
    </main>
  );
}
