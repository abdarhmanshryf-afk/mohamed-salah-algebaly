"use client";

import { useEffect, useState } from "react";
import { getBrowserClient } from "../../lib/supabase-browser";

type Group = {
  id: string;
  name: string;
  invite_code: string;
  created_at: string;
};

type Member = { student_id: string; full_name: string | null; joined_at: string };

export default function TeacherGroups() {
  const [supported, setSupported] = useState(true);
  const [loading, setLoading] = useState(true);
  const [groups, setGroups] = useState<Group[]>([]);
  const [name, setName] = useState("");
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
    if (!user) return;
    const { data, error } = await supabase
      .from("study_groups")
      .select("id, name, invite_code, created_at")
      .order("created_at", { ascending: false });
    if (error) {
      setSupported(false);
    } else {
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

  async function createGroup() {
    if (!name.trim()) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    const { error } = await supabase
      .from("study_groups")
      .insert({ name: name.trim(), teacher_id: user!.id });
    if (error) setMessage("تعذر إنشاء المجموعة: " + error.message);
    else setName("");
    setBusy(false);
    load();
  }

  async function removeGroup(id: string) {
    if (!window.confirm("متأكد إنك عايز تمسح المجموعة دي؟")) return;
    const supabase = client();
    const { error } = await supabase.from("study_groups").delete().eq("id", id);
    if (error) setMessage("تعذر المسح: " + error.message);
    else load();
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
    <main className="subpage">
      <h1>👥 المجموعات</h1>
      <p style={{ color: "var(--text-muted)" }}>
        اعمل مجموعة لطلابك وابعتلهم كود الدعوة — هيدخلوا بيه من صفحتهم.
      </p>
      {loading && <p>جاري التحميل...</p>}
      {!loading && !supported && (
        <p>
          المجموعات لسه مش مفعّلة — شغّل سكريبت <code>phase2-features.sql</code> في SQL Editor.
        </p>
      )}
      {message && <p role="alert">{message}</p>}

      {!loading && supported && (
        <>
          <section className="course" style={{ display: "block" }}>
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
              <input
                type="text"
                placeholder="اسم المجموعة (مثال: مجموعة السبت)"
                value={name}
                onChange={(e) => setName(e.target.value)}
                style={{ flex: 1, padding: "8px" }}
              />
              <button onClick={createGroup} disabled={busy || !name.trim()}>
                {busy ? "..." : "إنشاء"}
              </button>
            </div>
          </section>
          {groups.length === 0 && <p>مفيش مجموعات لسه.</p>}
          {groups.map((g) => (
            <section key={g.id} className="course" style={{ display: "block" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
                <strong>{g.name}</strong>
                <span
                  style={{
                    background: "var(--border)",
                    borderRadius: "6px",
                    padding: "4px 10px",
                    fontFamily: "monospace",
                    color: "var(--gold)",
                  }}
                >
                  كود الدعوة: {g.invite_code}
                </span>
              </div>
              <div style={{ display: "flex", gap: "8px", marginTop: "8px", flexWrap: "wrap" }}>
                <button onClick={() => showMembers(g)} style={{ background: "var(--border)" }}>
                  الأعضاء
                </button>
                <button onClick={() => removeGroup(g.id)} style={{ background: "var(--error-bg)" }}>
                  مسح
                </button>
              </div>
              {membersOf === g.id && (
                <div style={{ marginTop: "8px" }}>
                  {members.length === 0 && (
                    <p style={{ color: "var(--text-muted)", fontSize: "14px" }}>مفيش أعضاء لسه — ابعت الكود لطلابك.</p>
                  )}
                  {members.map((m) => (
                    <p key={m.student_id} style={{ margin: "4px 0", fontSize: "14px" }}>
                      • {m.full_name || "طالب"} — انضم {new Date(m.joined_at).toLocaleDateString("ar-EG")}
                    </p>
                  ))}
                </div>
              )}
            </section>
          ))}
        </>
      )}
    </main>
  );
}
