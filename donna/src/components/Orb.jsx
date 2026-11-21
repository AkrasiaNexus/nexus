import { useEffect, useRef, useState } from "react";
import { useDonna } from "../hooks/useDonna";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import { dailyBrief, unplanned } from "../lib/brief";
import { suggestions } from "../lib/suggest";
import { observations } from "../lib/patterns";
import { applyProposals } from "../lib/apply";
import { outstanding } from "../lib/remind";
import { unfinishedToday, shouldAskAboutToday } from "../lib/dayend";
import { useStore } from "../hooks/useStore";
import { today, nowMin, parseYmd, ymd } from "../lib/time";
import { hideThisWindow, resizeOrb, revealOrb } from "../lib/notify";

const RESTING = 72;
const TICK_MS = 20_000;
const OPEN_WIDTH = 380;
const CARD_MARGIN = 12;
// A floor, so a measurement taken before the webfont lands cannot clip the card.
const MIN_OPEN_HEIGHT = 108;

// The window is the orb, so it follows the content: a circle at rest, a card when it speaks.
// `wake` is in the deps on purpose: it remounts the card, so without it the observer would
// be left watching a node that is no longer in the document and the window would never grow.
function useWindowFitsContent(ref, open, wake) {
  useEffect(() => {
    if (!open) {
      resizeOrb(RESTING, RESTING);
      return undefined;
    }
    const fit = () => {
      const height = Math.ceil(ref.current?.getBoundingClientRect().height ?? 0) + CARD_MARGIN * 2;
      resizeOrb(OPEN_WIDTH, Math.max(MIN_OPEN_HEIGHT, height));
    };
    fit();
    const observer = new ResizeObserver(fit);
    if (ref.current) observer.observe(ref.current);
    return () => observer.disconnect();
  }, [ref, open, wake]);
}

function daysLeft(deadline) {
  const due = new Date(deadline);
  if (isNaN(due)) return "";
  const days = Math.round((parseYmd(ymd(due)) - parseYmd(today())) / 86_400_000);
  if (days < 0) return "overdue";
  return days === 0 ? "today" : `${days}d`;
}

export default function Orb() {
  const { thread, busy, say, tell } = useDonna();
  const [open, setOpen] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [now, setNow] = useState(Date.now());
  // Hiding the window doesn't unmount the page, so an entrance animation would only ever
  // play once. Showing it fires visibilitychange; bumping this key remounts the orb so it
  // wakes again on every press of the shortcut.
  const [wake, setWake] = useState(0);
  const [text, setText] = useState("");
  const plan = useStore(planStore);
  const items = useStore(itemStore);
  const card = useRef(null);
  const input = useRef(null);

  // The orb keeps its own clock. Hidden and idle it would never re-render, so a reminder's
  // moment would pass unnoticed — and it must not depend on the main window being open.
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const waiting = outstanding(plan.reminders ?? [], now);
  // What she'd raise before being asked: real empty time against something of yours that
  // has none of it. Shown when you open her, never pushed — a reminder earns an
  // interruption, an opinion does not.
  const ideas = suggestions({ items, plan, date: today(), nowMinutes: nowMin() });
  // What she'd have noticed on her own. She has the whole history; saying nothing about it
  // is the difference between a calendar and someone paying attention.
  const noticed = observations({ items, plan, date: today() });
  // Other people's deadlines, which don't move. These lead: your own work can slip a day,
  // an application that closes cannot.
  const applications = applyProposals({ plan, date: today(), nowMinutes: nowMin() });
  // A suggestion is the same thing with a slot and a reason attached, so anything she can
  // propose properly is not also listed as a bare title.
  const proposed = new Set(ideas.map((i) => i.item.id));
  const nothingBooked = unplanned(items, plan.blocks).filter((i) => !proposed.has(i.id));
  // The sweep will move these to tomorrow on its own. This is the chance to say "I did
  // that one" before it does, and it opens the orb by itself the way a reminder does.
  const asking = shouldAskAboutToday(plan, today(), nowMin());
  const unfinished = asking ? unfinishedToday(plan, today(), nowMin()) : [];
  const last = thread.at(-1);
  const speaking = last && last.role !== "user";
  // A reminder that fires pops the orb open where it sits, bottom-right. Dismissing
  // leaves the dot on the circle; only ticking it off clears it for good.
  const isOpen = open || busy || speaking || ((waiting.length > 0 || unfinished.length > 0) && !dismissed);

  const seen = useRef("");
  const ids = waiting.map((r) => r.id).join();
  useEffect(() => {
    if (ids && ids !== seen.current) {
      setDismissed(false);
      revealOrb(); // show the window itself: nothing pops up if it is still hidden
    }
    seen.current = ids;
  }, [ids]);

  useWindowFitsContent(card, isOpen, wake);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState !== "visible") return;
      setWake((n) => n + 1);
      setOpen(false);
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);

  useEffect(() => {
    if (open) input.current?.focus();
  }, [open]);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      if ((waiting.length || unfinished.length) && !dismissed) {
        setDismissed(true);
        if (unfinished.length) planStore.markAsked(today());
      }
      if (open) setOpen(false);
      else if (!waiting.length && !unfinished.length) hideThisWindow();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, waiting.length, unfinished.length, dismissed]);

  function submit(e) {
    e.preventDefault();
    const asked = text.trim();
    if (!asked || busy) return;
    setText("");
    say(asked);
  }

  function brief() {
    const current = planStore.getAll();
    const { text: line } = dailyBrief({
      items: itemStore.getAll(),
      plan: current,
      date: today(),
      nowMinutes: nowMin(),
      // only what last night turned up, so the brief reads as news rather than a backlog
      newFindings: current.researchedOn === today() ? current.findings.filter((f) => f.foundOn === today()) : undefined,
    });
    tell("what's my day looking like", line);
  }

  if (!isOpen) {
    return (
      <div className="h-screen flex items-center justify-center">
        <button
          key={wake}
          onClick={() => { setOpen(true); setDismissed(false); }}
          aria-label={waiting.length ? `Ask Donna — ${waiting.length} waiting` : "Ask Donna"}
          className={`orb ${waiting.length ? "has-waiting" : ""}`}
        />
      </div>
    );
  }

  return (
    <div key={wake} ref={card} className="orb-card">
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

      {unfinished.length > 0 && (
        <>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-donna-faint">did you get to these?</p>
          <ul className="orb-waiting mt-1.5 flex flex-col gap-1.5">
            {unfinished.map((b, i) => (
              <li key={b.id} style={{ "--i": i }} className="flex items-center gap-2 text-[13px]">
                <button
                  onClick={() => planStore.complete(b.id)}
                  aria-label={`Done: ${b.title}`}
                  className="w-4 h-4 flex-none rounded-full border border-donna-muted hover:border-donna-text hover:bg-donna-raised active:scale-90 transition-all duration-150"
                />
                <span className="min-w-0 flex-1 truncate">{b.title}</span>
                <span className="flex-none font-mono text-[10px] text-donna-faint">{b.start}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      {waiting.length > 0 && (
        <ul className="orb-waiting mt-3 flex flex-col gap-1.5">
          {waiting.map((r, i) => (
            <li key={r.id} style={{ "--i": i }} className="flex items-center gap-2 text-[13px]">
              <button
                onClick={() => planStore.completeReminder(r.id)}
                aria-label={`Done: ${r.text}`}
                className="w-4 h-4 flex-none rounded-full border border-donna-muted hover:border-donna-text hover:bg-donna-raised active:scale-90 transition-all duration-150"
              />
              <span className="min-w-0 truncate">{r.text}</span>
            </li>
          ))}
        </ul>
      )}

      {applications.length > 0 && unfinished.length === 0 && (
        <ul className="orb-waiting mt-3 flex flex-col gap-2">
          {applications.map((p, i) => (
            <li key={p.finding.id} style={{ "--i": i }} className="flex items-start gap-2 text-[13px] leading-snug">
              <span className="mt-1.5 w-1 h-1 flex-none rounded-full bg-donna-text" />
              <span className="min-w-0 flex-1">
                {p.finding.title} closes {p.finding.deadline}. {p.slot.date === today() ? "today" : p.slot.date} at {p.slot.start}?
              </span>
              <button onClick={() => planStore.blockForFinding(p.finding.id, { title: p.title, ...p.slot })} className="orb-chip flex-none">
                block it
              </button>
              <button
                onClick={() => planStore.dismissFinding(p.finding.id)}
                aria-label={`Not interested: ${p.finding.title}`}
                className="flex-none px-1 text-donna-faint hover:text-donna-muted"
              >
                ×
              </button>
            </li>
          ))}
        </ul>
      )}

      {noticed.length > 0 && unfinished.length === 0 && (
        <ul className="orb-waiting mt-3 flex flex-col gap-2">
          {noticed.map((o, i) => (
            <li key={o.kind + o.itemId} style={{ "--i": i }} className="flex items-start gap-2 text-[13px] leading-snug">
              <span className={`mt-1.5 w-1 h-1 flex-none rounded-full ${o.kind === "streak" ? "bg-donna-text" : "bg-donna-muted"}`} />
              <span className="min-w-0 flex-1">{o.text}</span>
            </li>
          ))}
        </ul>
      )}

      {ideas.length > 0 && unfinished.length === 0 && (
        <ul className="orb-waiting mt-3 flex flex-col gap-2">
          {ideas.map((idea, i) => (
            <li key={idea.item.id} style={{ "--i": i }} className="flex items-start gap-2 text-[13px]">
              <span className={`mt-1.5 w-1 h-1 flex-none rounded-full ${idea.item.forProfile ? "bg-donna-text" : "bg-donna-muted"}`} />
              <span className="min-w-0 flex-1 leading-snug">{idea.reason}</span>
              <button
                onClick={() => say(`book ${idea.item.title} ${idea.slot.date} at ${idea.slot.start} for ${idea.slot.minutes} minutes`)}
                disabled={busy}
                className="orb-chip flex-none disabled:opacity-40"
              >
                book it
              </button>
            </li>
          ))}
        </ul>
      )}

      {nothingBooked.length > 0 && (
        <>
          <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-donna-faint">nothing booked</p>
          <ul className="orb-waiting mt-1.5 flex flex-col gap-1.5">
            {nothingBooked.slice(0, 4).map((goal, i) => (
              <li key={goal.id} style={{ "--i": i }} className="flex items-center gap-2 text-[13px]">
                <span className="min-w-0 flex-1 truncate">{goal.title}</span>
                <span className="flex-none font-mono text-[10px] text-donna-faint">{daysLeft(goal.deadline)}</span>
                <button
                  onClick={() => say(`slot in ${goal.title}`)}
                  disabled={busy}
                  className="orb-chip flex-none disabled:opacity-40"
                >
                  plan
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <form onSubmit={submit} className="mt-3 flex items-center gap-2">
        <input
          ref={input}
          id="orb-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          aria-label="Tell Donna"
          className="flex-1 min-w-0 bg-transparent text-[13.5px] outline-none placeholder:text-donna-faint"
        />
        <button type="button" onClick={brief} className="orb-chip">brief</button>
      </form>
    </div>
  );
}
