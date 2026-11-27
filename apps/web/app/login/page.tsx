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
  const [sessionInfo, setSessionInfo] = useState<{ name: string; isStaff: boolean } | null>(null);

  const client = () =>
    createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

  // علامة جلسة المتصفح (mtq_gate): تُوضع عند الدخول وتُمحى بقفل المتصفح،
  // حتى تفتح المنصة على صفحة الدخول أولًا في كل جلسة. من عنده جلسة شغالة
  // يختار بنفسه: يكمّل بحسابه أو يدخل بحساب تاني. الصفحة ثابتة، بلا تحويل تلقائي.
  useEffect(() => {
    const supabase = client();
    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!data.session) {
          setChecking(false);
          return;
        }
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, role")
          .eq("id", data.session.user.id)
          .single();
        setSessionInfo({
          name: prof?.full_name || "",
          isStaff: prof?.role === "teacher" || prof?.role === "admin",
        });
        setChecking(false);
      })
      .catch(() => setChecking(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function continueAs() {
    document.cookie = "mtq_gate=1; path=/; SameSite=Lax";
    window.location.href = sessionInfo?.isStaff ? "/teacher" : "/courses";
  }

  async function switchAccount() {
    const supabase = client();
    await supabase.auth.signOut();
    setSessionInfo(null);
  }

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

  // أثناء فحص الجلسة: شاشة دخول نظيفة من غير فورم.
  if (checking) {
    return (
      <main className="nq nql">
        <div className="nql-shell">
          <aside className="nql-brand">
            <a className="nq-logo" href="/" aria-label="متقن — الرئيسية">
              <span className="nq-logo-mark" aria-hidden="true">🎓</span>
              <span>متقن</span>
            </a>
            <h2>رحلتك نحو التميز<br />تبدأ من هنا..</h2>
            <img src="/illustrations/books.png" alt="" className="nql-art" />
          </aside>
          <section className="nql-panel">
            <h1>مرحبًا بك في منصة متقن</h1>
            <p className="nql-sub">جاري الدخول للمنصة...</p>
          </section>
        </div>
      </main>
    );
  }

  // جلسة شغالة: اختيار ثابت، بلا وميض ولا تحويل تلقائي.
  if (sessionInfo) {
    return (
      <main className="nq nql">
        <div className="nql-shell">
          <aside className="nql-brand">
            <a className="nq-logo" href="/" aria-label="متقن — الرئيسية">
              <span className="nq-logo-mark" aria-hidden="true">🎓</span>
              <span>متقن</span>
            </a>
            <h2>رحلتك نحو التميز<br />تبدأ من هنا..</h2>
            <img src="/illustrations/books.png" alt="" className="nql-art" />
          </aside>
          <section className="nql-panel">
            <h1>مرحبًا بك في منصة متقن</h1>
            <p className="nql-sub">أهلًا بيك في متقن، رحلتك للتفوق بتبدأ من هنا ❤️</p>

            <button type="button" className="nql-submit" onClick={continueAs}>
              كمّل كـ {sessionInfo.name || "حسابك"}
            </button>
            <button type="button" className="nql-google" onClick={switchAccount}>
              دخول بحساب تاني
            </button>

            <div className="nql-links">
              <a href="/">← الرئيسية</a>
            </div>
          </section>
        </div>
      </main>
    );
  }

  return (
    <main className="nq nql">
      <div className="nql-shell">
        <aside className="nql-brand">
          <a className="nq-logo" href="/" aria-label="متقن — الرئيسية">
            <span className="nq-logo-mark" aria-hidden="true">🎓</span>
            <span>متقن</span>
          </a>
          <h2>رحلتك نحو التميز<br />تبدأ من هنا..</h2>
          <img src="/illustrations/books.png" alt="" className="nql-art" />
        </aside>
        <section className="nql-panel">
          <h1>مرحبًا بك في منصة متقن</h1>
          <p className="nql-sub">اختر نوع الحساب لتسجيل الدخول</p>

          <div role="group" aria-label="نوع الحساب" className="nql-type">
            <button
              type="button"
              className={accountType === "student" ? "active" : ""}
              onClick={() => setAccountType("student")}
            >
              <span aria-hidden="true">🎓</span>
              طالب
            </button>
            <button
              type="button"
              className={accountType === "teacher" ? "active" : ""}
              onClick={() => setAccountType("teacher")}
            >
              <span aria-hidden="true">👨‍🏫</span>
              معلم
            </button>
          </div>

          <form onSubmit={handleLogin}>
            <label htmlFor="nql-email">البريد الإلكتروني</label>
            <input
              id="nql-email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            <div className="nql-pass-head">
              <label htmlFor="nql-pass">كلمة المرور</label>
              <a href="/forgot-password">نسيت كلمة المرور؟</a>
            </div>
            <PasswordInput
              value={password}
              onChange={setPassword}
              autoComplete="current-password"
            />

            <button type="submit" className="nql-submit" disabled={loading}>
              {loading ? "جاري تسجيل الدخول..." : "تسجيل الدخول ←"}
            </button>
          </form>

          <div className="nql-divider"><span>أو الدخول باستخدام</span></div>

          <button type="button" className="nql-google" onClick={handleGoogle}>
            <span aria-hidden="true" style={{ fontWeight: 900, color: "#4285F4" }}>G</span> المتابعة عبر جوجل
          </button>

          {message && <p role="alert" className="nql-msg">{message}</p>}

          <div className="nql-links">
            ليس لديك حساب؟ <a href="/register">إنشاء حساب جديد</a>
          </div>
          <div className="nql-links">
            <a href="/">← الرئيسية</a>
          </div>
        </section>
      </div>
    </main>
  );
}
