"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Stats = {
  students: number;
  courses: number;
  pendingRequests: number;
  activeSubscriptions: number;
};

export default function TeacherHome() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadStats() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const [students, courses, pending, active] = await Promise.all([
        supabase
          .from("profiles")
          .select("id", { count: "exact", head: true })
          .eq("role", "student"),
        supabase.from("courses").select("id", { count: "exact", head: true }),
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
        pendingRequests: pending.count ?? 0,
        activeSubscriptions: active.count ?? 0,
      });
    }

    loadStats();
  }, []);

  return (
    <main className="subpage">
      <a href="/">← الرئيسية</a>
      <h1>لوحة تحكم الأستاذ</h1>
      <p>نظرة سريعة على المنصة وإدارة المحتوى والاشتراكات.</p>

      {message && <p role="alert">{message}</p>}

      {!stats && !message && <p>جاري تحميل الإحصائيات...</p>}

      {stats && (
        <div className="cards">
          <div className="card">
            <h3>{stats.students}</h3>
            <p>عدد الطلاب</p>
          </div>
          <div className="card">
            <h3>{stats.courses}</h3>
            <p>عدد الكورسات</p>
          </div>
          <div className="card">
            <h3>{stats.pendingRequests}</h3>
            <p>طلبات اشتراك معلقة</p>
          </div>
          <div className="card">
            <h3>{stats.activeSubscriptions}</h3>
            <p>اشتراكات نشطة</p>
          </div>
        </div>
      )}

      <div className="cards" style={{ marginTop: "30px" }}>
        <a className="card" href="/teacher/requests">
          <h3>طلبات الاشتراك</h3>
          <p>قبول أو رفض طلبات الطلاب وتحديد مدة الاشتراك.</p>
        </a>
        <a className="card" href="/teacher/courses">
          <h3>إدارة الكورسات</h3>
          <p>إضافة كورس جديد وتعديل السعر والمدة والنشر.</p>
        </a>
        <a className="card" href="/teacher/exams">
          <h3>الاختبارات</h3>
          <p>إنشاء اختبارات اختيار من متعدد لطلاب الكورس.</p>
        </a>
        <a className="card" href="/teacher/grades">
          <h3>الدرجات</h3>
          <p>نتائج الطلاب في الاختبارات ومين لسه ما حلش.</p>
        </a>
        <a className="card" href="/teacher/students">
          <h3>إدارة الطلاب</h3>
          <p>عرض الطلاب واشتراكاتهم في الكورسات.</p>
        </a>
        <a className="card" href="/teacher/subscriptions">
          <h3>الاشتراكات</h3>
          <p>متابعة الاشتراكات النشطة والمعلقة والمنتهية.</p>
        </a>
      </div>
    </main>
  );
}
