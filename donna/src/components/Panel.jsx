import { useEffect, useState } from "react";
import CaptureInput from "./CaptureInput";
import { planStore } from "../stores/planStore";
import { useStore } from "../hooks/useStore";
import { useDonna } from "../hooks/useDonna";
import { blockStartMs } from "../lib/reminders";
import { getReminderMessage } from "../lib/nudgeMessages";
import { hideThisWindow } from "../lib/notify";

const MINUTE_MS = 60_000;
const TICK_MS = 30_000;

const minutesUntil = (block, now) => Math.round((blockStartMs(block) - now) / MINUTE_MS);

export default function Panel() {
  const plan = useStore(planStore);
  const { thread, busy, say } = useDonna();
  const [now, setNow] = useState(Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), TICK_MS);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && hideThisWindow();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const upcoming = planStore.upcoming(4);
  const [next, ...later] = upcoming;
  const backlog = plan.blocks.filter((b) => b.isBacklog && !b.done).length;

  return (
    <div className="h-screen flex flex-col bg-donna-bg text-donna-text select-none">
      <header className="flex items-baseline justify-between px-4 pt-4 pb-2">
        <span className="font-bold text-donna-accent">donna</span>
        {backlog > 0 && (
          <span className="text-[11px] font-mono text-donna-orange">{backlog} backlog</span>
        )}
      </header>

      <div className="flex-1 overflow-y-auto px-4 space-y-3">
        {next ? (
          <HeadlineBlock block={next} now={now} />
        ) : (
          <p className="text-sm text-donna-muted py-6">nothing booked. dump something below.</p>
        )}

        {later.length > 0 && (
          <ul className="space-y-1.5 pt-1">
            {later.map((b) => (
              <li key={b.id} className="flex items-baseline gap-2 text-sm">
                <span className="font-mono text-xs text-donna-muted shrink-0">{b.start}</span>
                <span className="truncate">{b.title}</span>
                {b.isBacklog && <span className="text-[10px] font-mono text-donna-orange shrink-0">backlog</span>}
              </li>
            ))}
          </ul>
        )}
      </div>

      <Exchange thread={thread} busy={busy} />

      <div className="p-3 border-t border-donna-border">
        <CaptureInput autoFocus onSubmit={say} busy={busy} />
      </div>
    </div>
  );
}

function HeadlineBlock({ block, now }) {
  const mins = minutesUntil(block, now);

  return (
    <div className="pt-1">
      <p className="text-base leading-snug">{getReminderMessage(block.title, mins)}</p>
      <div className="flex items-center gap-2 mt-3">
        <button
          onClick={() => planStore.complete(block.id)}
          className="px-3 py-1.5 rounded-lg text-xs font-bold bg-donna-accent/15 text-donna-accent hover:bg-donna-accent/25 transition-colors"
        >
          done
        </button>
        <button
          onClick={() => planStore.remove(block.id)}
          className="px-3 py-1.5 rounded-lg text-xs text-donna-muted hover:text-donna-red transition-colors"
        >
          drop
        </button>
        <span className="ml-auto font-mono text-xs text-donna-muted">
          {block.start} · {block.minutes}m
        </span>
      </div>
    </div>
  );
}

const BUBBLE = {
  user: "text-donna-muted",
  assistant: "text-donna-text",
  error: "text-donna-red",
};

// Only the latest back-and-forth: the panel is a glance, not a chat log.
function Exchange({ thread, busy }) {
  const lastUser = thread.findLastIndex((m) => m.role === "user");
  if (lastUser === -1) return null;
  const shown = thread.slice(lastUser);

  return (
    <div className="px-4 py-3 space-y-1.5 text-sm border-t border-donna-border" aria-live="polite">
      {shown.map((m, i) => (
        <p key={i} className={BUBBLE[m.role]}>{m.content}</p>
      ))}
      {busy && (
        <div role="status" aria-label="Donna is thinking" className="flex gap-1 py-1">
          {[0, 150, 300].map((delay) => (
            <span key={delay} className="w-1.5 h-1.5 rounded-full bg-donna-accent animate-bounce" style={{ animationDelay: `${delay}ms` }} />
          ))}
        </div>
      )}
    </div>
  );
}
