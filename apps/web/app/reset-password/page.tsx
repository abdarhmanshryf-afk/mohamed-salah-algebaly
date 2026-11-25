"use client";

import { useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function ResetPassword() {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [message, setMessage] = useState("");
  const [done, setDone] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleUpdate(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage("");

    if (password.length < 8) {
      setMessage("كلمة المرور لازم تكون 8 أحرف على الأقل.");
      return;
    }
    if (password !== confirm) {
      setMessage("كلمتا المرور غير متطابقتين.");
      return;
    }

    setLoading(true);

    const supabase = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );

    const { error } = await supabase.auth.updateUser({ password });

    if (error) {
      setMessage("تعذر تغيير كلمة المرور. افتح الرابط من الإيميل مرة أخرى وحاول من جديد.");
    } else {
      setDone(true);
      setMessage("تم تغيير كلمة المرور بنجاح 🎉");
    }

    setLoading(false);
  }

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-brand">متقن<span>.</span></h1>
        <p className="auth-welcome">اختر كلمة المرور الجديدة لحسابك.</p>

        {!done && (
          <form onSubmit={handleUpdate}>
            <label>كلمة المرور الجديدة</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />

            <label>تأكيد كلمة المرور</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              required
            />

            <button type="submit" disabled={loading}>
              {loading ? "جاري الحفظ..." : "حفظ كلمة المرور"}
            </button>
          </form>
        )}

        {message && <p role="status">{message}</p>}

        <div className="auth-links">
          <a href="/login">← الذهاب لتسجيل الدخول</a>
        </div>
      </div>
    </main>
  );
}
