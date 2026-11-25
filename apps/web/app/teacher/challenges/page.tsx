"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  ends_at: string | null;
  active: boolean;
};

export default function TeacherChallenges() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Challenge[]>([]);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [points, setPoints] = useState("10");
  const [endsAt, setEndsAt] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function load() {
    const supabase = client();
    const { data, error } = await supabase
      .from("challenges")
      .select("id, title, description, points, ends_at, active")
      .order("created_at", { ascending: false });
    if (error) setSupported(false);
    else setRows((data as Challenge[]) || []);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function create() {
    if (!title.trim()) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase.from("challenges").insert({
      title: title.trim(),
      description: description.trim() || null,
      points: parseInt(points, 10) || 10,
      ends_at: endsAt ? new Date(endsAt + "T23:59:59").toISOString() : null,
      created_by: user!.id,
    });
    if (error) setMessage("تعذر إنشاء التحدي: " + error.message);
    else {
      setTitle("");
      setDescription("");
      setEndsAt("");
    }
    setBusy(false);
    load();
  }

  async function toggle(c: Challenge) {
    const supabase = client();
    await supabase.from("challenges").update({ active: !c.active }).eq("id", c.id);
    load();
  }

  async function remove(id: string) {
    if (!window.confirm("تمسح التحدي ده؟")) return;
    const supabase = client();
    await supabase.from("challenges").delete().eq("id", id);
    load();
  }

  return (
    <main className="subpage">
      <h1>🏆 التحديات</h1>
      <p style={{ color: "var(--text-muted)" }}>
        اعمل تحديات لطلابك بنقاط — كل واحد بيشارك وبيسجّل تقدمه.
      </p>
      {loading && <p>جاري التحميل...</p>}
      {!loading && !supported && (
        <p>
          التحديات لسه مش مفعّلة — شغّل سكريبت <code>phase2-features.sql</code> في SQL Editor.
        </p>
      )}
      {message && <p role="alert">{message}</p>}

      {!loading && supported && (
        <>
          <section className="course" style={{ display: "block" }}>
            <h3 style={{ marginTop: 0, color: "var(--gold)" }}>تحدي جديد</h3>
            <input
              type="text"
              placeholder="عنوان التحدي (مثال: خلص 5 دروس الأسبوع ده)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              style={{ width: "100%", marginBottom: "8px", padding: "8px" }}
            />
            <textarea
              placeholder="تفاصيل التحدي (اختياري)"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              style={{ width: "100%", marginBottom: "8px", padding: "8px" }}
            />
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              <label style={{ fontSize: "14px" }}>
                النقاط:{" "}
                <input
                  type="number"
                  min="1"
                  value={points}
                  onChange={(e) => setPoints(e.target.value)}
                  style={{ width: "70px", padding: "6px" }}
                />
              </label>
              <label style={{ fontSize: "14px" }}>
                آخر موعد:{" "}
                <input
                  type="date"
                  value={endsAt}
                  onChange={(e) => setEndsAt(e.target.value)}
                  style={{ padding: "6px" }}
                />
              </label>
              <button onClick={create} disabled={busy || !title.trim()}>
                {busy ? "..." : "إنشاء التحدي"}
              </button>
            </div>
          </section>
          {rows.length === 0 && <p>مفيش تحديات لسه.</p>}
          {rows.map((c) => (
            <section key={c.id} className="course" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                <strong>{c.title}</strong>
                <span style={{ color: "var(--gold)" }}>{c.points} نقطة</span>
              </div>
              {c.description && <p style={{ margin: "4px 0 0", fontSize: "14px" }}>{c.description}</p>}
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: "var(--text-muted)" }}>
                {c.active ? "شغال ✅" : "متوقف ⏸"}
                {c.ends_at && " — آخر موعد: " + new Date(c.ends_at).toLocaleDateString("ar-EG")}
              </p>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
                <button onClick={() => toggle(c)} style={{ background: "var(--border)" }}>
                  {c.active ? "إيقاف" : "تشغيل"}
                </button>
                <button onClick={() => remove(c.id)} style={{ background: "var(--error-bg)" }}>
                  مسح
                </button>
              </div>
            </section>
          ))}
        </>
      )}
    </main>
  );
}
