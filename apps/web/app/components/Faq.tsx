"use client";

import { useState } from "react";

const items: [string, string][] = [
  [
    "إزاي أشترك في كورس؟",
    "بتسجّل حساب جديد، تدخل على صفحة الكورس وتضغط «اشترك الآن». طلبك بيروح للأستاذ يراجعه ويوافق عليه، وأول ما الموافقة تتم الاشتراك بيشتغل لمدة 30 يوم.",
  ],
  [
    "أقدر أشاهد الدرس أكتر من مرة؟",
    "أيوه طبعًا. كل دروس الكورس متاحة ليك ترجع لها في أي وقت طول فترة اشتراكك، والمنصة بتحفظ تقدمك فتكمل من حيث وقفت.",
  ],
  [
    "أسأل الأستاذ إزاي؟",
    "جوه كل درس فيه قسم «النقاش» 💬 اكتب سؤالك هناك والأستاذ بيرد عليك في نفس المكان.",
  ],
  [
    "بتديوا شهادة؟",
    "لسه بنجهّز نظام الشهادات، وقريب جدًا كل طالب بيكمّل كورسه هيقدر ياخد شهادة من المنصة.",
  ],
];

export default function Faq() {
  const [open, setOpen] = useState<number | null>(null);
  return (
    <div>
      {items.map(([q, a], i) => (
        <div className="faq-item" key={q}>
          <button
            type="button"
            className="faq-q"
            onClick={() => setOpen(open === i ? null : i)}
            aria-expanded={open === i}
          >
            {q}
            <span className={`chev ${open === i ? "open" : ""}`}>
              {open === i ? "▴" : "▾"}
            </span>
          </button>
          {open === i && <p className="faq-a">{a}</p>}
        </div>
      ))}
    </div>
  );
}
