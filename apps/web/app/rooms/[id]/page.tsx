"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { createBrowserClient } from "@supabase/ssr";

const STUDY_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

type RoomData = {
  id: string;
  name: string;
  created_by: string;
  phase: string;
  phase_started_at: string;
};

type Member = {
  student_id: string;
  last_seen_at: string;
  minutes_this_week: number;
  profiles: { full_name: string | null } | null;
};

export default function RoomPage() {
  const { id } = useParams() as { id: string };
  const [room, setRoom] = useState<RoomData | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [loading, setLoading] = useState(true);
  const [notReady, setNotReady] = useState(false);
  const [joined, setJoined] = useState(false);
  const [uid, setUid] = useState("");
  const [tick, setTick] = useState(0);
  const advancingRef = useRef(false);

  const client = useCallback(
    () =>
      createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      ),
    []
  );

  const phaseLen = room?.phase === "study" ? STUDY_SECONDS : BREAK_SECONDS;
  const elapsed = room
    ? Math.floor((Date.now() - new Date(room.phase_started_at).getTime()) / 1000)
    : 0;
  const remaining = Math.max(0, phaseLen - elapsed);
  const mm = Math.floor(remaining / 60);
  const ss = (remaining % 60).toString().padStart(2, "0");

  async function refresh() {
    const supabase = client();
    const { data: roomData, error } = await supabase
      .from("study_rooms")
      .select("id, name, created_by, phase, phase_started_at")
      .eq("id", id)
      .single();
    if (error) {
      setNotReady(true);
      setLoading(false);
      return;
    }
    setRoom(roomData as RoomData);
    const { data: memberData } = await supabase
      .from("study_room_members")
      .select("student_id, last_seen_at, minutes_this_week, profiles(full_name)")
      .eq("room_id", id);
    setMembers((memberData as unknown as Member[]) || []);
    setLoading(false);
  }

  async function maybeAdvancePhase(r: RoomData) {
    const len = r.phase === "study" ? STUDY_SECONDS : BREAK_SECONDS;
    const e = Math.floor(
      (Date.now() - new Date(r.phase_started_at).getTime()) / 1000
    );
    if (e < len || advancingRef.current) return;
    advancingRef.current = true;
    const supabase = client();
    const nextPhase = r.phase === "study" ? "break" : "study";
    await supabase
      .from("study_rooms")
      .update({ phase: nextPhase, phase_started_at: new Date().toISOString() })
      .eq("id", r.id)
      .eq("phase", r.phase);
    advancingRef.current = false;
    refresh();
  }

  useEffect(() => {
    async function init() {
      const supabase = client();
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        window.location.href = "/login";
        return;
      }
      setUid(user.id);
      await supabase
        .from("study_room_members")
        .upsert(
          { room_id: id, student_id: user.id },
          { onConflict: "room_id,student_id" }
        );
      setJoined(true);
      await refresh();
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Heartbeat + polling: cheap 30s cadence, no websockets.
  useEffect(() => {
    if (!joined || !uid) return;
    const hb = setInterval(async () => {
      const supabase = client();
      await supabase
        .from("study_room_members")
        .update({
          last_seen_at: new Date().toISOString(),
        })
        .eq("room_id", id)
        .eq("student_id", uid);
      refresh();
    }, 30000);
    return () => clearInterval(hb);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, uid, id]);

  // Study-minute accrual: +1 minute per minute while in study phase.
  useEffect(() => {
    if (!joined || !uid || !room) return;
    const acc = setInterval(async () => {
      if (room.phase !== "study") return;
      const supabase = client();
      const mine = members.find((m) => m.student_id === uid);
      await supabase
        .from("study_room_members")
        .update({ minutes_this_week: (mine?.minutes_this_week || 0) + 1 })
        .eq("room_id", id)
        .eq("student_id", uid);
    }, 60000);
    return () => clearInterval(acc);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [joined, uid, id, room?.phase, members]);

  // Local clock tick + phase advancement.
  useEffect(() => {
    const t = setInterval(() => {
      setTick((x) => x + 1);
      if (room) maybeAdvancePhase(room);
    }, 1000);
    return () => clearInterval(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [room]);

  const onlineCutoff = Date.now() - 90 * 1000;

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage">
        <a href="/rooms">← الغرف</a>
        {loading && <p>جاري تحميل الغرفة...</p>}
        {notReady && <p>الغرفة مش متاحة — لسه محتاجة سكريبت phase1-features.sql يتشغّل.</p>}
        {room && (
          <>
            <h1>📚 {room.name}</h1>
            <section
              className="course"
              style={{ display: "block", textAlign: "center" }}
            >
              <p style={{ margin: 0, color: "var(--text-muted)" }}>
                {room.phase === "study" ? "📖 وقت المذاكرة" : "☕ وقت الراحة"}
              </p>
              <p
                style={{
                  fontSize: "56px",
                  fontWeight: "bold",
                  color: room.phase === "study" ? "var(--gold)" : "#2e9e5b",
                  margin: "8px 0",
                  direction: "ltr",
                }}
              >
                {mm}:{ss}
              </p>
              <p style={{ margin: 0, fontSize: "13px", color: "var(--text-muted)" }}>
                {room.phase === "study"
                  ? "ركز في مذاكرتك — الراحة جاية"
                  : "خد نفسك — المذاكرة هترجع"}
              </p>
            </section>

            <section className="course" style={{ display: "block" }}>
              <h3 style={{ margin: "0 0 8px", color: "var(--gold)" }}>
                👥 الموجودين ({members.length})
              </h3>
              {members.map((m) => {
                const online =
                  new Date(m.last_seen_at).getTime() > onlineCutoff;
                return (
                  <p key={m.student_id} style={{ margin: "6px 0 0" }}>
                    <span style={{ color: online ? "#2e9e5b" : "var(--text-dim)" }}>
                      ●
                    </span>{" "}
                    {m.profiles?.full_name || "طالب"}
                    {m.student_id === uid && " (أنت)"} — {m.minutes_this_week}{" "}
                    دقيقة الأسبوع ده
                  </p>
                );
              })}
            </section>
          </>
        )}
      </div>
    </main>
  );
}
