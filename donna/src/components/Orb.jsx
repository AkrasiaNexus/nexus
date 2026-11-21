import { useEffect, useRef, useState } from "react";
import { useDonna } from "../hooks/useDonna";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import { dailyBrief } from "../lib/brief";
import { today, nowMin } from "../lib/time";
import { hideThisWindow, resizeOrb } from "../lib/notify";

const RESTING = 72;
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
  const [text, setText] = useState("");
  const card = useRef(null);
  const input = useRef(null);

  const last = thread.at(-1);
  const speaking = last && last.role !== "user";
  const isOpen = open || busy || speaking;

  useWindowFitsContent(card, isOpen);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if (open) setOpen(false);
      else hideThisWindow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open]);

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
        <button onClick={() => setOpen(true)} aria-label="Ask Donna" className="orb" />
      </div>
    );
  }

  return (
    <div ref={card} className="orb-card">
      <div className="flex items-start gap-3">
        <span className={`orb-mini ${busy ? "is-busy" : ""}`} aria-hidden="true" />
        <div className="min-w-0 flex-1">
          {speaking ? (
            <p className={`text-[13.5px] leading-snug ${last.role === "error" ? "text-donna-red" : "text-donna-text"}`}>
              {last.content}
            </p>
          ) : (
            <p className="text-[13.5px] text-donna-muted">{busy ? "thinking…" : "what do you need?"}</p>
          )}
        </div>
      </div>

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          ref={input}
          id="orb-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="tell donna…"
          className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-donna-faint"
        />
        <button type="button" onClick={brief} className="orb-chip">brief</button>
      </form>
    </div>
  );
}
