import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

const features = [
  ["شرح مبسّط", "دروس منظمة تساعدك على فهم اللغة العربية خطوة بخطوة."],
  ["امتحانات إلكترونية", "تدرّب واختبر مستواك وتابع تقدمك."],
  ["مذكرات ومراجعات", "مواد تعليمية مساعدة لكل كورس."],
];

export default async function Home() {
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
          // Server components cannot set cookies.
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let isTeacher = false;
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();
    isTeacher = profile?.role === "teacher";
  }

  return (
    <main>
      <nav className="nav">
        <div className="brand">متقن</div>
        {isTeacher && <a className="login" href="/teacher">لوحة التحكم</a>}
        {!user && <a className="login" href="/login">دخول الطلاب</a>}
        {user && !isTeacher && <a className="login" href="/courses">كورساتي</a>}
      </nav>
      <section className="hero">
        <div className="deco-circle" aria-hidden="true" />
        <svg
          className="deco-pencil"
          viewBox="0 0 200 220"
          aria-hidden="true"
        >
          <g
            transform="rotate(30 100 110)"
            fill="none"
            stroke="var(--gold)"
            strokeWidth="4"
            strokeLinejoin="round"
          >
            <rect x="86" y="18" width="28" height="120" rx="5" />
            <path d="M86 18 Q100 2 114 18" />
            <line x1="100" y1="26" x2="100" y2="138" />
            <polygon points="86,138 114,138 100,176" />
            <line x1="96" y1="166" x2="104" y2="166" />
          </g>
        </svg>
        <div className="hero-content">
          <div className="eyebrow">منصة تعليم اللغة العربية</div>
          <h1>اتعلّم العربي<br /><span>بفهم وثقة</span></h1>
          <p>رحلتك في اللغة العربية تبدأ من هنا. تابع دروسك، اختبر مستواك، وراجع مع الأستاذ محمد صلاح الجبالي.</p>
          <div className="hero-points">
            {features.map(([title]) => <div className="hero-point" key={title}><span>✓</span>{title}</div>)}
          </div>
          <a className="cta" href="/courses">استكشف الكورسات</a>
        </div>
      </section>
      <section className="features">
        <h2>كل ما تحتاجه في مكان واحد</h2>
        <div className="cards">
          {features.map(([title, desc]) => <article className="card" key={title}><h3>{title}</h3><p>{desc}</p></article>)}
        </div>
      </section>
      <footer>© منصة متقن</footer>
    </main>
  );
}
