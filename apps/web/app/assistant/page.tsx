"use client";

import { useEffect, useRef, useState } from "react";

type Msg = { role: "user" | "assistant"; text: string };

const SUGGESTIONS = [
  "اشرحلي كان وأخواتها ببساطة",
  "إيه الفرق بين البيان والتشبيه؟",
  "إزاي أذاكر النحو بسرعة؟",
];

export default function AssistantPage() {
  const [messages, setMessages] = useState<Msg[]>([]);
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send(text: string) {
    const q = text.trim();
    if (!q || busy) return;
    const next: Msg[] = [...messages, { role: "user", text: q }];
    setMessages(next);
    setInput("");
    setBusy(true);
    try {
      const res = await fetch("/api/ai", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mode: "chat",
          messages: next.slice(-10).map((m) => ({ role: m.role, text: m.text })),
        }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", text: data.reply || "جرّب تاني." }]);
    } catch {
      setMessages([...next, { role: "assistant", text: "النت قطع — جرّب تاني." }]);
    }
    setBusy(false);
  }

  return (
    <main>
      <header className="static-header">
        <a className="brand" href="/">متقن</a>
      </header>
      <div className="subpage" style={{ maxWidth: "700px" }}>
        <h1>🤖 مساعد متقن</h1>
        <p style={{ color: "var(--text-muted)", marginTop: 0 }}>
          اسأل أي حاجة في اللغة العربية أو المذاكرة والمساعد هيرد عليك.
        </p>

        {messages.length === 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px", marginBottom: "12px" }}>
            {SUGGESTIONS.map((s) => (
              <button
                key={s}
                onClick={() => send(s)}
                style={{ textAlign: "right", background: "var(--border)" }}
              >
                {s}
              </button>
            ))}
          </div>
        )}

        {messages.map((m, i) => (
          <div
            key={i}
            style={{
              background: m.role === "assistant" ? "var(--surface-2)" : "var(--border)",
              borderRadius: "10px",
              padding: "10px 12px",
              marginBottom: "8px",
            }}
          >
            <p style={{ margin: 0, fontSize: "12px", color: "var(--gold)" }}>
              {m.role === "assistant" ? "🤖 مساعد متقن" : "أنت"}
            </p>
            <p style={{ margin: "4px 0 0", whiteSpace: "pre-wrap" }}>{m.text}</p>
          </div>
        ))}
        {busy && <p style={{ color: "var(--text-muted)" }}>المساعد بيفكر… 🤔</p>}
        <div ref={bottomRef} />

        <div style={{ display: "flex", gap: "8px", marginTop: "10px" }}>
          <input
            type="text"
            placeholder="اكتب سؤالك هنا..."
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") send(input);
            }}
            style={{ flex: 1, padding: "10px" }}
          />
          <button onClick={() => send(input)} disabled={busy || !input.trim()}>
            ابعت
          </button>
        </div>
      </div>
    </main>
  );
}
