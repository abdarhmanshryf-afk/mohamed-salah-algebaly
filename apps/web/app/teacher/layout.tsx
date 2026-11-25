"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@supabase/ssr";

export default function TeacherLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const [allowed, setAllowed] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkTeacher() {
      const supabase = createBrowserClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
      );

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        window.location.href = "/login";
        return;
      }

      const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .single();

      if (profile?.role !== "teacher") {
        window.location.href = "/courses";
        return;
      }

      setAllowed(true);
      setChecking(false);
    }

    checkTeacher();
  }, []);

  if (checking) {
    return <main className="subpage">جاري التحقق من الصلاحيات...</main>;
  }

  if (!allowed) {
    return null;
  }

  return <>{children}</>;
}
