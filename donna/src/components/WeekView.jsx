import { useEffect, useRef, useState } from "react";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import { useStore } from "../hooks/useStore";
import { weekOf, today, nowMin, toMin, parseYmd, addDays, ymd, fromMin, clock12, WEEKDAYS } from "../lib/time";
import { DAY_START, DAY_END } from "../lib/schedule";
import { unplanned } from "../lib/brief";

const HOUR_PX = 42;
const SHORT_SESSION = 50;
const TICK_MS = 60_000;

const CATEGORY = { skill: "cat-skill", idea: "cat-idea", task: "cat-task", habit: "cat-habit", explore: "cat-explore" };
const yFor = (minutes) => ((minutes - DAY_START) / 60) * HOUR_PX;
// Anything outside the drawn hours sits on the nearest edge rather than off the page.
const onPage = (minutes) => Math.min(DAY_END, Math.max(DAY_START, minutes));
const minuteOf = (date) => date.getHours() * 60 + date.getMinutes();
// Names in the summary line before it becomes a list nobody reads.
const MOST_NAMED = 3;

function dueIn(deadline) {
  const days = Math.round((parseYmd(ymd(new Date(deadline))) - parseYmd(today())) / 86_400_000);
  if (days < 0) return "overdue";
  if (days === 0) return "due today";
  return days === 1 ? "due tomorrow" : `due in ${days} days`;
}

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

  const goalOf = (block) => items.find((i) => i.id === block.itemId);
  const booked = plan.blocks.filter((b) => days.includes(b.date) && !b.done).reduce((total, b) => total + b.minutes, 0);

  // Detail is drawn on the week itself rather than in a panel beside it: when things are due,
  // when reminders land, and — only if there is any — what has no time booked at all.
  const deadlines = items
    .filter((i) => i.status === "active")
    .map((i) => ({ id: i.id, title: i.title, at: new Date(i.deadline) }))
    .filter((d) => !isNaN(d.at) && days.includes(ymd(d.at)));
  const now = Date.now();
  const reminders = (plan.reminders ?? [])
    .filter((r) => !r.done && r.at !== null)
    .map((r) => ({ ...r, when: new Date(r.at), fired: r.at <= now }))
    .filter((r) => days.includes(ymd(r.when)));
  const notBooked = unplanned(items, plan.blocks);
  const named = notBooked.slice(0, MOST_NAMED).map((i) => i.title).join(", ");
  const more = notBooked.length > MOST_NAMED ? ` +${notBooked.length - MOST_NAMED}` : "";

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

      {notBooked.length > 0 && <p className="-mt-2 text-xs text-donna-muted truncate">{`not booked: ${named}${more}`}</p>}

      <div ref={scroller} className="flex-1 min-h-0 overflow-auto rounded-lg border border-donna-border bg-donna-surface">
        <div className="grid min-w-[700px]" style={{ gridTemplateColumns: `36px repeat(7, minmax(92px, 1fr))` }}>
          <Gutter />
          {days.map((date) => (
            <Day
              key={date}
              date={date}
              plan={plan}
              goalOf={goalOf}
              deadlines={deadlines.filter((d) => ymd(d.at) === date)}
              reminders={reminders.filter((r) => ymd(r.when) === date)}
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
          {clock12(fromMin(h * 60))}
        </span>
      ))}
    </div>
  );
}

function Day({ date, plan, goalOf, deadlines, reminders, minuteNow }) {
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
          <Session key={b.id} block={b} goal={goalOf(b)} />
        ))}

        {deadlines.map((d) => (
          <div
            key={d.id}
            className="absolute left-0 right-0 z-10 border-t border-dashed border-donna-muted pointer-events-none"
            style={{ top: yFor(onPage(minuteOf(d.at))) }}
          >
            <span className="absolute right-1 bottom-[2px] max-w-[90%] truncate font-mono text-[9px] leading-none text-donna-muted">
              {`due · ${d.title}`}
            </span>
          </div>
        ))}

        {reminders.map((r) => (
          <span
            key={r.id}
            role="img"
            aria-label={`reminder ${clock12(fromMin(minuteOf(r.when)))} — ${r.text}`}
            title={`${clock12(fromMin(minuteOf(r.when)))} · ${r.text}${r.fired ? " — waiting to be ticked off" : ""}`}
            className={`absolute left-[2px] z-20 w-[7px] h-[7px] -translate-y-1/2 rounded-full border border-donna-muted ${r.fired ? "bg-donna-muted" : "bg-donna-surface"}`}
            style={{ top: yFor(onPage(minuteOf(r.when))) }}
          />
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

function Session({ block, goal }) {
  const short = block.minutes < SHORT_SESSION;
  const category = CATEGORY[goal?.category] ?? "cat-task";
  // The hover is where the rest lives: which goal this is for, how much it matters, how close.
  const about = goal
    ? ` · for ${goal.title}${goal.priority ? ` · ${goal.priority} priority` : ""} · ${dueIn(goal.deadline)}`
    : "";

  return (
    <button
      onClick={() => (block.done ? planStore.undo(block.id) : planStore.complete(block.id))}
      title={`${clock12(block.start)} · ${block.minutes}m${about} — click to ${block.done ? "undo" : "tick off"}`}
      className={`absolute left-[3px] right-[3px] rounded px-1.5 py-1 overflow-hidden text-left text-[11px] leading-tight border-l-2 ${category} ${block.done ? "opacity-40" : ""}`}
      style={{ top: yFor(toMin(block.start)), height: (block.minutes / 60) * HOUR_PX - 2 }}
    >
      <span className={`block truncate font-medium ${block.done ? "line-through" : ""}`}>{block.title}</span>
      <span className={`font-mono text-[9px] text-donna-muted ${short ? "ml-1" : "block"}`}>
        {clock12(block.start)} · {block.minutes}m
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
