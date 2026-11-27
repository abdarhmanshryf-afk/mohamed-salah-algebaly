"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";

type Group = {
  id: string;
  name: string;
  invite_code: string;
};

type Member = { student_id: string; full_name: string | null; joined_at: string };

export default function StudentGroups() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [membersOf, setMembersOf] = useState<string | null>(null);
  const [members, setMembers] = useState<Member[]>([]);

  function client() {
    return getBrowserClient();
  }

  async function load() {
    try {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }
    const { data, error } = await supabase
      .from("study_groups")
      .select("id, name, invite_code");
    if (error) {
      setSupported(false);
    } else {
      // RLS بترجع بس المجموعات اللي الطالب عضو فيها
      setGroups((data as Group[]) || []);
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

  async function join() {
    if (!code.trim()) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const { data, error } = await supabase.rpc("join_group_by_code", {
      p_code: code.trim(),
    });
    if (error) {
      setMessage("حصلت مشكلة — جرّب تاني.");
    } else if (!data) {
      setMessage("الكود ده غلط — اتأكد منه عند أستاذك.");
    } else {
      setMessage("");
      setCode("");
      alert("انضميت لمجموعة " + data + " ✅");
    }
    setBusy(false);
    load();
  }

  async function showMembers(g: Group) {
    const supabase = client();
    setMembersOf(g.id);
    setMembers([]);
    const { data, error } = await supabase.rpc("group_members_with_names", {
      p_group_id: g.id,
    });
    if (!error) setMembers((data as Member[]) || []);
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>👥 مجموعاتي</h1>
        {loading && <p>جاري التحميل...</p>}
        {!loading && !supported && (
          <p>المجموعات لسه بتتفعّل — جرّب بعد شوية.</p>
        )}
        {message && <p role="alert">{message}</p>}

        {!loading && supported && (
          <>
            <section className="course" style={{ display: "block" }}>
              <h3 style={{ marginTop: 0, color: "var(--gold)" }}>عندك كود دعوة؟</h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  type="text"
                  placeholder="اكتب الكود هنا"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  style={{ flex: 1, padding: "8px", fontFamily: "monospace" }}
                />
                <button onClick={join} disabled={busy || !code.trim()}>
                  {busy ? "..." : "انضم"}
                </button>
              </div>
            </section>
            {groups.length === 0 && <p>لسه مش عضو في أي مجموعة.</p>}
            {groups.map((g) => (
              <section key={g.id} className="course" style={{ display: "block" }}>
                <strong>{g.name}</strong>
                <div style={{ marginTop: "8px" }}>
                  <button onClick={() => showMembers(g)} style={{ background: "var(--border)" }}>
                    زمايلك في المجموعة
                  </button>
                </div>
                {membersOf === g.id && (
                  <div style={{ marginTop: "8px" }}>
                    {members.map((m) => (
                      <p key={m.student_id} style={{ margin: "4px 0", fontSize: "14px" }}>
                        • {m.full_name || "طالب"}
                      </p>
                    ))}
                  </div>
                )}
              </section>
            ))}
          </>
        )}
      </div>
    </main>
  );
}
