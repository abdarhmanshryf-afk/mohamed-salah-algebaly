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
  const [isAdmin, setIsAdmin] = useState(false);

  useEffect(() => {
    async function loadStats() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (user) {
        if (user.id === "1297f9ef-89c8-45d9-82a4-01d5f48206fc") {
          setIsAdmin(true);
        } else {
          const { data: prof } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .single();
          if (prof?.role === "admin") setIsAdmin(true);
        }
      }

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
        {isAdmin && (
          <a className="card" href="/admin">
            <h3>لوحة الإدارة 👑</h3>
            <p>إدارة المستخدمين والكورسات والاشتراكات والإحصائيات.</p>
          </a>
        )}
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
        <a className="card" href="/teacher/announcements">
          <h3>الإعلانات</h3>
          <p>اكتب إعلان يظهر لكل الطلاب على المنصة.</p>
        </a>
        <a className="card" href="/teacher/assignments">
          <h3>الواجبات</h3>
          <p>أضف واجب على درس وصحح حلول الطلاب.</p>
        </a>
        <a className="card" href="/teacher/live">
          <h3>البث المباشر</h3>
          <p>ابدأ حصة لايف لطلاب كورس من جوه المنصة.</p>
        </a>
        <a className="card" href="/teacher/students">
          <h3>إدارة الطلاب</h3>
          <p>عرض الطلاب واشتراكاتهم في الكورسات.</p>
        </a>
        <a className="card" href="/teacher/subscriptions">
          <h3>الاشتراكات</h3>
          <p>متابعة الاشتراكات النشطة والمعلقة والمنتهية.</p>
        </a>
        <a className="card" href="/teacher/tickets">
          <h3>تذاكر الدعم</h3>
          <p>رد على استفسارات ومشاكل الطلاب.</p>
        </a>
        <a className="card" href="/teacher/groups">
          <h3>المجموعات</h3>
          <p>اعمل مجموعات لطلابك بأكواد دعوة.</p>
        </a>
        <a className="card" href="/teacher/challenges">
          <h3>التحديات</h3>
          <p>تحديات بنقاط تحفّز طلابك.</p>
        </a>
      </div>
    </main>
  );
}
