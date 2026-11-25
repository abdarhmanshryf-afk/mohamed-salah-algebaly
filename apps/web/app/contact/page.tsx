import { WHATSAPP_NUMBER } from "../config";

export default function Contact() {
  return (
    <main>
      <header className="static-header"><a className="brand" href="/">متقن</a></header>
      <div className="subpage">
        <h1>تواصل معنا</h1>
        <p>عندك سؤال عن الاشتراك أو مشكلة في حسابك؟ كلمنا على واتساب وهنرد عليك في أقرب وقت.</p>
        <p>
          <a
            className="cta"
            href={`https://wa.me/${WHATSAPP_NUMBER}`}
            target="_blank"
            rel="noopener"
          >
            💬 كلمني على واتساب
          </a>
        </p>
        <p>لو سؤالك عن درس معين، الأسرع إنك تكتبه في قسم «النقاش» جوه الدرس نفسه والأستاذ هيرد عليك هناك.</p>
      </div>
    </main>
  );
}
