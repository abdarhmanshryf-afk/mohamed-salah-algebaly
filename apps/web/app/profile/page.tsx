"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

const roleLabels: Record<string, string> = {
  student: "طالب",
  teacher: "مدرس",
  admin: "أدمن",
};

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [role, setRole] = useState("");
  const [createdAt, setCreatedAt] = useState("");
  const [editName, setEditName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  useEffect(() => {
    async function load() {
      const supabase = client();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setEmail(user.email || "");
      const { data: p } = await supabase
        .from("profiles")
        .select("full_name, phone, role, created_at")
        .eq("id", user.id)
        .single();
      if (p) {
        setName(p.full_name || "");
        setEditName(p.full_name || "");
        setPhone(p.phone || "");
        setRole(p.role || "student");
        setCreatedAt(p.created_at || "");
      }
      setLoading(false);
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function saveName() {
    if (!editName.trim()) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("profiles")
      .update({ full_name: editName.trim() })
      .eq("id", user!.id);
    if (error) {
      setMessage("تعذر حفظ الاسم: " + error.message);
    } else {
      setName(editName.trim());
      setMessage("تم حفظ الاسم ✅");
    }
    setBusy(false);
  }

  async function logout() {
    const supabase = client();
    await supabase.auth.signOut();
    window.location.href = "/";
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>👤 حسابي</h1>
        {loading && <p>جاري التحميل...</p>}
        {message && <p role="alert">{message}</p>}

        {!loading && (
          <>
            <section className="course" style={{ display: "block" }}>
              <p style={{ margin: 0, fontSize: "14px", color: "var(--text-muted)" }}>الاسم</p>
              <div style={{ display: "flex", gap: "8px", marginTop: "6px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  style={{ flex: 1, padding: "10px" }}
                />
                <button onClick={saveName} disabled={busy || !editName.trim() || editName.trim() === name}>
                  {busy ? "..." : "حفظ"}
                </button>
              </div>
            </section>
            <section className="course" style={{ display: "block" }}>
              <p style={{ margin: 0 }}>
                <strong>الإيميل:</strong> {email || "—"}
              </p>
              {phone && (
                <p style={{ margin: "8px 0 0" }}>
                  <strong>الموبايل:</strong> {phone}
                </p>
              )}
              <p style={{ margin: "8px 0 0" }}>
                <strong>النوع:</strong> {roleLabels[role] || role}
              </p>
              {createdAt && (
                <p style={{ margin: "8px 0 0" }}>
                  <strong>عضو من:</strong>{" "}
                  {new Date(createdAt).toLocaleDateString("ar-EG")}
                </p>
              )}
            </section>
            <section className="course" style={{ display: "block" }}>
              <p style={{ margin: 0, fontSize: "14px" }}>
                <a href="/forgot-password" style={{ color: "var(--gold)" }}>
                  🔑 تغيير كلمة السر
                </a>
              </p>
              <p style={{ margin: "10px 0 0", fontSize: "14px" }}>
                <a href="/support" style={{ color: "var(--gold)" }}>
                  🛟 تواصل مع الدعم
                </a>
              </p>
            </section>
            <button onClick={logout} style={{ background: "var(--error-bg)", marginTop: "10px" }}>
              تسجيل الخروج
            </button>
          </>
        )}
      </div>
    </main>
  );
}
