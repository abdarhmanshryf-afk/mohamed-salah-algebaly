"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../../lib/supabase-browser";

type Ticket = {
  id: string;
  subject: string;
  status: string;
  updated_at: string;
  profiles: { full_name: string | null } | null;
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

export default function TeacherTickets() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [tickets, setTickets] = useState<Ticket[]>([]);
  const [openTicket, setOpenTicket] = useState<Ticket | null>(null);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [reply, setReply] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);

  function client() {
    return getBrowserClient();
  }

  async function load() {
    try {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) setUserId(user.id);
    const { data, error } = await supabase
      .from("support_tickets")
      .select("id, subject, status, updated_at, profiles(full_name)")
      .order("updated_at", { ascending: false })
      .limit(100);
    if (error) {
      setSupported(false);
    } else {
      setTickets((data as unknown as Ticket[]) || []);
    }
    setLoading(false);
    } catch {
      setMessage("حصل خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
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

  async function setStatus(status: string) {
    if (!openTicket) return;
    const supabase = client();
    await supabase
      .from("support_tickets")
      .update({ status, updated_at: new Date().toISOString() })
      .eq("id", openTicket.id);
    setOpenTicket({ ...openTicket, status });
    load();
  }

  async function sendReply() {
    if (!reply.trim() || !openTicket || !userId) return;
    setBusy(true);
    const supabase = client();
    const { error } = await supabase.from("ticket_messages").insert({
      ticket_id: openTicket.id,
      sender_id: userId,
      body: reply.trim(),
      is_staff: true,
    });
    if (!error) {
      await supabase
        .from("support_tickets")
        .update({ status: "answered", updated_at: new Date().toISOString() })
        .eq("id", openTicket.id);
      setReply("");
      setOpenTicket({ ...openTicket, status: "answered" });
      await openConversation({ ...openTicket, status: "answered" });
      load();
    } else {
      setMessage("تعذر إرسال الرد: " + error.message);
    }
    setBusy(false);
  }

  const openCount = tickets.filter((t) => t.status === "open").length;

  return (
    <main className="subpage">
      <h1>🛟 تذاكر الدعم {openCount > 0 && <>({openCount} مفتوحة)</>}</h1>
      {loading && <p>جاري التحميل...</p>}
      {!loading && !supported && (
        <p>
          التذاكر لسه مش مفعّلة — شغّل سكريبت <code>phase2-features.sql</code> في SQL Editor.
        </p>
      )}
      {message && <p role="alert">{message}</p>}

      {!loading && supported && !openTicket && (
        <>
          {tickets.length === 0 && <p>مفيش تذاكر لسه 🎉</p>}
          {tickets.map((t) => (
            <section
              key={t.id}
              className="course"
              style={{ display: "block", cursor: "pointer" }}
              onClick={() => openConversation(t)}
            >
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                <strong>{t.subject}</strong>
                <span style={{ color: t.status === "open" ? "var(--warning)" : "var(--text-muted)" }}>
                  {statusLabels[t.status] || t.status}
                </span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: "13px" }}>
                {t.profiles?.full_name || "طالب"}
              </p>
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
            ← رجوع
          </button>
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ marginTop: 0, color: "var(--gold)" }}>{openTicket.subject}</h3>
            <p style={{ fontSize: "12px", color: "var(--text-muted)", margin: "0 0 10px" }}>
              {openTicket.profiles?.full_name || "طالب"} — {statusLabels[openTicket.status] || openTicket.status}
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
                  {m.is_staff ? "أنت (الإدارة)" : "الطالب"}
                </p>
                <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{m.body}</p>
                <p style={{ margin: "4px 0 0", fontSize: "11px", color: "var(--text-muted)" }}>
                  {new Date(m.created_at).toLocaleString("ar-EG")}
                </p>
              </div>
            ))}
            <textarea
              placeholder="اكتب ردك للطالب..."
              value={reply}
              onChange={(e) => setReply(e.target.value)}
              rows={2}
              style={{ width: "100%", marginBottom: "8px", padding: "8px" }}
            />
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <button onClick={sendReply} disabled={busy || !reply.trim()}>
                {busy ? "جاري الإرسال..." : "رد"}
              </button>
              {openTicket.status !== "closed" ? (
                <button onClick={() => setStatus("closed")} style={{ background: "var(--surface-2)", color: "var(--text)" }}>
                  قفل التذكرة
                </button>
              ) : (
                <button onClick={() => setStatus("open")} style={{ background: "var(--surface-2)", color: "var(--text)" }}>
                  إعادة فتح
                </button>
              )}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
