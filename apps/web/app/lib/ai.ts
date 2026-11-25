// نداء مساعد متقن الذكي من صفحات الطالب (المفتاح على السيرفر في /api/ai).
export async function askItqanAI(
  mode: "exam-analysis" | "study-plan" | "weakness",
  context: string
): Promise<string> {
  try {
    const res = await fetch("/api/ai", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        mode,
        messages: [{ role: "user", text: "اتفضل بياناتي، حللها وقولي المطلوب." }],
        context,
      }),
    });
    const data = await res.json();
    return data.reply || "المساعد معرفش يرد — جرّب تاني.";
  } catch {
    return "النت قطع — جرّب تاني.";
  }
}
