"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type CourseRow = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration_days: number | null;
  is_published: boolean;
  created_at: string;
  teacher_id: string | null;
};

type EditState = {
  title: string;
  description: string;
  price: string;
  duration_days: string;
  teacher_id: string;
};

type TeacherOpt = { id: string; full_name: string | null };

export default function AdminCourses() {
  const [courses, setCourses] = useState<CourseRow[]>([]);
  const [lessonCounts, setLessonCounts] = useState<Record<string, number>>({});
  const [activeCounts, setActiveCounts] = useState<Record<string, number>>({});
  const [pendingCounts, setPendingCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [teachers, setTeachers] = useState<TeacherOpt[]>([]);
  const [teacherSupported, setTeacherSupported] = useState(true);
  const [edit, setEdit] = useState<EditState>({
    title: "",
    description: "",
    price: "0",
    duration_days: "",
    teacher_id: "",
  });

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function load() {
    const supabase = client();
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let { data, error }: { data: any[] | null; error: any } = await supabase
      .from("courses")
      .select("id, title, description, price, duration_days, is_published, created_at, teacher_id")
      .order("created_at", { ascending: false });
    if (error && /teacher_id/i.test(error.message)) {
      // عمود تعدد المدرسين لسه ما اتعملش (سكريبت المرحلة 2)
      setTeacherSupported(false);
      const fallback = await supabase
        .from("courses")
        .select("id, title, description, price, duration_days, is_published, created_at")
        .order("created_at", { ascending: false });
      data = fallback.data;
      error = fallback.error;
    } else if (!error) {
      setTeacherSupported(true);
      const { data: t } = await supabase
        .from("profiles")
        .select("id, full_name")
        .eq("role", "teacher")
        .order("full_name");
      setTeachers((t as TeacherOpt[]) || []);
    }
    if (error) {
      setMessage("خطأ تحميل الكورسات: " + error.message);
      setLoading(false);
      return;
    }
    setCourses(
      (((data as unknown) as Omit<CourseRow, "teacher_id">[]) || []).map((c) => ({
        ...c,
        teacher_id: (c as CourseRow).teacher_id ?? null,
      }))
    );

    const [{ data: lessons }, { data: enrolls }] = await Promise.all([
      supabase.from("lessons").select("course_id"),
      supabase.from("enrollments").select("course_id, status"),
    ]);
    const lc: Record<string, number> = {};
    (lessons || []).forEach((l: { course_id: string }) => {
      lc[l.course_id] = (lc[l.course_id] || 0) + 1;
    });
    const ac: Record<string, number> = {};
    const pc: Record<string, number> = {};
    (enrolls || []).forEach((e: { course_id: string; status: string }) => {
      if (e.status === "active") ac[e.course_id] = (ac[e.course_id] || 0) + 1;
      if (e.status === "pending") pc[e.course_id] = (pc[e.course_id] || 0) + 1;
    });
    setLessonCounts(lc);
    setActiveCounts(ac);
    setPendingCounts(pc);
    setLoading(false);
  }

  useEffect(() => {
    load();
  }, []);

  async function togglePublish(c: CourseRow) {
    setBusyId(c.id);
    setMessage("");
    const supabase = client();
    const { error } = await supabase
      .from("courses")
      .update({ is_published: !c.is_published })
      .eq("id", c.id);
    if (error) setMessage("تعذر تغيير حالة النشر: " + error.message);
    else await load();
    setBusyId(null);
  }

  function startEdit(c: CourseRow) {
    setEditingId(c.id);
    setEdit({
      title: c.title,
      description: c.description || "",
      price: String(c.price),
      duration_days: c.duration_days ? String(c.duration_days) : "",
      teacher_id: c.teacher_id || "",
    });
  }

  async function saveEdit(id: string) {
    setBusyId(id);
    setMessage("");
    const supabase = client();
    const payload: Record<string, unknown> = {
      title: edit.title.trim(),
      description: edit.description.trim() || null,
      price: Number(edit.price) || 0,
      duration_days: edit.duration_days ? Number(edit.duration_days) : null,
    };
    if (teacherSupported) payload.teacher_id = edit.teacher_id || null;
    let { error } = await supabase.from("courses").update(payload).eq("id", id);
    if (error && /teacher_id/i.test(error.message)) {
      delete payload.teacher_id;
      setTeacherSupported(false);
      const fallback = await supabase.from("courses").update(payload).eq("id", id);
      error = fallback.error;
    }
    if (error) {
      setMessage("تعذر حفظ التعديلات: " + error.message);
    } else {
      setEditingId(null);
      await load();
    }
    setBusyId(null);
  }

  async function deleteCourse(c: CourseRow) {
    if (
      !window.confirm(
        `حذف كورس "${c.title}" نهائيًا مع كل اشتراكاته ودروسه؟ لا يمكن التراجع.\n\nلو فيه بيانات مرتبطة (امتحانات/إعلانات) الحذف هيفشل — ساعتها الأفضل إلغاء النشر.`
      )
    ) {
      return;
    }
    setBusyId(c.id);
    setMessage("");
    const supabase = client();
    // Best-effort cascade: enrollments then lessons then the course itself.
    await supabase.from("enrollments").delete().eq("course_id", c.id);
    await supabase.from("lessons").delete().eq("course_id", c.id);
    const { error } = await supabase.from("courses").delete().eq("id", c.id);
    if (error) {
      setMessage(
        "تعذر حذف الكورس — فيه بيانات مرتبطة بيه (امتحانات أو إعلانات مثلًا). ممكن تلغي نشره بدل الحذف. (" +
          error.message +
          ")"
      );
      await load();
    } else {
      await load();
    }
    setBusyId(null);
  }

  if (loading) {
    return <main className="subpage">جاري تحميل الكورسات...</main>;
  }

  const inputStyle: React.CSSProperties = {
    width: "100%",
    marginTop: "6px",
  };

  return (
    <main className="subpage" style={{ maxWidth: "1000px" }}>
      <h1>إدارة الكورسات</h1>
      <p>تعديل، نشر/إيقاف نشر، أو حذف أي كورس على المنصة.</p>

      {message && <p role="alert">{message}</p>}

      {courses.map((c) => (
        <section key={c.id} className="card" style={{ marginTop: "16px" }}>
          {editingId === c.id ? (
            <div>
              <label>
                العنوان
                <input
                  style={inputStyle}
                  value={edit.title}
                  onChange={(e) => setEdit({ ...edit, title: e.target.value })}
                />
              </label>
              <label style={{ display: "block", marginTop: "12px" }}>
                الوصف
                <textarea
                  style={{ ...inputStyle, minHeight: "70px" }}
                  value={edit.description}
                  onChange={(e) =>
                    setEdit({ ...edit, description: e.target.value })
                  }
                />
              </label>
              <div style={{ display: "flex", gap: "12px", marginTop: "12px", flexWrap: "wrap" }}>
                <label style={{ flex: 1, minWidth: "120px" }}>
                  السعر (جنيه)
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    value={edit.price}
                    onChange={(e) => setEdit({ ...edit, price: e.target.value })}
                  />
                </label>
                <label style={{ flex: 1, minWidth: "120px" }}>
                  مدة الاشتراك (يوم)
                  <input
                    style={inputStyle}
                    type="number"
                    min="0"
                    value={edit.duration_days}
                    onChange={(e) =>
                      setEdit({ ...edit, duration_days: e.target.value })
                    }
                  />
                </label>
              </div>
              {teacherSupported && (
                <label style={{ display: "block", marginTop: "12px" }}>
                  المدرس المسؤول عن الكورس
                  <select
                    style={inputStyle}
                    value={edit.teacher_id}
                    onChange={(e) =>
                      setEdit({ ...edit, teacher_id: e.target.value })
                    }
                  >
                    <option value="">بدون تعيين</option>
                    {teachers.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.full_name || "مدرس بدون اسم"}
                      </option>
                    ))}
                  </select>
                </label>
              )}
              <div style={{ display: "flex", gap: "10px", marginTop: "16px" }}>
                <button onClick={() => saveEdit(c.id)} disabled={busyId === c.id}>
                  حفظ
                </button>
                <button
                  onClick={() => setEditingId(null)}
                  style={{
                    background: "transparent",
                    border: "1px solid var(--border)",
                    color: "var(--text-soft)",
                  }}
                >
                  إلغاء
                </button>
              </div>
            </div>
          ) : (
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                gap: "12px",
                flexWrap: "wrap",
              }}
            >
              <div style={{ minWidth: "240px", flex: 1 }}>
                <h3 style={{ margin: 0 }}>
                  {c.title}{" "}
                  {!c.is_published && (
                    <span
                      style={{
                        fontSize: "12px",
                        padding: "3px 10px",
                        borderRadius: "12px",
                        background: "var(--surface-2)",
                        color: "var(--text-soft)",
                      }}
                    >
                      غير منشور
                    </span>
                  )}
                </h3>
                <p style={{ margin: "8px 0 0", fontSize: "14px" }}>
                  {c.price > 0 ? `${c.price} جنيه` : "مجاني"} ·{" "}
                  {c.duration_days ? `${c.duration_days} يوم` : "بدون مدة"} ·{" "}
                  {lessonCounts[c.id] || 0} درس
                </p>
                <p style={{ margin: "4px 0 0", fontSize: "14px" }}>
                  اشتراكات نشطة: {activeCounts[c.id] || 0} · طلبات معلقة:{" "}
                  {pendingCounts[c.id] || 0}
                </p>
                {teacherSupported && (
                  <p style={{ margin: "4px 0 0", fontSize: "14px", color: "var(--text-muted)" }}>
                    المدرس:{" "}
                    {c.teacher_id
                      ? teachers.find((t) => t.id === c.teacher_id)?.full_name || "معيّن"
                      : "بدون تعيين"}
                  </p>
                )}
              </div>
              <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "flex-start" }}>
                <a
                  href={`/courses/${c.id}`}
                  style={{
                    padding: "10px 16px",
                    borderRadius: "10px",
                    border: "1px solid var(--gold)",
                    color: "var(--gold)",
                    fontWeight: "bold",
                    fontSize: "14px",
                  }}
                >
                  عرض
                </a>
                <button onClick={() => startEdit(c)} disabled={busyId === c.id}>
                  تعديل
                </button>
                <button
                  onClick={() => togglePublish(c)}
                  disabled={busyId === c.id}
                  style={{
                    background: c.is_published ? "var(--warning-bg)" : "var(--success-bg)",
                    color: c.is_published ? "var(--warning)" : "var(--success)",
                  }}
                >
                  {c.is_published ? "إيقاف النشر" : "نشر"}
                </button>
                <button
                  onClick={() => deleteCourse(c)}
                  disabled={busyId === c.id}
                  style={{ background: "var(--error-bg)", color: "white" }}
                >
                  حذف
                </button>
              </div>
            </div>
          )}
        </section>
      ))}
    </main>
  );
}
