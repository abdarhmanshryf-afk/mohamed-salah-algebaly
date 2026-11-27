"use client";

import { useState } from "react";
import { getBrowserClient } from "../lib/supabase-browser";
import PasswordInput from "../components/PasswordInput";

export default function Register() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleRegister(e: React.FormEvent<HTMLFormElement>) {
    try {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = getBrowserClient();

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: name,
          phone: phone,
        },
      },
    });

    if (error) {
      setMessage("تعذر إنشاء الحساب: " + error.message);
      setLoading(false);
      return;
    }

    // When email confirmation is off, signup returns an active session:
    // send them straight in instead of telling them to check their email.
    if (data?.session) {
      window.location.href = "/courses";
      return;
    }

    setMessage(
      "تم إنشاء حسابك 🎉 راجع بريدك الإلكتروني ودوس على رابط التأكيد، وبعدها سجل دخولك عادي."
    );
    setLoading(false);
    } catch {
      setMessage("حصل خطأ أثناء تحميل البيانات. حدّث الصفحة وحاول مرة أخرى.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-brand">متقن<span>.</span></h1>
        <p className="auth-welcome">اعمل حسابك في متقن وابدأ رحلتك مع اللغة العربية.</p>

        <form onSubmit={handleRegister}>
          <label>الاسم بالكامل</label>
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />

          <label>رقم الهاتف</label>
          <input
            type="tel"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />

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
            minLength={8}
            autoComplete="new-password"
          />

          <button type="submit" disabled={loading}>
            {loading ? "جاري إنشاء الحساب..." : "إنشاء الحساب"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}

        <div className="auth-links">
          لديك حساب بالفعل؟ <a href="/login">تسجيل الدخول</a>
        </div>
        <div className="auth-links">
          <a href="/">← الرئيسية</a>
        </div>
      </div>
    </main>
  );
}
