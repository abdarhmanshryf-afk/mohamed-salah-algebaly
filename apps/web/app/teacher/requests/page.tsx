"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type RequestRow = {
  id: string;
  created_at: string;
  profiles: { full_name: string | null; phone: string | null } | null;
  courses: { title: string; duration_days: number | null } | null;
};

export default function TeacherRequests() {
  const [requests, setRequests] = useState<RequestRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function loadRequests() {
    const supabase = client();
    const { data, error } = await supabase
      .from("enrollments")
      .select(
        "id, created_at, profiles(full_name, phone), courses(title, duration_days)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("خطأ تحميل الطلبات: " + error.message);
    } else {
      setRequests((data as unknown as RequestRow[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadRequests();
  }, []);

  async function approve(request: RequestRow) {
    setBusyId(request.id);
    setMessage("");

    const startsAt = new Date();
    let expiresAt: Date | null = null;
    const days = request.courses?.duration_days;
    if (days) {
      expiresAt = new Date(startsAt);
      expiresAt.setDate(expiresAt.getDate() + days);
    }

    const supabase = client();
    const { error } = await supabase
      .from("enrollments")
      .update({
        status: "active",
        starts_at: startsAt.toISOString(),
        expires_at: expiresAt ? expiresAt.toISOString() : null,
      })
      .eq("id", request.id);

    if (error) {
      setMessage("تعذر قبول الطلب: " + error.message);
    } else {
      await loadRequests();
    }
    setBusyId(null);
  }

  async function reject(id: string) {
    setBusyId(id);
    setMessage("");

    const supabase = client();
    const { error } = await supabase
      .from("enrollments")
      .update({ status: "cancelled" })
      .eq("id", id);

    if (error) {
      setMessage("تعذر رفض الطلب: " + error.message);
    } else {
      await loadRequests();
    }
    setBusyId(null);
  }

  if (loading) {
    return <main className="subpage">جاري تحميل الطلبات...</main>;
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>طلبات الاشتراك</h1>
      <p>راجع طلبات الطلاب واقبلها أو ارفضها. القبول يفعّل الاشتراك فورًا.</p>

      {message && <p role="alert">{message}</p>}

      {requests.length === 0 && <p>لا توجد طلبات معلقة حاليًا.</p>}

      {requests.map((request) => (
        <section
          key={request.id}
          style={{
            border: "1px solid #24395e",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <h3>{request.profiles?.full_name || "طالب بدون اسم"}</h3>
          <p>الهاتف: {request.profiles?.phone || "غير مسجل"}</p>
          <p>الكورس المطلوب: {request.courses?.title || "غير معروف"}</p>
          <p>
            مدة الاشتراك عند القبول:{" "}
            {request.courses?.duration_days
              ? request.courses.duration_days + " يوم من تاريخ القبول"
              : "غير محددة"}
          </p>
          <p>
            تاريخ الطلب: {new Date(request.created_at).toLocaleDateString("ar-EG")}
          </p>
          <button
            onClick={() => approve(request)}
            disabled={busyId === request.id}
          >
            قبول وتفعيل
          </button>
          <button
            onClick={() => reject(request.id)}
            disabled={busyId === request.id}
            style={{ marginRight: "10px" }}
          >
            رفض
          </button>
        </section>
      ))}
    </main>
  );
}
