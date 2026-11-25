"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import { logPaymentEvent } from "../../lib/paymentEvents";

type SubRow = {
  id: string;
  status: string;
  starts_at: string | null;
  expires_at: string | null;
  created_at: string;
  payment_reference: string | null;
  payment_proof_path: string | null;
  review_note: string | null;
  profiles: { full_name: string | null; phone: string | null } | null;
  courses: { title: string; price: number; duration_days: number | null } | null;
};

const statusLabels: Record<string, string> = {
  pending: "معلق ⏳",
  active: "نشط ✅",
  expired: "منتهي",
  cancelled: "ملغي/مرفوض",
};

const tabs = [
  { key: "pending", label: "معلقة" },
  { key: "active", label: "نشطة" },
  { key: "expired", label: "منتهية" },
  { key: "cancelled", label: "ملغية/مرفوضة" },
  { key: "all", label: "الكل" },
];

export default function AdminSubscriptions() {
  const [rows, setRows] = useState<SubRow[]>([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [proofSupported, setProofSupported] = useState(true);

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function load() {
    const supabase = client();
    // Payment-proof columns come from the admin setup SQL; fall back pre-setup.
    const full = await supabase
      .from("enrollments")
      .select(
        "id, status, starts_at, expires_at, created_at, payment_reference, payment_proof_path, review_note, profiles(full_name, phone), courses(title, price, duration_days)"
      )
      .order("created_at", { ascending: false });
    if (full.error) {
      const basic = await supabase
        .from("enrollments")
        .select(
          "id, status, starts_at, expires_at, created_at, profiles(full_name, phone), courses(title, price, duration_days)"
        )
        .order("created_at", { ascending: false });
      if (basic.error) {
        setMessage("خطأ تحميل الاشتراكات: " + basic.error.message);
        setLoading(false);
        return;
      }
      setProofSupported(false);
      setRows(
        ((basic.data as unknown as Omit<SubRow, "payment_reference" | "payment_proof_path" | "review_note">[]) || []).map(
          (r) => ({ ...r, payment_reference: null, payment_proof_path: null, review_note: null })
        )
      );
    } else {
      setProofSupported(true);
      setRows((full.data as unknown as SubRow[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function approve(row: SubRow) {
    setBusyId(row.id);
    setMessage("");
    const startsAt = new Date();
    let expiresAt: Date | null = null;
    const days = row.courses?.duration_days;
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
      .eq("id", row.id);
    if (error) setMessage("تعذر قبول الطلب: " + error.message);
    else {
      await logPaymentEvent(supabase, row.id, "approved", row.courses?.price);
      await load();
    }
    setBusyId(null);
  }

  async function reject(row: SubRow) {
    const note = window.prompt(
      "سبب الرفض (اختياري — هيظهر للطالب في صفحته):"
    );
    if (note === null) return; // cancelled the prompt
    setBusyId(row.id);
    setMessage("");
    const supabase = client();
    let { error } = await supabase
      .from("enrollments")
      .update({ status: "cancelled", review_note: note.trim() || null })
      .eq("id", row.id);
    if (error) {
      // review_note column not added yet — reject without the note.
      const fallback = await supabase
        .from("enrollments")
        .update({ status: "cancelled" })
        .eq("id", row.id);
      error = fallback.error;
    }
    if (error) setMessage("تعذر رفض الطلب: " + error.message);
    else {
      await logPaymentEvent(supabase, row.id, "rejected", row.courses?.price, note.trim() || null);
      await load();
    }
    setBusyId(null);
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

  if (loading) {
    return <main className="subpage">جاري تحميل الاشتراكات...</main>;
  }

  const filtered = rows.filter((r) => filter === "all" || r.status === filter);

  return (
    <main className="subpage" style={{ maxWidth: "1000px" }}>
      <h1>الاشتراكات والمدفوعات</h1>
      <p>راجع طلبات الاشتراك مع إثبات الدفع، واقبل أو ارفض.</p>

      {message && <p role="alert">{message}</p>}
      {!proofSupported && (
        <div className="notice">
          ⚠️ أعمدة إثبات الدفع مش موجودة لسه — شغّل سكريبت الإعداد
          admin-payments-setup.sql عشان تظهر مراجع التحويل والإيصالات هنا.
        </div>
      )}

      <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", marginTop: "16px" }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setFilter(t.key)}
            style={{
              padding: "8px 16px",
              borderRadius: "20px",
              border: `1px solid ${filter === t.key ? "var(--gold)" : "var(--border)"}`,
              background: filter === t.key ? "var(--gold)" : "transparent",
              color: filter === t.key ? "var(--gold-ink)" : "var(--text-soft)",
            }}
          >
            {t.label} ({t.key === "all" ? rows.length : rows.filter((r) => r.status === t.key).length})
          </button>
        ))}
      </div>

      {filtered.length === 0 && (
        <p style={{ marginTop: "20px" }}>لا توجد اشتراكات في هذا التصنيف.</p>
      )}

      {filtered.map((r) => (
        <section key={r.id} className="card" style={{ marginTop: "14px" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: "12px",
              flexWrap: "wrap",
            }}
          >
            <div style={{ minWidth: "230px", flex: 1 }}>
              <h3 style={{ margin: 0 }}>
                {r.profiles?.full_name || "طالب بدون اسم"}{" "}
                <span style={{ fontSize: "13px", color: "var(--text-soft)" }}>
                  {statusLabels[r.status] || r.status}
                </span>
              </h3>
              <p style={{ margin: "8px 0 0", fontSize: "14px" }}>
                {r.courses?.title || "كورس"} ·{" "}
                {r.courses?.price ? `${r.courses.price} جنيه` : "مجاني"}
                {r.profiles?.phone ? ` · ${r.profiles.phone}` : ""}
              </p>
              <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                طلب يوم {new Date(r.created_at).toLocaleDateString("ar-EG")}
                {r.expires_at
                  ? ` · ينتهي ${new Date(r.expires_at).toLocaleDateString("ar-EG")}`
                  : ""}
              </p>
              {r.payment_reference && (
                <p style={{ margin: "8px 0 0", fontSize: "14px" }}>
                  رقم العملية: <strong style={{ color: "var(--gold)" }}>{r.payment_reference}</strong>
                </p>
              )}
              {r.review_note && (
                <p
                  style={{
                    margin: "6px 0 0",
                    fontSize: "14px",
                    color: r.status === "cancelled" ? "var(--error)" : "var(--info)",
                  }}
                >
                  {r.status === "cancelled" ? "ملاحظة الرفض: " : "ملاحظة: "}
                  {r.review_note}
                </p>
              )}
            </div>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>
              {r.payment_proof_path && (
                <button
                  onClick={() => viewProof(r.payment_proof_path!)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--gold)",
                    color: "var(--gold)",
                  }}
                >
                  📎 عرض الإيصال
                </button>
              )}
              {r.status !== "active" && (
                <button
                  onClick={() => approve(r)}
                  disabled={busyId === r.id}
                  style={{ background: "var(--success-bg)", color: "white" }}
                >
                  قبول وتفعيل
                </button>
              )}
              {r.status !== "cancelled" && (
                <button
                  onClick={() => reject(r)}
                  disabled={busyId === r.id}
                  style={{ background: "var(--error-bg)", color: "white" }}
                >
                  {r.status === "active" ? "إلغاء الاشتراك" : "رفض"}
                </button>
              )}
            </div>
          </div>
        </section>
      ))}
    </main>
  );
}
