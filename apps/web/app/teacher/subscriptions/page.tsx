"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type SubscriptionRow = {
  id: string;
  status: string;
  starts_at: string;
  expires_at: string | null;
  created_at: string;
  profiles: { full_name: string | null } | null;
  courses: { title: string } | null;
};

const statusLabels: Record<string, string> = {
  pending: "معلق",
  active: "نشط",
  expired: "منتهي",
  cancelled: "ملغي",
};

const statusOrder = ["active", "pending", "expired", "cancelled"];

export default function TeacherSubscriptions() {
  const [subscriptions, setSubscriptions] = useState<SubscriptionRow[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function loadSubscriptions() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const { data, error } = await supabase
        .from("enrollments")
        .select(
          "id, status, starts_at, expires_at, created_at, profiles(full_name), courses(title)"
        )
        .order("created_at", { ascending: false });

      if (error) {
        setMessage("خطأ تحميل الاشتراكات: " + error.message);
      } else {
        setSubscriptions((data as unknown as SubscriptionRow[]) || []);
      }
      setLoading(false);
    }

    loadSubscriptions();
  }, []);

  const visible =
    filter === "all"
      ? subscriptions
      : subscriptions.filter((s) => s.status === filter);

  if (loading) {
    return <main className="subpage">جاري تحميل الاشتراكات...</main>;
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>الاشتراكات</h1>

      {message && <p role="alert">{message}</p>}

      <div style={{ marginTop: "16px" }}>
        <button onClick={() => setFilter("all")}>الكل ({subscriptions.length})</button>{" "}
        {statusOrder.map((status) => (
          <button
            key={status}
            onClick={() => setFilter(status)}
            style={{ marginRight: "8px" }}
          >
            {statusLabels[status]} (
            {subscriptions.filter((s) => s.status === status).length})
          </button>
        ))}
      </div>

      {visible.length === 0 && <p>لا توجد اشتراكات في هذه الحالة.</p>}

      {visible.map((sub) => (
        <section
          key={sub.id}
          style={{
            border: "1px solid #24395e",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <h3>
            {sub.profiles?.full_name || "طالب بدون اسم"} —{" "}
            {sub.courses?.title || "كورس غير معروف"}
          </h3>
          <p>الحالة: {statusLabels[sub.status] || sub.status}</p>
          <p>
            بداية الاشتراك: {new Date(sub.starts_at).toLocaleDateString("ar-EG")}
          </p>
          <p>
            نهاية الاشتراك:{" "}
            {sub.expires_at
              ? new Date(sub.expires_at).toLocaleDateString("ar-EG")
              : "غير محددة"}
          </p>
        </section>
      ))}
    </main>
  );
}
