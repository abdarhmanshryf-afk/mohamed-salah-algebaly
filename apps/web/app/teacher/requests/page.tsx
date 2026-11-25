"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type RequestRow = {
  id: string;
  created_at: string;
  payment_reference: string | null;
  payment_proof_path: string | null;
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
    // Payment-proof columns come from the admin setup SQL; fall back pre-setup.
    const full = await supabase
      .from("enrollments")
      .select(
        "id, created_at, payment_reference, payment_proof_path, profiles(full_name, phone), courses(title, duration_days)"
      )
      .eq("status", "pending")
      .order("created_at", { ascending: true });

    if (full.error) {
      const basic = await supabase
        .from("enrollments")
        .select(
          "id, created_at, profiles(full_name, phone), courses(title, duration_days)"
        )
        .eq("status", "pending")
        .order("created_at", { ascending: true });
      if (basic.error) {
        setMessage("خطأ تحميل الطلبات: " + basic.error.message);
      } else {
        setRequests(
          ((basic.data as unknown as Omit<RequestRow, "payment_reference" | "payment_proof_path">[]) || []).map(
            (r) => ({ ...r, payment_reference: null, payment_proof_path: null })
          )
        );
      }
    } else {
      setRequests((full.data as unknown as RequestRow[]) || []);
    }
    setLoading(false);
  }

  async function viewProof(path: string) {
    const supabase = client();
    const { data, error } = await supabase.storage
      .from("payment-proofs")
      .createSignedUrl(path, 120);
    if (error || !data?.signedUrl) {
      setMessage("تعذر فتح الإيصال: " + (error?.message || "رابط غير متاح"));
      return;
    }
    window.open(data.signedUrl, "_blank");
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
    const note = window.prompt("سبب الرفض (اختياري — هيظهر للطالب في صفحته):");
    if (note === null) return; // ألغى من النافذة
    setBusyId(id);
    setMessage("");

    const supabase = client();
    let { error } = await supabase
      .from("enrollments")
      .update({ status: "cancelled", review_note: note.trim() || null })
      .eq("id", id);
    if (error) {
      // review_note column not added yet — reject without the note.
      const fallback = await supabase
        .from("enrollments")
        .update({ status: "cancelled" })
        .eq("id", id);
      error = fallback.error;
    }

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
          {request.payment_reference && (
            <p>
              رقم العملية: <strong>{request.payment_reference}</strong>
            </p>
          )}
          {request.payment_proof_path && (
            <button
              onClick={() => viewProof(request.payment_proof_path!)}
              style={{
                background: "transparent",
                border: "1px solid var(--gold)",
                color: "var(--gold)",
                marginLeft: "10px",
              }}
            >
              📎 عرض إيصال الدفع
            </button>
          )}
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
