"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Challenge = {
  id: string;
  title: string;
  description: string | null;
  points: number;
  ends_at: string | null;
};

type Entry = {
  challenge_id: string;
  progress: number;
  completed: boolean;
};

export default function StudentChallenges() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Challenge[]>([]);
  const [entries, setEntries] = useState<Record<string, Entry>>({});
  const [message, setMessage] = useState("");
  const [userId, setUserId] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

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
      .from("challenges")
      .select("id, title, description, points, ends_at")
      .eq("active", true)
      .order("created_at", { ascending: false });
    if (error) {
      setSupported(false);
      setLoading(false);
      return;
    }
    setRows((data as Challenge[]) || []);
    const { data: ent } = await supabase
      .from("challenge_entries")
      .select("challenge_id, progress, completed")
      .eq("student_id", user.id);
    const map: Record<string, Entry> = {};
    ((ent as Entry[]) || []).forEach((e) => {
      map[e.challenge_id] = e;
    });
    setEntries(map);
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function joinChallenge(c: Challenge) {
    if (!userId) return;
    setBusyId(c.id);
    const supabase = client();
    const { error } = await supabase.from("challenge_entries").insert({
      challenge_id: c.id,
      student_id: userId,
    });
    if (error) setMessage("تعذر الاشتراك: " + error.message);
    else load();
    setBusyId(null);
  }

  async function bumpProgress(c: Challenge, delta: number) {
    if (!userId) return;
    const e = entries[c.id];
    if (!e) return;
    setBusyId(c.id);
    const supabase = client();
    const progress = Math.max(0, e.progress + delta);
    await supabase
      .from("challenge_entries")
      .update({ progress })
      .eq("challenge_id", c.id)
      .eq("student_id", userId);
    load();
    setBusyId(null);
  }

  async function markDone(c: Challenge) {
    if (!userId) return;
    setBusyId(c.id);
    const supabase = client();
    await supabase
      .from("challenge_entries")
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq("challenge_id", c.id)
      .eq("student_id", userId);
    load();
    setBusyId(null);
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>🏆 التحديات</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && !supported && <p>التحديات لسه بتتفعّل — جرّب بعد شوية.</p>}
        {message && <p role="alert">{message}</p>}

        {!loading && supported && rows.length === 0 && (
          <p>مفيش تحديات شغالة دلوقتي — استنى أستاذك يعمل واحد 💪</p>
        )}
        {!loading && supported &&
          rows.map((c) => {
            const e = entries[c.id];
            const expired = c.ends_at && new Date(c.ends_at) < new Date();
            return (
              <section key={c.id} className="course" style={{ display: "block" }}>
                <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px" }}>
                  <strong>{c.title}</strong>
                  <span style={{ color: "var(--gold)" }}>{c.points} نقطة</span>
                </div>
                {c.description && (
                  <p style={{ margin: "4px 0 0", fontSize: "14px" }}>{c.description}</p>
                )}
                {c.ends_at && (
                  <p style={{ margin: "4px 0 0", fontSize: "12px", color: expired ? "#ffb4b4" : "#8fa0b8" }}>
                    {expired ? "انتهى" : "آخر موعد: " + new Date(c.ends_at).toLocaleDateString("ar-EG")}
                  </p>
                )}
                <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap", alignItems: "center" }}>
                  {!e && !expired && (
                    <button onClick={() => joinChallenge(c)} disabled={busyId === c.id}>
                      اشترك في التحدي
                    </button>
                  )}
                  {e && !e.completed && (
                    <>
                      <span style={{ fontSize: "14px" }}>تقدمك: <strong>{e.progress}</strong></span>
                      <button onClick={() => bumpProgress(c, 1)} disabled={busyId === c.id} style={{ background: "#24395e" }}>
                        +1
                      </button>
                      <button onClick={() => markDone(c)} disabled={busyId === c.id}>
                        خلصته ✅
                      </button>
                    </>
                  )}
                  {e && e.completed && (
                    <span style={{ color: "#9fe6a0" }}>مكتمل 🎉 كسبت {c.points} نقطة</span>
                  )}
                </div>
              </section>
            );
          })}
      </div>
    </main>
  );
}
