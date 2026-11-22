"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowUp, ArrowLeft } from "lucide-react";
import { ChatReply, getJSON } from "../lib";
import { renderText } from "../components/BriefingSection";

type Message = { id: number; question: string; reply?: ChatReply; error?: string };

const SUGGESTIONS = [
  "What should we prepare for Christmas Day?",
  "Which location needs extra staff on Friday?",
  "Which day last month was busiest at Old Town?",
  "Will we need extra Mandarin signage this weekend?",
  "How did last Saturday compare with the week before?",
  "Do we need German translators tomorrow?",
];

export default function ChatPage() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  useEffect(() => {
    if (messages.length) endRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }, [messages, pending]);

  async function ask(q: string) {
    const text = q.trim();
    if (!text || pending) return;
    const id = Date.now();
    setMessages((m) => [...m, { id, question: text }]);
    setQuestion("");
    setPending(true);
    try {
      const reply = await getJSON<ChatReply>("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: text }),
      });
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, reply } : msg)));
    } catch (e) {
      setMessages((m) => m.map((msg) => (msg.id === id ? { ...msg, error: (e as Error).message } : msg)));
    } finally {
      setPending(false);
    }
  }

  const disclosure =
    "w-fit cursor-pointer rounded text-sm font-semibold text-accent underline decoration-line underline-offset-4 outline-none hover:decoration-accent focus-visible:ring-2 focus-visible:ring-accent";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-50 border-b border-line bg-page/90 backdrop-blur-md">
        <div className="mx-auto flex max-w-4xl items-center gap-4 px-4 py-3 sm:px-6">
          <a href="/" className="flex items-center gap-2 rounded text-sm text-ink-2 outline-none transition-colors hover:text-ink focus-visible:ring-2 focus-visible:ring-accent">
            <ArrowLeft size={16} />
            <span className="hidden sm:inline">Dashboard</span>
          </a>
          <div className="flex items-center gap-2.5">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-xs font-bold text-accent-ink">TP</span>
            <span className="text-base font-semibold tracking-tight">TransitPulse AI</span>
          </div>
        </div>
      </header>

      <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col px-4 sm:px-6">
        {messages.length === 0 ? (
          <div className="flex flex-1 flex-col items-center justify-center pb-32">
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-accent text-lg font-bold text-accent-ink">TP</div>
            <h1 className="mt-6 text-2xl font-bold tracking-tight sm:text-3xl">Ask the data</h1>
            <p className="mt-2 max-w-md text-center text-ink-2">Ask in plain English. The AI reads the forecast database and shows how it worked out each answer.</p>
            <div className="mt-8 flex max-w-2xl flex-wrap justify-center gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full glass px-4 py-2.5 text-left text-sm text-ink-2 outline-none transition-all duration-200 hover:!border-accent hover:text-accent hover:shadow-sm focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="flex-1 space-y-6 py-8" aria-live="polite">
            {messages.map((m) => (
              <article key={m.id} className="space-y-4">
                <div className="flex justify-end">
                  <p className="max-w-[85%] rounded-2xl bg-accent px-4 py-3 text-sm text-accent-ink">{m.question}</p>
                </div>
                {m.reply ? (
                  <div className="max-w-prose">
                    <div className="space-y-3 leading-relaxed">{renderText(m.reply.answer)}</div>
                    {(m.reply.sql.length > 0 || m.reply.tool_calls.length > 0) && (
                      <details className="mt-3">
                        <summary className={disclosure}>How this answer was worked out</summary>
                        {m.reply.tool_calls.length > 0 && (
                          <p className="mt-3 text-sm text-ink-2">
                            Looked up:{" "}
                            {Object.entries(
                              m.reply.tool_calls.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.tool]: (acc[t.tool] ?? 0) + 1 }), {}),
                            )
                              .map(([name, n]) => `${name.replace(/_/g, " ")}${n > 1 ? ` (${n} times)` : ""}`)
                              .join(", ")}
                            .
                          </p>
                        )}
                        {m.reply.sql.map((sql, i) => (
                          <pre key={i} className="mt-2 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-[13px] leading-relaxed">
                            <code>{readableSql(sql)}</code>
                          </pre>
                        ))}
                      </details>
                    )}
                  </div>
                ) : m.error ? (
                  <div className="max-w-prose rounded-lg bg-critical-wash px-4 py-3 text-sm" role="alert">
                    <p className="font-semibold">No answer this time</p>
                    <p className="mt-1">{m.error}</p>
                  </div>
                ) : (
                  <p className="flex items-center gap-3 text-sm text-ink-2">
                    <Spinner /> Looking through the data. This can take up to a minute.
                  </p>
                )}
              </article>
            ))}
            <div ref={endRef} />
          </div>
        )}
      </main>

      <div className="sticky bottom-0 border-t border-line bg-page/90 backdrop-blur-md">
        <form
          className="mx-auto flex max-w-4xl items-center gap-2 px-4 py-4 sm:px-6"
          onSubmit={(e) => {
            e.preventDefault();
            ask(question);
          }}
        >
          <label htmlFor="chat-input" className="sr-only">Your question</label>
          <div className="relative flex-1">
            <input
              ref={inputRef}
              id="chat-input"
              value={question}
              onChange={(e) => setQuestion(e.target.value)}
              maxLength={1000}
              placeholder="Ask anything about the forecast data..."
              className="h-12 w-full rounded-xl glass pl-4 pr-12 outline-none placeholder:text-muted transition-shadow duration-200 focus-visible:!border-accent focus-visible:ring-2 focus-visible:ring-accent/20 focus-visible:shadow-md"
            />
            <button
              type="submit"
              disabled={pending || !question.trim()}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-lg bg-accent text-accent-ink outline-none transition-opacity duration-150 hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 disabled:opacity-30"
              aria-label="Ask"
            >
              <ArrowUp size={16} />
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

function readableSql(sql: string) {
  const m = sql.match(/^SELECT \* FROM \(([\s\S]*)\) LIMIT (\d+)$/);
  return m ? `${m[1]}\n-- limited to ${Number(m[2]) - 1} rows by the safety layer` : sql;
}

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin motion-reduce:animate-none" viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.25" strokeWidth="3" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
    </svg>
  );
}
