"use client";

import { useEffect } from "react";
import { getBrowserClient } from "../../lib/supabase-browser";

export default function AuthCallback() {
  useEffect(() => {
    async function routeUser() {
      const supabase = getBrowserClient();

      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      window.location.href = profile?.role === "teacher" ? "/teacher" : "/courses";
    }

    routeUser();
  }, []);

  return (
    <main className="auth-wrap">
      <div className="auth-card">
        <h1 className="auth-brand">متقن<span>.</span></h1>
        <p className="auth-welcome">جاري تسجيل الدخول...</p>
      </div>
    </main>
  );
}
