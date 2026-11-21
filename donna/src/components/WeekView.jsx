import { useEffect, useRef, useState } from "react";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import { useStore } from "../hooks/useStore";
import { weekOf, today, nowMin, toMin, parseYmd, addDays, WEEKDAYS } from "../lib/time";
import { DAY_START, DAY_END } from "../lib/schedule";

const HOUR_PX = 42;
const SHORT_SESSION = 50;
const TICK_MS = 60_000;

const CATEGORY = { skill: "cat-skill", idea: "cat-idea", task: "cat-task", habit: "cat-habit", explore: "cat-explore" };
const yFor = (minutes) => ((minutes - DAY_START) / 60) * HOUR_PX;

export default function WeekView() {
  const plan = useStore(planStore);
  const items = useStore(itemStore);
  const [offset, setOffset] = useState(0);
  const [minuteNow, setMinuteNow] = useState(nowMin());
  const scroller = useRef(null);

  useEffect(() => {
    const id = setInterval(() => setMinuteNow(nowMin()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  const days = weekOf(addDays(today(), offset * 7));

  // School fills the morning, so opening at 07:00 hides the evening, which is where
  // the week actually happens. Start the view near now, or near the first session.
  useEffect(() => {
    const box = scroller.current;
    if (!box) return;
    const sessions = planStore.getAll().blocks.filter((b) => days.includes(b.date));
    const earliest = sessions.length ? Math.min(...sessions.map((b) => toMin(b.start))) : DAY_START;
    const focus = offset === 0 ? Math.min(nowMin(), earliest) : earliest;
    box.scrollTop = Math.max(0, yFor(focus) - box.clientHeight / 3);
  }, [offset]);

  const categoryOf = (block) => CATEGORY[items.find((i) => i.id === block.itemId)?.category] ?? "cat-task";
  const booked = plan.blocks.filter((b) => days.includes(b.date) && !b.done).reduce((total, b) => total + b.minutes, 0);

  return (
    <section className="flex-1 min-h-0 flex flex-col gap-3">
      <header className="flex items-baseline gap-3">
        <h1 className="text-lg font-semibold tracking-tight">{offset === 0 ? "This week" : label(days)}</h1>
        <span className="text-xs text-donna-muted">
          {label(days)} · {hours(booked)} booked
        </span>
        <nav className="ml-auto flex items-center gap-1">
          <Step onClick={() => setOffset(offset - 1)} label="Previous week">‹</Step>
          {offset !== 0 && <Step onClick={() => setOffset(0)} label="This week">today</Step>}
          <Step onClick={() => setOffset(offset + 1)} label="Next week">›</Step>
        </nav>
      </header>

      <div ref={scroller} className="flex-1 min-h-0 overflow-auto rounded-lg border border-donna-border bg-donna-surface">
        <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `36px repeat(7, minmax(92px, 1fr))` }}>
          <Gutter />
          {days.map((date) => (
            <Day
              key={date}
              date={date}
              plan={plan}
              categoryOf={categoryOf}
              minuteNow={date === today() ? minuteNow : null}
            />
          ))}
        </div>
      </div>
    </section>
  );
}

function Step({ onClick, label, children }) {
  return (
    <button
      onClick={onClick}
      aria-label={label}
      className="px-2 py-1 rounded text-xs text-donna-muted hover:text-donna-text hover:bg-donna-raised transition-colors"
    >
      {children}
    </button>
  );
}

function Gutter() {
  const hoursList = [];
  for (let h = DAY_START / 60; h <= DAY_END / 60; h++) hoursList.push(h);

  return (
    <div className="relative border-r border-donna-border">
      <div className="h-[38px]" />
      {hoursList.map((h) => (
        <span
          key={h}
          className="absolute right-1.5 -translate-y-1/2 font-mono text-[9.5px] text-donna-faint"
          style={{ top: yFor(h * 60) + 38 }}
        >
          {String(h).padStart(2, "0")}
        </span>
      ))}
    </div>
  );
}

function Day({ date, plan, categoryOf, minuteNow }) {
  const weekday = parseYmd(date).getDay();
  // A weekly commitment and an event off the subscribed calendar are immovable in the same
  // way, and neither is something Donna chose, so they draw alike.
  const commitments = [
    ...plan.fixed
      .filter((f) => f.days.includes(weekday))
      .map((f) => ({ id: f.id, title: f.title, start: f.start, minutes: toMin(f.end) - toMin(f.start) })),
    ...(plan.events ?? [])
      .filter((e) => e.date === date)
      .map((e) => ({ id: e.id, title: e.title, start: e.start, minutes: e.minutes })),
  ];
  const sessions = plan.blocks.filter((b) => b.date === date);
  const rows = (DAY_END - DAY_START) / 60;

  return (
    <div className="relative border-r border-donna-border last:border-r-0">
      <div className={`sticky top-0 z-10 h-[38px] bg-donna-surface border-b border-donna-border text-center text-xs ${minuteNow !== null ? "text-donna-text font-semibold" : "text-donna-muted"}`}>
        {WEEKDAYS[weekday]}
        <span className="block font-mono text-[9.5px] text-donna-faint">{parseYmd(date).getDate()}</span>
      </div>

      <div className="relative">
        {Array.from({ length: rows }, (_, i) => (
          <div key={i} className="h-[42px] border-b border-donna-border/40" />
        ))}

        {commitments.map((c) => (
          <div
            key={c.id}
            className="absolute left-[3px] right-[3px] rounded px-1.5 py-1 overflow-hidden text-donna-faint text-[11px] leading-tight border-l-2 border-donna-border bg-[repeating-linear-gradient(135deg,#ffffff0a_0_4px,transparent_4px_8px)]"
            style={{ top: yFor(toMin(c.start)), height: (c.minutes / 60) * HOUR_PX - 2 }}
          >
            <span className="block truncate">{c.title}</span>
          </div>
        ))}

        {sessions.map((b) => (
          <Session key={b.id} block={b} category={categoryOf(b)} />
        ))}

        {minuteNow !== null && minuteNow >= DAY_START && minuteNow <= DAY_END && (
          <div className="absolute -left-0.5 right-0 h-px bg-donna-red z-20" style={{ top: yFor(minuteNow) }}>
            <span className="absolute -left-[3px] -top-[2.5px] w-1.5 h-1.5 rounded-full bg-donna-red" />
          </div>
        )}
      </div>
    </div>
  );
}

function Session({ block, category }) {
  const short = block.minutes < SHORT_SESSION;

  return (
    <button
      onClick={() => (block.done ? planStore.undo(block.id) : planStore.complete(block.id))}
      title={`${block.start} · ${block.minutes}m — click to ${block.done ? "undo" : "tick off"}`}
      className={`absolute left-[3px] right-[3px] rounded px-1.5 py-1 overflow-hidden text-left text-[11px] leading-tight border-l-2 ${category} ${block.done ? "opacity-40" : ""}`}
      style={{ top: yFor(toMin(block.start)), height: (block.minutes / 60) * HOUR_PX - 2 }}
    >
      <span className={`block truncate font-medium ${block.done ? "line-through" : ""}`}>{block.title}</span>
      <span className={`font-mono text-[9px] text-donna-muted ${short ? "ml-1" : "block"}`}>
        {block.start} · {block.minutes}m
      </span>
      {block.isBacklog && !block.done && (
        <span className="ml-1 font-mono text-[8.5px] text-donna-muted border border-donna-border rounded px-1">backlog</span>
      )}
    </button>
  );
}

const hours = (minutes) => (minutes < 60 ? `${minutes}m` : `${Math.floor(minutes / 60)}h${minutes % 60 ? ` ${minutes % 60}m` : ""}`);

const label = (days) => {
  const from = parseYmd(days[0]);
  const to = parseYmd(days[6]);
  const month = (d) => d.toLocaleDateString(undefined, { month: "short" });
  return `${month(from)} ${from.getDate()} – ${from.getMonth() === to.getMonth() ? "" : `${month(to)} `}${to.getDate()}`;
};
