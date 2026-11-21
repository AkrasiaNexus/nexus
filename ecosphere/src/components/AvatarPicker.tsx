"use client";

import { useTransition } from "react";
import { Shuffle } from "lucide-react";
import { setAvatar } from "@/app/actions";
import { AVATAR_PRESETS, Critter, randomAvatar } from "./Critter";

// Preset characters plus a shuffle through every combination; saving happens on the server (validated there).
export function AvatarPicker({ current, limit }: { current: string; limit?: number }) {
  const [pending, start] = useTransition();
  const choices = Array.from(new Set([current, ...AVATAR_PRESETS])).slice(0, limit);
  const pick = (a: string) => start(() => setAvatar(a));
  return (
    <div className={`grid gap-3 ${limit ? "grid-cols-4" : "grid-cols-4 sm:grid-cols-6"}`} aria-busy={pending}>
      {choices.map((a, i) => (
        <button key={a} type="button" onClick={() => pick(a)} disabled={pending} aria-label={`Use character ${i + 1}`} aria-pressed={a === current}
          className={`press grid aspect-square w-full place-items-center rounded-2xl bg-panel p-1.5 transition-shadow ${a === current ? "ring-2 ring-leaf" : "hover:ring-1 hover:ring-white/20"}`}>
          <Critter avatar={a} size={64} className="h-full w-full" />
        </button>
      ))}
      <button type="button" onClick={() => pick(randomAvatar())} disabled={pending}
        className="press grid aspect-square w-full place-items-center gap-1 rounded-2xl border border-dashed border-white/20 text-xs text-mute hover:border-leaf hover:text-leaf">
        <span className="grid place-items-center gap-1"><Shuffle size={20} className={pending ? "animate-spin motion-reduce:animate-none" : ""} />Shuffle</span>
      </button>
    </div>
  );
}
