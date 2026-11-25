"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type Course = {
  id: string;
  title: string;
  description: string | null;
  price: number;
  duration_days: number | null;
  is_published: boolean;
};

const emptyForm = {
  title: "",
  description: "",
  price: "0",
  duration_days: "",
  is_published: false,
};

export default function TeacherCourses() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [form, setForm] = useState(emptyForm);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function client() {
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  async function loadCourses() {
    const supabase = client();
    const { data, error } = await supabase
      .from("courses")
      .select("id, title, description, price, duration_days, is_published")
      .order("created_at", { ascending: false });

    if (error) {
      setMessage("خطأ تحميل الكورسات: " + error.message);
    } else {
      setCourses(data || []);
    }
    setLoading(false);
  }

  useEffect(() => {
    loadCourses();
  }, []);

  async function deleteCourse(course: Course) {
    const sure = window.confirm(
      `متأكد إنك عايز تحذف كورس "${course.title}"؟\n\nهيتمسح نهائيًا مع كل دروسه واختباراته واشتراكات طلابه، ومفيش تراجع.`
    );
    if (!sure) return;
    setMessage("");
    const supabase = client();

    let storageWarning = false;
    const { data: files } = await supabase.storage
      .from("lesson-media")
      .list(course.id, { limit: 1000 });
    if (files && files.length > 0) {
      const paths = files.map((f) => `${course.id}/${f.name}`);
      const { error: storageError } = await supabase.storage
        .from("lesson-media")
        .remove(paths);
      if (storageError) storageWarning = true;
    }

    const { error } = await supabase
      .from("courses")
      .delete()
      .eq("id", course.id);
    if (error) {
      setMessage("خطأ حذف الكورس: " + error.message);
      return;
    }
    setMessage(
      storageWarning
        ? "الكورس اتمسح لكن بعض ملفاته متمسحتش من التخزين."
        : `تم حذف كورس "${course.title}" نهائيًا.`
    );
    loadCourses();
  }

  function startEdit(course: Course) {
    setEditingId(course.id);
    setForm({
      title: course.title,
      description: course.description || "",
      price: String(course.price),
      duration_days:
        course.duration_days === null ? "" : String(course.duration_days),
      is_published: course.is_published,
    });
    setMessage("");
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(emptyForm);
  }

  async function handleSave(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaving(true);
    setMessage("");

    const payload = {
      title: form.title,
      description: form.description || null,
      price: Number(form.price) || 0,
      duration_days: form.duration_days === "" ? null : Number(form.duration_days),
      is_published: form.is_published,
    };

    const supabase = client();
    const { error } = editingId
      ? await supabase.from("courses").update(payload).eq("id", editingId)
      : await supabase.from("courses").insert(payload);

    if (error) {
      setMessage("تعذر حفظ الكورس: " + error.message);
    } else {
      setMessage(editingId ? "تم تحديث الكورس." : "تمت إضافة الكورس.");
      setForm(emptyForm);
      setEditingId(null);
      await loadCourses();
    }
    setSaving(false);
  }

  if (loading) {
    return <main className="subpage">جاري تحميل الكورسات...</main>;
  }

  return (
    <main className="subpage">
      <a href="/teacher">← لوحة التحكم</a>
      <h1>إدارة الكورسات</h1>

      {message && <p role="alert">{message}</p>}

      <section className="card" style={{ marginTop: "20px" }}>
        <h3>{editingId ? "تعديل كورس" : "إضافة كورس جديد"}</h3>
        <form onSubmit={handleSave}>
          <label>اسم الكورس</label>
          <input
            value={form.title}
            onChange={(e) => setForm({ ...form, title: e.target.value })}
            required
          />

          <label>الوصف</label>
          <input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
          />

          <label>السعر بالجنيه</label>
          <input
            type="number"
            min="0"
            step="0.01"
            value={form.price}
            onChange={(e) => setForm({ ...form, price: e.target.value })}
            required
          />

          <label>مدة الاشتراك بالأيام (اتركها فارغة لمدة غير محددة)</label>
          <input
            type="number"
            min="1"
            value={form.duration_days}
            onChange={(e) =>
              setForm({ ...form, duration_days: e.target.value })
            }
          />

          <label style={{ display: "block", marginTop: "10px" }}>
            <input
              type="checkbox"
              checked={form.is_published}
              onChange={(e) =>
                setForm({ ...form, is_published: e.target.checked })
              }
              style={{ marginLeft: "8px" }}
            />
            منشور للطلاب
          </label>

          <button type="submit" disabled={saving} style={{ marginTop: "12px" }}>
            {saving ? "جاري الحفظ..." : editingId ? "حفظ التعديلات" : "إضافة الكورس"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              style={{ marginRight: "10px" }}
            >
              إلغاء
            </button>
          )}
        </form>
      </section>

      {courses.length === 0 && <p>لا توجد كورسات حتى الآن.</p>}

      {courses.map((course) => (
        <section
          key={course.id}
          style={{
            border: "1px solid #24395e",
            borderRadius: "12px",
            padding: "16px",
            marginTop: "16px",
          }}
        >
          <h3>
            {course.title}{" "}
            <span style={{ color: course.is_published ? "#2e9e5b" : "var(--gold)" }}>
              {course.is_published ? "(منشور)" : "(مسودة)"}
            </span>
          </h3>
          <p>{course.description}</p>
          <p>السعر: {course.price} جنيه</p>
          <p>مدة الكورس: {course.duration_days ?? "غير محددة"} يوم</p>
          <div style={{ display: "flex", gap: "8px", marginTop: "8px" }}>
            <button onClick={() => startEdit(course)}>تعديل</button>
            <a
              href={`/courses/${course.id}`}
              style={{
                padding: "8px 16px",
                borderRadius: "8px",
                background: "var(--gold)",
                color: "#17233a",
                fontWeight: "bold",
                display: "inline-block",
              }}
            >
              👁 عرض المحتوى
            </a>
            <button
              onClick={() => deleteCourse(course)}
              style={{
                background: "#16294a",
                color: "#ff6b61",
                border: "1px solid #ff6b61",
                borderRadius: "8px",
              }}
            >
              حذف الكورس
            </button>
          </div>
        </section>
      ))}
    </main>
  );
}
