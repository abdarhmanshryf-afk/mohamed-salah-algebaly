"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleReset(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });

    if (error) {
      setMessage("تعذر إرسال الرابط حاليًا، حاول مرة أخرى بعد قليل.");
    } else {
      setMessage("لو البريد ده مسجل عندنا، هيوصلك رابط تعيين كلمة مرور جديدة خلال دقائق.");
    }

    setLoading(false);
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-brand">متقن<span>.</span></h1>
        <p className="auth-welcome">اكتب بريدك الإلكتروني وهنبعتلك رابط تعيين كلمة مرور جديدة.</p>

        <form onSubmit={handleReset}>
          <label>البريد الإلكتروني</label>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <button type="submit" disabled={loading}>
            {loading ? "جاري الإرسال..." : "إرسال الرابط"}
          </button>
        </form>

        {message && <p role="status">{message}</p>}

        <div className="auth-links">
          <a href="/login">← رجوع لتسجيل الدخول</a>
        </div>
      </div>
    </main>
  );
}
