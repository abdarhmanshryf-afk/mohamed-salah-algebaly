"use client";

import { useCallback, useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type CommentRow = {
  id: string;
  body: string;
  created_at: string;
  user_id: string;
};

type AuthorInfo = { full_name: string | null; role: string };

export default function LessonComments({
  lessonId,
  userId,
  isTeacher,
}: {
  lessonId: string;
  userId: string;
  isTeacher: boolean;
}) {
  const [comments, setComments] = useState<CommentRow[]>([]);
  const [authors, setAuthors] = useState<Record<string, AuthorInfo>>({});
  const [draft, setDraft] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [loaded, setLoaded] = useState(false);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  const load = useCallback(async () => {
    const { data, error } = await supabase
      .from("lesson_comments")
      .select("id, body, created_at, user_id")
      .eq("lesson_id", lessonId)
      .order("created_at", { ascending: true });

    if (error) {
      setMessage("مش قادرين نحمل النقاش دلوقتي.");
      setLoaded(true);
      return;
    }

    const rows = (data as CommentRow[]) || [];
    setComments(rows);

    const ids = Array.from(new Set(rows.map((c) => c.user_id)));
    if (ids.length > 0) {
      const { data: authorRows } = await supabase
        .from("comment_authors")
        .select("id, full_name, role")
        .in("id", ids);
      const map: Record<string, AuthorInfo> = {};
      (authorRows || []).forEach((a: { id: string } & AuthorInfo) => {
        map[a.id] = { full_name: a.full_name, role: a.role };
      });
      setAuthors(map);
    } else {
      setAuthors({});
    }
    setLoaded(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId]);

  useEffect(() => {
    load();
  }, [load]);

  async function postComment() {
    const body = draft.trim();
    if (!body) return;
    setBusy(true);
    setMessage("");
    const { error } = await supabase
      .from("lesson_comments")
      .insert({ lesson_id: lessonId, user_id: userId, body });
    if (error) {
      setMessage("التعليق ما اتبعتش، جرب تاني.");
    } else {
      setDraft("");
      await load();
    }
    setBusy(false);
  }

  async function removeComment(id: string) {
    const { error } = await supabase
      .from("lesson_comments")
      .delete()
      .eq("id", id);
    if (!error) {
      setComments((prev) => prev.filter((c) => c.id !== id));
    }
  }

  return (
    <div
      style={{
        marginTop: "12px",
        borderTop: "1px solid #e0e4ea",
        paddingTop: "12px",
      }}
    >
      {message && <p role="alert">{message}</p>}

      {!loaded && <p>جاري تحميل النقاش...</p>}

      {loaded && comments.length === 0 && (
        <p style={{ color: "var(--muted)" }}>
          مفيش أسئلة لسه، اسأل أول سؤال 👇
        </p>
      )}

      {comments.map((c) => {
        const author = authors[c.user_id];
        const name =
          author?.full_name || (c.user_id === userId ? "أنت" : "طالب");
        const teacherBadge = author?.role === "teacher";
        const canDelete = isTeacher || c.user_id === userId;
        return (
          <div
            key={c.id}
            style={{
              background: teacherBadge ? "#fff8e8" : "#f4f6fa",
              borderRadius: "10px",
              padding: "10px 14px",
              marginTop: "8px",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                gap: "8px",
              }}
            >
              <strong style={{ color: "var(--navy)", fontSize: "14px" }}>
                {name}
                {teacherBadge && (
                  <span
                    style={{
                      background: "var(--gold)",
                      color: "#17233a",
                      borderRadius: "6px",
                      padding: "1px 8px",
                      fontSize: "12px",
                      marginInlineStart: "6px",
                    }}
                  >
                    الأستاذ
                  </span>
                )}
              </strong>
              <span style={{ color: "var(--muted)", fontSize: "12px" }}>
                {new Date(c.created_at).toLocaleDateString("ar-EG", {
                  day: "numeric",
                  month: "long",
                })}
                {canDelete && (
                  <button
                    onClick={() => removeComment(c.id)}
                    style={{
                      border: 0,
                      background: "none",
                      color: "#b00020",
                      cursor: "pointer",
                      fontSize: "12px",
                      marginInlineStart: "8px",
                    }}
                  >
                    حذف
                  </button>
                )}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", whiteSpace: "pre-wrap" }}>
              {c.body}
            </p>
          </div>
        );
      })}

      <div style={{ display: "flex", gap: "8px", marginTop: "12px" }}>
        <input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="اكتب سؤالك أو تعليقك..."
          onKeyDown={(e) => {
            if (e.key === "Enter") postComment();
          }}
          style={{
            flex: 1,
            padding: "10px 14px",
            borderRadius: "10px",
            border: "1px solid #d7dce4",
            fontFamily: "inherit",
          }}
        />
        <button
          onClick={postComment}
          disabled={busy || !draft.trim()}
          style={{
            padding: "10px 18px",
            border: 0,
            borderRadius: "10px",
            background: "var(--navy)",
            color: "white",
            fontWeight: "bold",
            cursor: "pointer",
          }}
        >
          {busy ? "..." : "أرسل"}
        </button>
      </div>
    </div>
  );
}
