"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

type AccountType = "student" | "teacher";

export default function Login() {
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error || !data.user) {
      setMessage("تعذر تسجيل الدخول. تأكد من البريد الإلكتروني وكلمة المرور.");
      setLoading(false);
      return;
    }

    // The selector is only a signpost: the role always comes from the
    // database, never from what the user picked here.
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", data.user.id)
      .single();

    if (accountType === "teacher" && profile?.role === "teacher") {
      window.location.href = "/teacher";
      return;
    }

    if (accountType === "teacher" && profile?.role !== "teacher") {
      setMessage("هذا الحساب حساب طالب، جارِ تحويلك لصفحة الكورسات.");
    }

    window.location.href = "/courses";
  }

  const optionStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    border: active ? "2px solid #2f6f4f" : "1px solid #ccc",
    background: active ? "#eef7f1" : "#fff",
    fontWeight: active ? 700 : 400,
    cursor: "pointer",
    fontSize: "16px",
  });

  return (
    <main className="subpage">
      <a href="/">← الرئيسية</a>
      <h1>تسجيل الدخول</h1>
      <p>سجل دخولك لمتابعة كورساتك التعليمية.</p>

      <div
        role="group"
        aria-label="نوع الحساب"
        style={{ display: "flex", gap: "12px", marginBottom: "16px" }}
      >
        <button
          type="button"
          style={optionStyle(accountType === "student")}
          onClick={() => setAccountType("student")}
        >
          أنا طالب 🎓
        </button>
        <button
          type="button"
          style={optionStyle(accountType === "teacher")}
          onClick={() => setAccountType("teacher")}
        >
          أنا الأستاذ 👨‍🏫
        </button>
      </div>

      <form onSubmit={handleLogin}>
        <label>البريد الإلكتروني</label>
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <label>كلمة المرور</label>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <button type="submit" disabled={loading}>
          {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
        </button>
      </form>

      {message && <p role="alert">{message}</p>}

      <p>
        ليس لديك حساب؟ <a href="/register">إنشاء حساب جديد</a>
      </p>
    </main>
  );
}
