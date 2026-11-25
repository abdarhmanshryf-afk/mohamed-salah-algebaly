import { NextRequest, NextResponse } from "next/server";

// مساعد متقن الذكي — Gemini (الخطة المجانية). المفتاح على السيرفر بس (GEMINI_API_KEY).
const MODEL = "gemini-2.0-flash-lite";

const SYSTEM = `أنت "مساعد متقن" — مساعد ذكي في منصة متقن لتعليم اللغة العربية لطلاب الثانوية العامة في مصر.
- اتكلم بالمصري البسيط والمحترم، وخلي إجابتك قصيرة وواضحة.
- لو سؤال في النحو أو الأدب أو البلاغة أو النصوص، اشرح بمثال بسيط.
- لو السؤال مش عن اللغة العربية أو المذاكرة، رد بلطف إنك متخصص في اللغة العربية والمذاكرة بس.
- ممنوع تحل الامتحان بدل الطالب: لو بعتلك سؤال امتحان، علّمه إزاي يفكر فيه متديهوش الإجابة جاهزة.`;

type Mode = "chat" | "exam-analysis" | "study-plan" | "weakness";

const MODE_INSTRUCTIONS: Record<Exclude<Mode, "chat">, string> = {
  "exam-analysis":
    "الطالب خلص امتحان ودي أسئلته الغلط. لكل غلطة: اشرح ليه الإجابة الصح هي الصح ببساطة، وإيه القاعدة اللي محتاج يراجعها. اختم بأهم نقطتين يراجعهم.",
  "study-plan":
    "اعمل خطة مذاكرة أسبوعية بسيطة للطالب بناءً على البيانات اللي جاية: الأيام، المدة اليومية، والمواضيع بالترتيب. خليها عملية ومشجعة.",
  weakness:
    "دي إحصائيات الطالب في الامتحانات والدروس. توقع أهم 3 نقاط ضعف ممكن توقعه في الامتحان الجاي، وقوله يراجع إيه بالظط.",
};

function friendly(status: number): string {
  if (status === 429)
    return "الضغط على المساعد كبير دلوقتي 😅 استنى دقيقة وجرّب تاني.";
  return "المساعد مش متاح دلوقتي — جرّب بعد شوية.";
}

export async function POST(req: NextRequest) {
  const key = process.env.GEMINI_API_KEY;
  if (!key) {
    return NextResponse.json(
      { reply: "المساعد الذكي لسه بيتفعّل — جرّب بعد شوية 🙏" },
      { status: 200 }
    );
  }

  let body: {
    mode?: Mode;
    messages?: { role: string; text: string }[];
    context?: string;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ reply: "طلب مش مفهوم." }, { status: 400 });
  }

  const mode: Mode = body.mode || "chat";
  const contents: { role: string; parts: { text: string }[] }[] = [];

  if (body.context) {
    contents.push({
      role: "user",
      parts: [{ text: `سياق للمساعدة:\n${body.context.slice(0, 6000)}` }],
    });
    contents.push({
      role: "model",
      parts: [{ text: "تمام، فهمت السياق. اسأل براحتك." }],
    });
  }
  (body.messages || []).slice(-10).forEach((m) => {
    contents.push({
      role: m.role === "assistant" ? "model" : "user",
      parts: [{ text: String(m.text).slice(0, 4000) }],
    });
  });
  if (contents.length === 0) {
    return NextResponse.json({ reply: "ابعت سؤالك الأول 😊" }, { status: 200 });
  }

  const systemText =
    SYSTEM + (mode !== "chat" ? "\n\n" + MODE_INSTRUCTIONS[mode] : "");

  try {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent?key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemText }] },
          contents,
          generationConfig: { temperature: 0.4, maxOutputTokens: 800 },
        }),
      }
    );
    if (!res.ok) {
      return NextResponse.json({ reply: friendly(res.status) }, { status: 200 });
    }
    const data = await res.json();
    const reply: string =
      data?.candidates?.[0]?.content?.parts
        ?.map((p: { text?: string }) => p.text || "")
        .join("") || "معرفتش أرد — جرّب تاني.";
    return NextResponse.json({ reply: reply.trim() }, { status: 200 });
  } catch {
    return NextResponse.json({ reply: friendly(0) }, { status: 200 });
  }
}
