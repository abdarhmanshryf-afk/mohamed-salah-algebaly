"use client";

import { useEffect, useMemo, useState } from "react";
import { getBrowserClient } from "../../lib/supabase-browser";

type UserRow = {
  id: string;
  full_name: string | null;
  phone: string | null;
  role: string;
  created_at: string;
  banned_at: string | null;
};

const roleLabels: Record<string, string> = {
  student: "طالب",
  teacher: "مدرس",
  admin: "أدمن",
};

export default function AdminUsers() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [enrollCounts, setEnrollCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [banSupported, setBanSupported] = useState(true);

  function client() {
    return getBrowserClient();
  }

  async function load() {
    try {
    const supabase = client();

    // banned_at is added by the admin setup SQL; fall back gracefully pre-setup.
    let rows: UserRow[] | null = null;
    const full = await supabase
      .from("profiles")
      .select("id, full_name, phone, role, created_at, banned_at")
      .order("created_at", { ascending: false });
    if (full.error) {
      const basic = await supabase
        .from("profiles")
        .select("id, full_name, phone, role, created_at")
        .order("created_at", { ascending: false });
      if (basic.error) {
        setMessage("خطأ تحميل المستخدمين: " + basic.error.message);
        setLoading(false);
        return;
      }
      setBanSupported(false);
      rows = (basic.data as Omit<UserRow, "banned_at">[]).map((r) => ({
        ...r,
        banned_at: null,
      }));
    } else {
      setBanSupported(true);
      rows = (full.data as UserRow[]) || [];
    }
    setUsers(rows || []);

    const { data: enrolls } = await supabase
      .from("enrollments")
      .select("student_id, status");
    const counts: Record<string, number> = {};
    (enrolls || []).forEach((e: { student_id: string; status: string }) => {
      if (e.status === "active") {
        counts[e.student_id] = (counts[e.student_id] || 0) + 1;
      }
    });
    setEnrollCounts(counts);
    setLoading(false);
    } catch {
      setMessage("حصل خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function toggleBan(u: UserRow) {
    const willBan = !u.banned_at;
    if (
      willBan &&
      !window.confirm(`إيقاف حساب "${u.full_name || "بدون اسم"}"؟ مش هيقدر يدخل المنصة.`)
    ) {
      return;
    }
    setBusyId(u.id);
    setMessage("");
    const supabase = client();
    const { error } = await supabase
      .from("profiles")
      .update({ banned_at: willBan ? new Date().toISOString() : null })
      .eq("id", u.id);
    if (error) {
      setMessage(
        "تعذر تنفيذ الإيقاف. لو العمود مش موجود لسه، شغّل سكريبت الإعداد admin-payments-setup.sql الأول. (" +
          error.message +
          ")"
      );
    } else {
      await load();
    }
    setBusyId(null);
  }

  async function deleteUser(u: UserRow) {
    if (
      !window.confirm(
        `حذف حساب "${u.full_name || "بدون اسم"}" نهائيًا؟ كل بياناته واشتراكاته هتتمسح ولا يمكن التراجع.`
      )
    ) {
      return;
    }
    setBusyId(u.id);
    setMessage("");
    const supabase = client();
    const { error } = await supabase.rpc("admin_delete_user", { target: u.id });
    if (error) {
      setMessage(
        "تعذر حذف الحساب. تأكد أن سكريبت الإعداد admin-payments-setup.sql اتشغّل. (" +
          error.message +
          ")"
      );
    } else {
      await load();
    }
    setBusyId(null);
  }

  const filtered = useMemo(() => {
    const q = search.trim();
    return users.filter((u) => {
      if (roleFilter === "banned" && !u.banned_at) return false;
      if (roleFilter !== "all" && roleFilter !== "banned" && u.role !== roleFilter)
        return false;
      if (!q) return true;
      return (
        (u.full_name || "").includes(q) || (u.phone || "").includes(q)
      );
    });
  }, [users, search, roleFilter]);

  if (loading) {
    return <main className="subpage">جاري تحميل المستخدمين...</main>;
  }

  const filterBtn = (key: string, label: string) => (
    <button
      key={key}
      onClick={() => setRoleFilter(key)}
      style={{
        padding: "8px 16px",
        borderRadius: "20px",
        border: `1px solid ${roleFilter === key ? "var(--gold)" : "var(--border)"}`,
        background: roleFilter === key ? "var(--gold)" : "transparent",
        color: roleFilter === key ? "var(--gold-ink)" : "var(--text-soft)",
      }}
    >
      {label}
    </button>
  );

  return (
    <main className="subpage" style={{ maxWidth: "1000px" }}>
      <h1>المستخدمون</h1>
      <p>كل الحسابات المسجلة — بحث، إيقاف، وحذف.</p>

      {message && <p role="alert">{message}</p>}
      {!banSupported && (
        <div className="notice">
          ⚠️ عمود الإيقاف (banned_at) مش موجود لسه في قاعدة البيانات — شغّل سكريبت
          الإعداد admin-payments-setup.sql عشان تفعّل الإيقاف والحذف.
        </div>
      )}

      <div
        style={{
          display: "flex",
          gap: "10px",
          flexWrap: "wrap",
          marginTop: "18px",
          alignItems: "center",
        }}
      >
        <input
          type="search"
          placeholder="ابحث بالاسم أو رقم الهاتف..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{ flex: 1, minWidth: "220px" }}
        />
        {filterBtn("all", "الكل")}
        {filterBtn("student", "طلاب")}
        {filterBtn("teacher", "مدرسون")}
        {filterBtn("banned", "موقوفون")}
      </div>

      <p style={{ marginTop: "10px", fontSize: "14px" }}>
        {filtered.length} من {users.length} حساب
      </p>

      {filtered.map((u) => (
        <section
          key={u.id}
          className="card"
          style={{
            marginTop: "12px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div style={{ minWidth: "220px" }}>
            <h3 style={{ margin: 0 }}>
              {u.full_name || "بدون اسم"}{" "}
              <span
                style={{
                  fontSize: "12px",
                  padding: "3px 10px",
                  borderRadius: "12px",
                  border: "1px solid var(--border)",
                  color: "var(--text-soft)",
                }}
              >
                {roleLabels[u.role] || u.role}
              </span>{" "}
              {u.banned_at && (
                <span
                  style={{
                    fontSize: "12px",
                    padding: "3px 10px",
                    borderRadius: "12px",
                    background: "var(--error-bg)",
                    color: "var(--error)",
                  }}
                >
                  موقوف 🚫
                </span>
              )}
            </h3>
            <p style={{ margin: "8px 0 0", fontSize: "14px" }}>
              {u.phone || "بدون هاتف"} · اشتراكات نشطة: {enrollCounts[u.id] || 0}
            </p>
            <p style={{ margin: "4px 0 0", fontSize: "13px", color: "var(--text-muted)" }}>
              سجل يوم {new Date(u.created_at).toLocaleDateString("ar-EG")}
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap" }}>
            <button
              onClick={() => toggleBan(u)}
              disabled={busyId === u.id}
              style={{
                background: u.banned_at ? "var(--success-bg)" : "var(--warning-bg)",
                color: u.banned_at ? "var(--success)" : "var(--warning)",
              }}
            >
              {u.banned_at ? "فك الإيقاف" : "إيقاف الحساب"}
            </button>
            <button
              onClick={() => deleteUser(u)}
              disabled={busyId === u.id}
              style={{ background: "var(--error-bg)", color: "white" }}
            >
              حذف نهائي
            </button>
          </div>
        </section>
      ))}
    </main>
  );
}
