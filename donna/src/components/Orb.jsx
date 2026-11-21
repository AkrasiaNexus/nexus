import { useEffect, useRef, useState } from "react";
import { Mic } from "lucide-react";
import { useDonna } from "../hooks/useDonna";
import { useDictation } from "../hooks/useDictation";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import { dailyBrief } from "../lib/brief";
import { outstanding } from "../lib/remind";
import { useStore } from "../hooks/useStore";
import { today, nowMin } from "../lib/time";
import { hideThisWindow, resizeOrb, revealOrb } from "../lib/notify";

const RESTING = 72;
const TICK_MS = 20_000;
const OPEN_WIDTH = 380;

// The window is the orb, so it follows the content: a circle at rest, a card when it speaks.
function useWindowFitsContent(ref, open) {
  useEffect(() => {
    if (!open) {
      resizeOrb(RESTING, RESTING);
      return undefined;
    }
    const fit = () => resizeOrb(OPEN_WIDTH, Math.ceil(ref.current?.scrollHeight ?? RESTING) + 24);
    fit();
    const observer = new ResizeObserver(fit);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, open]);
}

export default function Orb() {
  const { thread, busy, say, tell } = useDonna();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  const [text, setText] = useState("");
  const mic = useDictation((spoken) => { setText(""); say(spoken); });
  const plan = useStore(planStore);
  const card = useRef(null);
  const input = useRef(null);

  // The orb keeps its own clock. Hidden and idle it would never re-render, so a reminder's
  // moment would pass unnoticed — and it must not depend on the main window being open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const waiting = outstanding(plan.reminders ?? [], now);
  const last = thread.at(-1);
  const speaking = last && last.role !== "user";
  // A reminder that fires pops the orb open where it sits, bottom-right. Dismissing
  // leaves the dot on the circle; only ticking it off clears it for good.
  const isOpen = open || busy || speaking || (waiting.length > 0 && !dismissed);

  const seen = useRef("");
  const ids = waiting.map((r) => r.id).join();
  useEffect(() => {
    if (ids && ids !== seen.current) {
      setDismissed(false);
      revealOrb(); // show the window itself: nothing pops up if it is still hidden
    }
    seen.current = ids;
  }, [ids]);

  useWindowFitsContent(card, isOpen);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (waiting.length && !dismissed) setDismissed(true);
      if (open) setOpen(false);
      else if (!waiting.length) hideThisWindow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, waiting.length, dismissed]);

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

  if (!isOpen) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button
          onClick={() => { setOpen(true); setDismissed(false); }}
          aria-label={waiting.length ? `Ask Donna — ${waiting.length} waiting` : "Ask Donna"}
          className={`orb ${waiting.length ? "has-waiting" : ""}`}
        />
      </div>
    );
  }

  return (
    <div ref={card} className="orb-card">
      <div className="flex items-start gap-3">
        <span className={`orb-mini ${busy ? "is-busy" : ""}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {busy ? (
            <p role="status" aria-label="Donna is thinking" className="text-[13.5px] text-donna-muted">
              thinking…
            </p>
          ) : speaking ? (
            <p className={`text-[13.5px] leading-snug ${last.role === "error" ? "text-donna-red" : "text-donna-text"}`}>
              {last.content}
            </p>
          ) : waiting.length ? (
            <p className="text-[13.5px] text-donna-muted">
              {waiting.length === 1 ? "this one's on you:" : `${waiting.length} waiting on you:`}
            </p>
          ) : (
            <p className="text-[13.5px] text-donna-muted">what do you need?</p>
          )}
        </div>
      </div>

      {waiting.length > 0 && (
        <ul className="mt-3 flex flex-col gap-1.5">
          {waiting.map((r) => (
            <li key={r.id} className="flex items-center gap-2 text-[13px]">
              <button
                onClick={() => planStore.completeReminder(r.id)}
                aria-label={`Done: ${r.text}`}
                className="w-4 h-4 flex-none rounded-full border border-donna-muted hover:border-donna-text hover:bg-donna-raised transition-colors"
              />
              <span className="min-w-0 truncate">{r.text}</span>
            </li>
          ))}
        </ul>
      )}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          ref={input}
          id="orb-input"
          value={mic.listening && mic.heard ? mic.heard : text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Tell Donna"
          className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-donna-faint"
        />
        <button
          type="button"
          onClick={mic.toggle}
          disabled={!mic.supported}
          aria-pressed={mic.listening}
          aria-label={mic.supported ? "Talk to Donna" : "Dictation isn't available in this window"}
          className={`p-1 rounded ${!mic.supported ? "text-donna-faint/50" : mic.listening ? "text-donna-text" : "text-donna-muted hover:text-donna-text"}`}
        >
          <Mic size={14} />
        </button>
        <button type="button" onClick={brief} className="orb-chip">brief</button>
      </form>
    </div>
  );
}
