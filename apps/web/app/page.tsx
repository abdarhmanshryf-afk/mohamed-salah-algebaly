import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import Faq from "./components/Faq";
import { WHATSAPP_NUMBER } from "./config";

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
  let studentName = "";
  if (user) {
    const { data: profile } = await supabase
      .from("profiles")
      .select("role, full_name")
      .eq("id", user.id)
      .single();
    isTeacher = profile?.role === "teacher";
    studentName = profile?.full_name || "";
  }

  // لوحة الطالب الرئيسية: نشاط حديث + أحدث الدروس (للطالب المسجل بس)
  let recentAttempts: { score: number; created_at: string; exams: { title: string } | null }[] = [];
  let latestLessons: { id: string; title: string; course_id: string }[] = [];
  if (user && !isTeacher) {
    const [{ data: att }, { data: les }] = await Promise.all([
      supabase
        .from("exam_attempts")
        .select("score, created_at, exams(title)")
        .order("created_at", { ascending: false })
        .limit(3),
      supabase
        .from("lessons")
        .select("id, title, course_id")
        .order("created_at", { ascending: false })
        .limit(3),
    ]);
    recentAttempts = (att as unknown as typeof recentAttempts) || [];
    latestLessons = les || [];
  }

  const { data: courseRows } = await supabase
    .from("courses")
    .select("id, title")
    .eq("is_published", true)
    .order("created_at");
  const courseLinks: { id: string; title: string }[] = courseRows || [];

  return (
    <main>
      <nav className="nav">
        <div className="brand">متقن</div>
        {isTeacher && <a className="login" href="/teacher">لوحة التحكم</a>}
        {!user && <a className="login" href="/login">دخول الطلاب</a>}
        {user && !isTeacher && <a className="login" href="/courses">كورساتي</a>}
        {user && !isTeacher && (
          <a className="login" href="/profile" style={{ marginRight: "8px" }}>حسابي</a>
        )}
      </nav>

      {user && !isTeacher && (
        <section className="features" style={{ paddingTop: "100px" }}>
          <h2>أهلًا بيك يا {studentName || "بطل"} 👋</h2>
          <div className="cards">
            <a className="card" href="/my"><h3>📖 دروسي</h3><p>كمّل من مكان ما وقفت.</p></a>
            <a className="card" href="/progress"><h3>📈 تقدمي</h3><p>نقاطك وشاراتك وتقريرك الشهري.</p></a>
            <a className="card" href="/review"><h3>🔁 المراجعة</h3><p>الأسئلة المستحقة للمراجعة النهاردة.</p></a>
            <a className="card" href="/assistant"><h3>🤖 المساعد الذكي</h3><p>اسأل أي حاجة في العربي.</p></a>
            <a className="card" href="/challenges"><h3>🏆 التحديات</h3><p>تحديات جديدة بنقاط.</p></a>
            <a className="card" href="/notifications"><h3>🔔 الإشعارات</h3><p>كل جديدك في مكان واحد.</p></a>
          </div>
          {recentAttempts.length > 0 && (
            <>
              <h2 style={{ marginTop: "34px" }}>آخر نشاط ليك</h2>
              <div className="cards">
                {recentAttempts.map((a, i) => (
                  <article className="card" key={i}>
                    <h3>✍️ {a.exams?.title || "امتحان"}</h3>
                    <p>درجتك: {a.score}% — {new Date(a.created_at).toLocaleDateString("ar-EG")}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          {latestLessons.length > 0 && (
            <>
              <h2 style={{ marginTop: "34px" }}>جديد على المنصة</h2>
              <div className="cards">
                {latestLessons.map((l) => (
                  <a className="card" key={l.id} href={`/courses/${l.course_id}`}>
                    <h3>🆕 {l.title}</h3>
                    <p>درس جديد اتضاف مؤخرًا — شوفه دلوقتي.</p>
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}
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
      <section className="faq">
        <h2>أسئلة شائعة</h2>
        <Faq />
      </section>
      <section className="teacher">
        <div className="teacher-photo"><img src="/teacher.jpg" alt="الأستاذ محمد صلاح الجبالي" /></div>
        <div>
          <h2>عن الأستاذ</h2>
          <p>
            <strong style={{ color: "var(--text)" }}>محمد صلاح الجبالي</strong> —
            مدرّس لغة عربية، بيبسّط النحو والبلاغة والإملاء بأمثلة من الحياة
            اليومية، عشان تحب العربي وتتقنه.
          </p>
        </div>
      </section>
      <footer className="footer-rich">
        <h2 className="footer-brand">متقن</h2>
        <p className="footer-tag">منصة تعليمية بتخلّيك تحب العربي</p>
        <div className="footer-cols">
          <div className="footer-col">
            <h4>الكورسات</h4>
            {courseLinks.map((c) => (
              <a key={c.id} href={`/courses/${c.id}`}>{c.title}</a>
            ))}
            <a href="/courses">كل الكورسات</a>
          </div>
          <div className="footer-col">
            <h4>الأحكام</h4>
            <a href="/privacy">سياسة الخصوصية</a>
            <a href="/terms">الشروط والأحكام</a>
            <a href="/refund">سياسة الاسترداد</a>
          </div>
          <div className="footer-col">
            <h4>عامة</h4>
            <a href="/about">عن المنصة</a>
            <a href="/contact">تواصل معنا</a>
            <a
              href={`https://wa.me/${WHATSAPP_NUMBER}`}
              target="_blank"
              rel="noopener"
            >
              واتساب
            </a>
          </div>
        </div>
        <p className="footer-copy">© منصة متقن — كل الحقوق محفوظة</p>
      </footer>
    </main>
  );
}
