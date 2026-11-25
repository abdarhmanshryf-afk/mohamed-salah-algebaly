import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import AdminNav from "./nav";

// Accounts allowed into /admin even before their profiles.role is set to "admin".
// (abdarhmanshryf@gmail.com — the platform owner.)
const ADMIN_IDS = ["1297f9ef-89c8-45d9-82a4-01d5f48206fc"];

export default async function AdminLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const cookieStore = await cookies();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll() {
          // Layouts cannot set cookies; session refresh happens in pages.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();

  const isAdmin = profile?.role === "admin" || ADMIN_IDS.includes(user.id);
  if (!isAdmin) {
    redirect("/courses");
  }

  return (
    <>
      <AdminNav />
      {children}
    </>
  );
}
