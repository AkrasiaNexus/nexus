import { useState } from "react";
import { useDonna } from "../hooks/useDonna";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import { dailyBrief } from "../lib/brief";
import { today, nowMin } from "../lib/time";

// The chatbox under the calendar: one exchange, not a transcript. Scroll the calendar
// to see your week; this is for telling Donna things and asking what today looks like.
export default function AskBar() {
  const { thread, busy, say, tell } = useDonna();
  const [text, setText] = useState("");

  const last = thread.at(-1);
  const answer = last && last.role !== "user" ? last : null;

  function submit(e) {
    e.preventDefault();
    const asked = text.trim();
    if (!asked || busy) return;
    setText("");
    say(asked);
  }

  function brief() {
    const { text: line } = dailyBrief({
      items: itemStore.getAll(),
      plan: planStore.getAll(),
      date: today(),
      nowMinutes: nowMin(),
    });
    tell("what's my day looking like", line);
  }

  return (
    <section className="flex-none border-t border-donna-border pt-3 flex flex-col gap-2">
      <div className="min-h-[20px] text-[13px] leading-snug" aria-live="polite">
        {busy ? (
          <span role="status" aria-label="Donna is thinking" className="inline-flex gap-1 items-center">
            {[0, 150, 300].map((delay) => (
              <span key={delay} className="w-1 h-1 rounded-full bg-donna-muted animate-bounce" style={{ animationDelay: `${delay}ms` }} />
            ))}
          </span>
        ) : answer ? (
          <p className={answer.role === "error" ? "text-donna-red" : "text-donna-text"}>{answer.content}</p>
        ) : null}
      </div>

      <form onSubmit={submit} className="flex items-center gap-2 rounded-lg border border-donna-border bg-donna-surface px-3 py-2">
        <input
          id="ask"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Tell Donna"
          className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-donna-faint"
        />
        <button
          type="button"
          onClick={brief}
          className="flex-none text-[11.5px] px-2.5 py-1 rounded-full border border-donna-border text-donna-muted hover:text-donna-text transition-colors"
        >
          brief
        </button>
      </form>
    </section>
  );
}
