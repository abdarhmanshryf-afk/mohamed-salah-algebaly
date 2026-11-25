"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Room = {
  id: string;
  name: string;
  created_by: string;
  phase: string;
  member_count?: number;
};

type HonorRow = { name: string; minutes: number };

export default function RoomsPage() {
  const [rooms, setRooms] = useState<Room[]>([]);
  const [honor, setHonor] = useState<HonorRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [newName, setNewName] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  async function load() {
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) {
      window.location.href = "/login";
      return;
    }

    const roomsRes = await supabase
      .from("study_rooms")
      .select("id, name, created_by, phase, study_room_members(count)")
      .order("created_at", { ascending: false })
      .limit(20);
    if (roomsRes.error) {
      setNotReady(true);
      setLoading(false);
      return;
    }
    setRooms(
      ((roomsRes.data || []) as unknown as (Room & {
        study_room_members: { count: number }[];
      })[]).map((r) => ({
        ...r,
        member_count: r.study_room_members?.[0]?.count || 0,
      }))
    );

    const membersRes = await supabase
      .from("study_room_members")
      .select("student_id, minutes_this_week, profiles(full_name)");
    if (!membersRes.error) {
      const agg: Record<string, HonorRow> = {};
      (
        (membersRes.data || []) as unknown as {
          student_id: string;
          minutes_this_week: number;
          profiles: { full_name: string | null } | null;
        }[]
      ).forEach((m) => {
        if (!agg[m.student_id]) {
          agg[m.student_id] = {
            name: m.profiles?.full_name || "طالب",
            minutes: 0,
          };
        }
        agg[m.student_id].minutes += m.minutes_this_week;
      });
      const top = Object.values(agg)
        .filter((r) => r.minutes > 0)
        .sort((a, b) => b.minutes - a.minutes)
        .slice(0, 5);
      setHonor(top);
    }
    setLoading(false);
  }

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function createRoom() {
    if (!newName.trim()) return;
    setBusy(true);
    setMessage("");
    const supabase = client();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase
      .from("study_rooms")
      .insert({ name: newName.trim(), created_by: user.id })
      .select("id")
      .single();
    if (error) {
      setMessage("حصل خطأ في إنشاء الغرفة، جرب تاني.");
      setBusy(false);
      return;
    }
    await supabase
      .from("study_room_members")
      .insert({ room_id: data.id, student_id: user.id });
    window.location.href = `/rooms/${data.id}`;
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <h1>📚 غرف المذاكرة</h1>
        <p style={{ color: "var(--text-muted)" }}>
          اذاكر مع زمايلك: مؤقت 25 دقيقة مذاكرة + 5 راحة، من غير شات — بس حضور
          وتشجيع.
        </p>

        {loading && <p>جاري التحميل...</p>}
        {notReady && <p>غرف المذاكرة لسه محتاجة سكريبت phase1-features.sql يتشغّل.</p>}

        {!loading && !notReady && (
          <>
            <section className="course" style={{ display: "block" }}>
              <h3 style={{ margin: "0 0 8px", color: "var(--gold)" }}>
                ➕ غرفة جديدة
              </h3>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="اسم الغرفة (مثال: مذاكرة النحو)"
                  style={{
                    flex: 1,
                    minWidth: "180px",
                    padding: "10px",
                    borderRadius: "8px",
                    border: "1px solid var(--border)",
                    background: "var(--bg)",
                    color: "var(--text)",
                  }}
                />
                <button
                  onClick={createRoom}
                  disabled={busy || !newName.trim()}
                  style={{
                    padding: "10px 20px",
                    border: "none",
                    borderRadius: "10px",
                    background: "var(--gold)",
                    color: "var(--gold-ink)",
                    fontWeight: "bold",
                    cursor: "pointer",
                  }}
                >
                  {busy ? "جاري الإنشاء..." : "اعمل الغرفة"}
                </button>
              </div>
              {message && <p role="alert">{message}</p>}
            </section>

            {honor.length > 0 && (
              <section className="course" style={{ display: "block" }}>
                <h3 style={{ margin: "0 0 8px", color: "var(--gold)" }}>
                  🏆 لوحة الشرف — دقائق المذاكرة الأسبوع ده
                </h3>
                {honor.map((h, i) => (
                  <p key={i} style={{ margin: "6px 0 0" }}>
                    {i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : "•"}{" "}
                    {h.name} — {h.minutes} دقيقة
                  </p>
                ))}
              </section>
            )}

            {rooms.length === 0 ? (
              <p>مفيش غرف مفتوحة دلوقتي — اعمل أول غرفة! 🌱</p>
            ) : (
              rooms.map((r) => (
                <section key={r.id} className="course">
                  <div>
                    <h3 style={{ margin: 0, color: "var(--gold)" }}>{r.name}</h3>
                    <p style={{ margin: "6px 0 0" }}>
                      {r.member_count} موجودين —{" "}
                      {r.phase === "study" ? "📖 مذاكرة دلوقتي" : "☕ راحة"}
                    </p>
                  </div>
                  <a
                    href={`/rooms/${r.id}`}
                    className="cta"
                    style={{ marginTop: 0, padding: "10px 24px", fontSize: 15 }}
                  >
                    ادخل الغرفة
                  </a>
                </section>
              ))
            )}
          </>
        )}
      </div>
    </main>
  );
}
