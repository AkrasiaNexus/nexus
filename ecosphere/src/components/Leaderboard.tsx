"use client";

import { useState } from "react";
import { Critter } from "@/components/Critter";

export type BoardRow = { key: string; label: string; points: number; me: boolean; avatar?: string };

// Switches boards in place (no navigation, no scroll jump): sliding pill like the period tabs, rows re-stagger on change.
export function Leaderboard({ boards, initial }: { boards: Record<string, BoardRow[]>; initial: string }) {
  const names = Object.keys(boards);
  const [board, setBoard] = useState(names.includes(initial) ? initial : names[0]);
  const i = names.indexOf(board);
  return (
    <section className="card p-4">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-medium">EcoCreds leaderboard</h2>
        <div role="tablist" aria-label="Leaderboard" className="relative grid rounded-full border border-white/[.06] bg-panel p-0.5" style={{ gridTemplateColumns: `repeat(${names.length}, minmax(0, 1fr))` }}>
          <span aria-hidden className="slide-anim absolute inset-y-0.5 left-0.5 rounded-full bg-leaf transition-transform duration-[450ms] ease-[cubic-bezier(.16,1,.3,1)]"
            style={{ width: `calc((100% - 0.25rem) / ${names.length})`, transform: `translateX(${i * 100}%)` }} />
          {names.map((b) => (
            <button key={b} type="button" role="tab" aria-selected={b === board} onClick={() => setBoard(b)}
              className={`relative rounded-full px-3.5 py-1.5 text-xs transition-colors duration-200 ${b === board ? "font-semibold text-ink" : "text-white/75 hover:text-white"}`}>{b}</button>
          ))}
        </div>
      </div>
      {/* All lists share one grid cell, so the card keeps the tallest list's height and the page never jumps. */}
      <div className="grid">
        {names.map((b) => (
          <ol key={b} role="tabpanel" aria-hidden={b !== board} className={`space-y-2 [grid-area:1/1] ${b === board ? "stagger" : "invisible"}`}>
            {boards[b].map((r, n) => (
              <li key={r.key} className={`flex items-center gap-3 text-sm ${r.me ? "text-leaf" : ""}`}>
                <span className="w-5 text-mute">{n + 1}</span>
                <span className="flex flex-1 items-center gap-2">{r.avatar && <Critter avatar={r.avatar} size={22} />}{r.label}</span>
                <span className="tabular-nums">{r.points} EC</span>
              </li>
            ))}
            {boards[b].length === 0 && <li className="text-xs text-white/50">No rankings yet.</li>}
          </ol>
        ))}
      </div>
    </section>
  );
}
