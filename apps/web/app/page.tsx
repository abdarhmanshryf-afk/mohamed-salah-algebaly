const features = [
  ["شرح مبسّط", "دروس منظمة تساعدك على فهم اللغة العربية خطوة بخطوة."],
  ["امتحانات إلكترونية", "تدرّب واختبر مستواك وتابع تقدمك."],
  ["مذكرات ومراجعات", "مواد تعليمية مساعدة لكل كورس."],
];

export default function Home() {
  return (
    <main>
      <nav className="nav">
        <div className="brand">الأستاذ محمد صلاح الجبالي</div>
        <a className="login" href="/login">دخول الطلاب</a>
      </nav>
      <section className="hero">
        <div className="eyebrow">منصة تعليم اللغة العربية</div>
        <h1>اتعلّم العربي<br /><span>بفهم وثقة</span></h1>
        <p>رحلتك في اللغة العربية تبدأ من هنا. تابع دروسك، اختبر مستواك، وراجع مع الأستاذ محمد صلاح الجبالي.</p>
        <a className="cta" href="/courses">استكشف الكورسات</a>
      </section>
      <section className="features">
        <h2>كل ما تحتاجه في مكان واحد</h2>
        <div className="cards">
          {features.map(([title, desc]) => <article className="card" key={title}><h3>{title}</h3><p>{desc}</p></article>)}
        </div>
      </section>
      <footer>© منصة الأستاذ محمد صلاح الجبالي</footer>
    </main>
  );
}
