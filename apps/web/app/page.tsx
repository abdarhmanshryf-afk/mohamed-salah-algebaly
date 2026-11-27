import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createServerClient } from "@supabase/ssr";
import Faq from "./components/Faq";
import { WHATSAPP_NUMBER } from "./config";

const features = [
  ["🎬", "دروس فيديو بجودة عالية", "شرح مبسّط ومنظم يساعدك تفهم العربي خطوة بخطوة.", "blue"],
  ["📝", "امتحانات إلكترونية تفاعلية", "تدرّب واختبر مستواك وتابع نتيجتك أول بأول.", "mint"],
  ["📚", "مذكرات ومراجعات شاملة", "مواد تعليمية مساعدة لكل كورس وكل درس.", "orange"],
  ["📊", "متابعة تقدمك لحظة بلحظة", "تقارير ونقاط وشارات تحفزك تكمّل.", "purple"],
] as const;

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

  // المنصة تفتح على صفحة تسجيل الدخول أولًا في كل جلسة متصفح؛ من لا جلسة له أو
  // من فتح المتصفح من جديد (بلا علامة الجلسة) يتحول لها، وهي تعيده للمنصة تلقائيًا.
  if (!user || !cookieStore.get("mtq_gate")) {
    redirect("/login");
  }

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
    <main className="nq">
      <header className="nq-header">
        <a className="nq-logo" href="/" aria-label="متقن — الرئيسية">
          <span className="nq-logo-mark" aria-hidden="true">🎓</span>
          <span>متقن</span>
        </a>
        <nav className="nq-links nq-links-desktop">
          <a href="/" className="active">الرئيسية</a>
          <a href="/courses">الكورسات</a>
          <a href="/about">عن المنصة</a>
          <a href="/review">المراجعات</a>
          <a href="/#faq">الأسئلة الشائعة</a>
        </nav>
        <details className="nq-navwrap">
          <summary className="nq-burger" aria-label="القائمة">☰</summary>
          <nav className="nq-links">
            <a href="/">الرئيسية</a>
            <a href="/courses">الكورسات</a>
            <a href="/about">عن المنصة</a>
            <a href="/review">المراجعات</a>
            <a href="/#faq">الأسئلة الشائعة</a>
          </nav>
        </details>
        <div className="nq-header-btns">
          {isTeacher && <a className="nq-btn nq-btn-ghost" href="/teacher">لوحة التحكم</a>}
          {user && !isTeacher && <a className="nq-btn nq-btn-ghost" href="/courses">كورساتي</a>}
          <a className="nq-btn nq-btn-navy" href="/login">تسجيل دخول</a>
          <a className="nq-btn nq-btn-green" href="/register">+ إنشاء حساب</a>
        </div>
      </header>

      {user && !isTeacher && (
        <section className="nq-section nq-me">
          <div className="nq-me-head">
            <img src="/illustrations/welcome-student.png" alt="" className="nq-me-art" />
            <div>
              <h2>أهلًا بيك يا {studentName || "بطل"} 👋</h2>
              <p>كمّل رحلتك من مكان ما وقفت.</p>
            </div>
          </div>
          <div className="nq-grid nq-grid-3">
            <a className="nq-card nq-link-card" href="/my"><span className="nq-chip mint">📖</span><h3>دروسي</h3><p>كمّل من مكان ما وقفت.</p></a>
            <a className="nq-card nq-link-card" href="/progress"><span className="nq-chip blue">📈</span><h3>تقدمي</h3><p>نقاطك وشاراتك وتقريرك الشهري.</p></a>
            <a className="nq-card nq-link-card" href="/review"><span className="nq-chip orange">🔁</span><h3>المراجعة</h3><p>الأسئلة المستحقة للمراجعة النهاردة.</p></a>
            <a className="nq-card nq-link-card" href="/assistant"><span className="nq-chip purple">🤖</span><h3>المساعد الذكي</h3><p>اسأل أي حاجة في العربي.</p></a>
            <a className="nq-card nq-link-card" href="/challenges"><span className="nq-chip mint">🏆</span><h3>التحديات</h3><p>تحديات جديدة بنقاط.</p></a>
            <a className="nq-card nq-link-card" href="/notifications"><span className="nq-chip blue">🔔</span><h3>الإشعارات</h3><p>كل جديدك في مكان واحد.</p></a>
          </div>
          {recentAttempts.length > 0 && (
            <>
              <h2 className="nq-h2">آخر نشاط ليك</h2>
              <div className="nq-grid nq-grid-3">
                {recentAttempts.map((a, i) => (
                  <article className="nq-card" key={i}>
                    <span className="nq-chip orange">✍️</span>
                    <h3>{a.exams?.title || "امتحان"}</h3>
                    <p>درجتك: {a.score}% — {new Date(a.created_at).toLocaleDateString("ar-EG")}</p>
                  </article>
                ))}
              </div>
            </>
          )}
          {latestLessons.length > 0 && (
            <>
              <h2 className="nq-h2">جديد على المنصة</h2>
              <div className="nq-grid nq-grid-3">
                {latestLessons.map((l) => (
                  <a className="nq-card nq-link-card" key={l.id} href={`/courses/${l.course_id}`}>
                    <span className="nq-chip mint">🆕</span>
                    <h3>{l.title}</h3>
                    <p>درس جديد اتضاف مؤخرًا — شوفه دلوقتي.</p>
                  </a>
                ))}
              </div>
            </>
          )}
        </section>
      )}

      <section className="nq-hero">
        <div className="nq-hero-text">
          <span className="nq-eyebrow">✨ منصة تعليم اللغة العربية</span>
          <h1>اتعلم العربي<br /><span className="nq-grad">بفهم وثقة</span></h1>
          <p className="nq-hero-sub"><strong>مع منصة متقن التعليمية</strong><br />بإشراف الأستاذ محمد صلاح الجبالي</p>
          <div className="nq-hero-btns">
            <a className="nq-btn nq-btn-navy nq-btn-lg" href="/login">تسجيل الدخول&nbsp;👤</a>
            <a className="nq-btn nq-btn-orange nq-btn-lg" href="/courses">▶ استكشف الكورسات</a>
          </div>
          <div className="nq-hero-points">
            <span><b>✓</b> شرح مبسّط</span>
            <span><b>✓</b> امتحانات إلكترونية</span>
            <span><b>✓</b> مذكرات ومراجعات</span>
          </div>
        </div>
        <div className="nq-hero-art" aria-hidden="true">
          <img src="/illustrations/hero.png" alt="" />
        </div>
      </section>

      <section className="nq-section nq-feats">
        <h2 className="nq-h2 nq-center">كل اللي تحتاجه في مكان واحد</h2>
        <p className="nq-sub nq-center">أدوات متكاملة تساعدك تتعلم وتتقن العربي بسهولة.</p>
        <div className="nq-grid nq-grid-4">
          {features.map(([icon, title, desc, tone]) => (
            <article className="nq-card nq-feature" key={title}>
              <span className={`nq-chip ${tone}`}>{icon}</span>
              <h3>{title}</h3>
              <p>{desc}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="nq-section" id="faq">
        <h2 className="nq-h2 nq-center">أسئلة شائعة</h2>
        <div className="nq-faq"><Faq /></div>
      </section>

      <section className="nq-section">
        <div className="nq-teacher">
          <div className="teacher-photo"><img src="/teacher.jpg" alt="الأستاذ محمد صلاح الجبالي" /></div>
          <div>
            <h2 className="nq-h2">عن الأستاذ</h2>
            <p>
              <strong>محمد صلاح الجبالي</strong> —
              مدرّس لغة عربية، بيبسّط النحو والبلاغة والإملاء بأمثلة من الحياة
              اليومية، عشان تحب العربي وتتقنه.
            </p>
          </div>
        </div>
      </section>

      <footer className="nq-footer">
        <h2 className="nq-footer-brand">متقن</h2>
        <p className="nq-footer-tag">منصة تعليمية بتخلّيك تحب العربي</p>
        <div className="nq-footer-cols">
          <div className="nq-footer-col">
            <h4>الكورسات</h4>
            {courseLinks.map((c) => (
              <a key={c.id} href={`/courses/${c.id}`}>{c.title}</a>
            ))}
            <a href="/courses">كل الكورسات</a>
          </div>
          <div className="nq-footer-col">
            <h4>الأحكام</h4>
            <a href="/privacy">سياسة الخصوصية</a>
            <a href="/terms">الشروط والأحكام</a>
            <a href="/refund">سياسة الاسترداد</a>
          </div>
          <div className="nq-footer-col">
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
        <p className="nq-footer-copy">© منصة متقن — كل الحقوق محفوظة</p>
      </footer>
    </main>
  );
}
