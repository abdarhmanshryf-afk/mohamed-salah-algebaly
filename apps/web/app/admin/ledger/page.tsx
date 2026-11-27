"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../../lib/supabase-browser";

type LedgerRow = {
  id: string;
  event: string;
  amount: number | null;
  note: string | null;
  created_at: string;
  enrollments: {
    profiles: { full_name: string | null } | null;
    courses: { title: string; price: number } | null;
  } | null;
};

const eventLabels: Record<string, { label: string; color: string }> = {
  submitted: { label: "طلب دفع جديد", color: "var(--info)" },
  approved: { label: "تم القبول ✅", color: "var(--success)" },
  rejected: { label: "اترفض ❌", color: "var(--error)" },
  manual_add: { label: "إضافة يدوية", color: "var(--warning)" },
  refunded: { label: "استرجاع", color: "var(--error)" },
};

export default function AdminLedger() {
  const [rows, setRows] = useState<LedgerRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [supported, setSupported] = useState(true);
  const [message, setMessage] = useState("");

  useEffect(() => {
    async function load() {
      try {
      const supabase = getBrowserClient();
      const { data, error } = await supabase
        .from("payment_events")
        .select(
          "id, event, amount, note, created_at, enrollments(profiles(full_name), courses(title, price))"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) {
        // جدول الدفتر بيتعمل بسكريبت المرحلة 2 — لو لسه ما اتشغّلش
        setSupported(false);
      } else {
        setRows((data as unknown as LedgerRow[]) || []);
      }
      setLoading(false);
      } catch {
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const approvedTotal = rows
    .filter((r) => r.event === "approved" || r.event === "manual_add")
    .reduce((s, r) => s + (r.amount || 0), 0);

  return (
    <main className="subpage">
      <h1>💰 دفتر الحسابات</h1>
      <p style={{ color: "var(--text-muted)" }}>
        كل حركة دفع على المنصة: طلبات جديدة، قبول، رفض، وإضافات يدوية.
      </p>
      {loading && <p>جاري التحميل...</p>}
      {message && <p role="alert">{message}</p>}
      {!loading && !supported && (
        <section className="course" style={{ display: "block" }}>
          <p>
            دفتر الحسابات لسه مش مفعّل — شغّل سكريبت <code>phase2-features.sql</code>{" "}
            في SQL Editor وهيبدأ يسجّل كل حركة من وقتها.
          </p>
        </section>
      )}
      {!loading && supported && (
        <>
          <section className="course" style={{ display: "block", textAlign: "center" }}>
            <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
              إجمالي المقبوضات المسجّلة
            </p>
            <p style={{ margin: "6px 0 0", fontSize: "22px", fontWeight: "bold", color: "var(--gold)" }}>
              {approvedTotal} جنيه
            </p>
          </section>
          {rows.length === 0 && <p>مفيش حركات مسجّلة لسه.</p>}
          {rows.map((r) => {
            const meta = eventLabels[r.event] || { label: r.event, color: "var(--info)" };
            return (
              <section key={r.id} className="course" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: "6px" }}>
                  <strong>{r.enrollments?.profiles?.full_name || "طالب"}</strong>
                  <span style={{ color: meta.color }}>{meta.label}</span>
                </div>
                <p style={{ margin: "6px 0 0", fontSize: "14px" }}>
                  {r.enrollments?.courses?.title || "كورس"}
                  {r.amount != null && <> — <strong>{r.amount} جنيه</strong></>}
                </p>
                {r.note && (
                  <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
                    {r.note}
                  </p>
                )}
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  {new Date(r.created_at).toLocaleString("ar-EG")}
                </p>
              </section>
            );
          })}
        </>
      )}
    </main>
  );
}
