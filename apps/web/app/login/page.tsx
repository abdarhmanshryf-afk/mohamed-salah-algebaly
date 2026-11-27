"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";
import PasswordInput from "../components/PasswordInput";

type AccountType = "student" | "teacher";

export default function Login() {
  const [accountType, setAccountType] = useState<AccountType>("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(true);

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  // علامة جلسة المتصفح: تُوضع بعد الدخول وتُمحى بقفل المتصفح، حتى تفتح
  // المنصة على صفحة الدخول أولًا في كل مرة. من عنده جلسة شغالة ووصل هنا
  // (من تحويل الصفحة الرئيسية) نعلمه ونرجعه للمنصة مباشرة.
  useEffect(() => {
    // ?switch=1 يعرض الفورم حتى لو فيه جلسة (تبديل حساب).
    if (window.location.search.includes("switch=1")) {
      setChecking(false);
      return;
    }
    const supabase = client();
    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (data.session) {
          document.cookie = "mtq_gate=1; path=/; SameSite=Lax";
          window.location.href = "/";
        } else {
          setChecking(false);
        }
      })
      .catch(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function handleLogin(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = client();

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
    // banned_at is added by the admin setup SQL; fall back pre-setup.
    let profile: { role: string; banned_at?: string | null } | null = null;
    const withBan = await supabase
      .from("profiles")
      .select("role, banned_at")
      .eq("id", data.user.id)
      .single();
    if (withBan.error) {
      const basic = await supabase
        .from("profiles")
        .select("role")
        .eq("id", data.user.id)
        .single();
      profile = basic.data;
    } else {
      profile = withBan.data;
    }

    if (profile?.banned_at) {
      await supabase.auth.signOut();
      setMessage("حسابك موقوف مؤقتًا. تواصل مع الدعم لو عندك استفسار.");
      setLoading(false);
      return;
    }

    // دخل بنجاح: علم جلسة المتصفح حتى لا يعيده بوابة الدخول في نفس الجلسة.
    document.cookie = "mtq_gate=1; path=/; SameSite=Lax";

    const isStaff = profile?.role === "teacher" || profile?.role === "admin";
    if (accountType === "teacher" && isStaff) {
      window.location.href = "/teacher";
      return;
    }

    if (accountType === "teacher" && !isStaff) {
      setMessage("هذا الحساب حساب طالب، جارِ تحويلك لصفحة الكورسات.");
    }

    window.location.href = "/courses";
  }

  async function handleGoogle() {
    setMessage("");
    const supabase = client();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
    if (error) {
      setMessage("الدخول بحساب جوجل غير متاح حاليًا، سجل بالبريد الإلكتروني وكلمة المرور.");
    }
  }

  const optionStyle = (active: boolean): React.CSSProperties => ({
    flex: 1,
    padding: "12px",
    borderRadius: "12px",
    border: active ? "2px solid var(--gold)" : "1px solid var(--border)",
    background: active ? "var(--border)" : "var(--bg-2)",
    color: active ? "var(--gold)" : "var(--text-soft)",
    fontWeight: active ? 700 : 400,
    cursor: "pointer",
    fontSize: "16px",
  });

  // أثناء فحص الجلسة أو أثناء التحويل التلقائي للمنصة: شاشة دخول نظيفة
  // من غير فورم، حتى لا يظهر تعارض بين الفورم والواجهة لمن عنده جلسة شغالة.
  if (checking) {
    return (
      <main className="auth-wrap">
        <div className="auth-card">
          <h1 className="auth-brand">متقن<span>.</span></h1>
          <p className="auth-welcome">جاري الدخول للمنصة...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-brand">متقن<span>.</span></h1>
        <p className="auth-welcome">أهلًا بيك في متقن، رحلتك للتفوق بتبدأ من هنا ❤️</p>

        <div
          role="group"
          aria-label="نوع الحساب"
          style={{ display: "flex", gap: "12px", marginBottom: "8px" }}
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
          <PasswordInput
            value={password}
            onChange={setPassword}
            autoComplete="current-password"
          />

          <button type="submit" disabled={loading}>
            {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول"}
          </button>
        </form>

        <button type="button" className="auth-google" onClick={handleGoogle}>
          الدخول بحساب جوجل
        </button>

        {message && <p role="alert">{message}</p>}

        <div className="auth-links">
          <a href="/forgot-password">نسيت كلمة المرور؟</a>
        </div>
        <div className="auth-links">
          ليس لديك حساب؟ <a href="/register">اعمل حساب جديد</a>
        </div>
        <div className="auth-links">
          <a href="/">← الرئيسية</a>
        </div>
      </div>
    </main>
  );
}
