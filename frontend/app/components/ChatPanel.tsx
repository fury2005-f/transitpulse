"use client";

import { useEffect, useRef, useState } from "react";
import { ChatReply, disclosure, getJSON } from "../lib";
import { renderText } from "./BriefingSection";

type Message = { id: number; question: string; reply?: ChatReply; error?: string };

const SUGGESTIONS = [
  "What should we prepare for Christmas Day?",
  "Which location needs extra staff on Friday?",
  "Which day last month was busiest at Old Town?",
];

export default function ChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [question, setQuestion] = useState("");
  const [pending, setPending] = useState(false);
  const endRef = useRef<HTMLDivElement>(null);

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

  return (
    <section id="ask" className="scroll-mt-6 border-t border-line py-12" aria-labelledby="chat-title">
      <h2 id="chat-title" className="font-serif text-2xl font-semibold sm:text-3xl">Ask the data</h2>
      <p className="mt-2 max-w-prose text-ink-2">Ask in plain English. The assistant looks up the forecast and the history, and shows how it worked out each answer.</p>

      <div className="mt-6 space-y-6" aria-live="polite">
        {messages.length === 0 && (
          <ul className="flex flex-wrap gap-2" aria-label="Example questions">
            {SUGGESTIONS.map((s) => (
              <li key={s}>
                <button
                  type="button"
                  onClick={() => ask(s)}
                  className="rounded-full border border-line bg-surface px-4 py-2 text-left text-sm text-ink-2 outline-none hover:border-ink-2 hover:text-ink focus-visible:ring-2 focus-visible:ring-accent"
                >
                  {s}
                </button>
              </li>
            ))}
          </ul>
        )}

        {messages.map((m) => (
          <article key={m.id} className="space-y-3">
            <p className="ml-auto w-fit max-w-[85%] rounded-lg bg-sunken px-4 py-2">{m.question}</p>
            {m.reply ? (
              <Answer reply={m.reply} />
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

      <form
        className="mt-6 flex max-w-3xl flex-col gap-2 sm:flex-row"
        onSubmit={(e) => {
          e.preventDefault();
          ask(question);
        }}
      >
        <label htmlFor="chat-input" className="sr-only">Your question</label>
        <input
          id="chat-input"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          maxLength={1000}
          placeholder="For example: how busy will Riverside be on Friday?"
          className="min-h-11 flex-1 rounded-lg border border-line bg-surface px-4 py-2 outline-none placeholder:text-muted focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-accent"
        />
        <button
          type="submit"
          disabled={pending || !question.trim()}
          className="min-h-11 rounded-lg bg-accent px-6 font-semibold text-accent-ink outline-none hover:opacity-90 focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-page disabled:cursor-not-allowed disabled:opacity-50"
        >
          Ask
        </button>
      </form>
    </section>
  );
}

function Answer({ reply }: { reply: ChatReply }) {
  const tools = Object.entries(
    reply.tool_calls.reduce<Record<string, number>>((acc, t) => ({ ...acc, [t.tool]: (acc[t.tool] ?? 0) + 1 }), {}),
  );
  return (
    <div className="max-w-prose">
      <div className="space-y-3 leading-relaxed">{renderText(reply.answer)}</div>
      {(reply.sql.length > 0 || tools.length > 0) && (
        <details className="mt-3">
          <summary className={disclosure}>How this answer was worked out</summary>
          {tools.length > 0 && (
            <p className="mt-3 text-sm text-ink-2">
              Looked up: {tools.map(([name, n]) => `${name.replace(/_/g, " ")}${n > 1 ? ` (${n} times)` : ""}`).join(", ")}.
            </p>
          )}
          {reply.sql.map((sql, i) => (
            <pre key={i} className="mt-2 overflow-x-auto rounded-lg bg-sunken p-3 font-mono text-[13px] leading-relaxed">
              <code>{readableSql(sql)}</code>
            </pre>
          ))}
        </details>
      )}
    </div>
  );
}

// The safety layer wraps every query as SELECT * FROM (<query>) LIMIT n; show the query the assistant wrote.
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
