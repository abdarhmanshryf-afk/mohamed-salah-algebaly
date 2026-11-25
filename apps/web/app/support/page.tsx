"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  created_at: string;
  updated_at: string;
};

type Msg = {
  id: string;
  body: string;
  is_staff: boolean;
  created_at: string;
};

const statusLabels: Record<string, string> = {
  open: "مفتوحة ⏳",
  answered: "اترد عليها ✅",
  closed: "مقفولة",
};

export default function SupportPage() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [subject, setSubject] = useState("");
  const [firstBody, setFirstBody] = useState("");
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function load() {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    setUserId(user.id);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, subject, status, created_at, updated_at")
      .eq("student_id", user.id)
      .order("updated_at", { ascending: false });
    if (error) {
      setSupported(false); // سكريبت المرحلة 2 لسه ما اتشغّلش
    } else {
      setTickets((data as Ticket[]) || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function openConversation(t: Ticket) {
    const supabase = client();
    setOpenTicket(t);
    setMessages([]);
    const { data } = await supabase
      .from("ticket_messages")
      .select("id, body, is_staff, created_at")
      .eq("ticket_id", t.id)
      .order("created_at");
    setMessages((data as Msg[]) || []);
  }

  async function createTicket() {
    if (!subject.trim() || !firstBody.trim() || !userId) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const { data: t, error } = await supabase
      .from("support_tickets")
      .insert({ student_id: userId, subject: subject.trim() })
      .select("id, subject, status, created_at, updated_at")
      .single();
    if (error || !t) {
      setMessage("تعذر فتح التذكرة: " + (error?.message || ""));
      setBusy(false);
      return;
    }
    await supabase.from("ticket_messages").insert({
      ticket_id: t.id,
      sender_id: userId,
      body: firstBody.trim(),
      is_staff: false,
    });
    setSubject("");
    setFirstBody("");
    setBusy(false);
    await load();
    openConversation(t as Ticket);
  }

  async function sendReply() {
    if (!reply.trim() || !openTicket || !userId) return;
    setBusy(true);
    const supabase = client();
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: openTicket.id,
      sender_id: userId,
      body: reply.trim(),
      is_staff: false,
    });
    if (!error) {
      await supabase
        .from("support_tickets")
        .update({ status: "open", updated_at: new Date().toISOString() })
        .eq("id", openTicket.id);
      setReply("");
      await openConversation(openTicket);
      load();
    } else {
      setMessage("تعذر إرسال الرد: " + error.message);
    }
    setBusy(false);
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>🛟 الدعم</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && !supported && (
          <p>خدمة التذاكر لسه بتتفعّل — جرّب تاني بعد شوية.</p>
        )}
        {message && <p role="alert">{message}</p>}

        {!loading && supported && !openTicket && (
          <>
            <section className="course" style={{ display: "block" }}>
              <h3 style={{ marginTop: 0, color: "var(--gold)" }}>افتح تذكرة جديدة</h3>
              <input
                type="text"
                placeholder="الموضوع (مثال: مشكلة في الدفع)"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                style={{ width: "100%", marginBottom: "8px", padding: "8px" }}
              />
              <textarea
                placeholder="اكتب مشكلتك بالتفصيل..."
                value={firstBody}
                onChange={(e) => setFirstBody(e.target.value)}
                rows={3}
                style={{ width: "100%", marginBottom: "8px", padding: "8px" }}
              />
              <button onClick={createTicket} disabled={busy || !subject.trim() || !firstBody.trim()}>
                {busy ? "جاري الإرسال..." : "إرسال التذكرة"}
              </button>
            </section>
            <h3>تذاكرك</h3>
            {tickets.length === 0 && <p>مفيش تذاكر لسه.</p>}
            {tickets.map((t) => (
              <section
                key={t.id}
                className="course"
                style={{ display: "block", cursor: "pointer" }}
                onClick={() => openConversation(t)}
              >
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <strong>{t.subject}</strong>
                  <span style={{ color: "var(--text-muted)" }}>{statusLabels[t.status] || t.status}</span>
                </div>
                <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                  {new Date(t.updated_at).toLocaleString("ar-EG")}
                </p>
              </section>
            ))}
          </>
        )}

        {!loading && supported && openTicket && (
          <>
            <button onClick={() => { setOpenTicket(null); load(); }} style={{ marginBottom: "10px" }}>
              ← رجوع للتذاكر
            </button>
            <section className="course" style={{ display: "block" }}>
              <h3 style={{ marginTop: 0, color: "var(--gold)" }}>{openTicket.subject}</h3>
              <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px" }}>
                {statusLabels[openTicket.status] || openTicket.status}
              </p>
              {messages.map((m) => (
                <div
                  key={m.id}
                  style={{
                    background: m.is_staff ? "var(--surface-2)" : "var(--border)",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    marginBottom: "8px",
                  }}
                >
                  <p style={{ margin: 0, fontSize: "12px", color: "var(--gold)" }}>
                    {m.is_staff ? "الأستاذ / الإدارة" : "أنت"}
                  </p>
                  <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
                  <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                    {new Date(m.created_at).toLocaleString("ar-EG")}
                  </p>
                </div>
              ))}
              {openTicket.status !== "closed" && (
                <>
                  <textarea
                    placeholder="اكتب ردك..."
                    value={reply}
                    onChange={(e) => setReply(e.target.value)}
                    rows={2}
                    style={{ width: "100%", marginBottom: "8px", padding: "8px" }}
                  />
                  <button onClick={sendReply} disabled={busy || !reply.trim()}>
                    {busy ? "جاري الإرسال..." : "رد"}
                  </button>
                </>
              )}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
