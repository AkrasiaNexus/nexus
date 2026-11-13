"use client";

import { useState } from "react";
import { useFormState } from "react-dom";
import { Header } from "@/components/ui";
import { createListing } from "../../../feature-actions";

const EMOJIS = ["📦", "📚", "👕", "🧸", "🪑", "🚲", "🔌", "🪴", "🎒", "🍳"];

export default function NewListing() {
  const [state, action] = useFormState(createListing, undefined);
  const [kind, setKind] = useState("DONATE");
  return (
    <>
      <Header title="New listing" back="/marketplace" />
      <form action={action} className="flex flex-col gap-3 px-5">
        <fieldset className="flex gap-2">
          <legend className="mb-2 text-xs text-mute">What do you want to do?</legend>
          {[["DONATE", "Donate (free)"], ["SELL", "Sell for points"], ["EXCHANGE", "Swap"]].map(([k, v]) => (
            <label key={k} className={`chip cursor-pointer ${kind === k ? "chip-on" : ""}`}>
              <input type="radio" name="kind" value={k} checked={kind === k} onChange={() => setKind(k)} className="sr-only" />{v}
            </label>
          ))}
        </fieldset>
        <input name="title" required maxLength={60} placeholder="Item name" aria-label="Item name" className="input" />
        <textarea name="description" required maxLength={200} rows={3} placeholder="Condition, size, where to collect…" aria-label="Description" className="input" />
        <select name="category" aria-label="Category" className="input"><option>Reuse</option><option>Donate</option><option>Others</option></select>
        {kind === "SELL" && <input name="pricePoints" type="number" min="1" max="1000" required placeholder="Price in points" aria-label="Price in points" className="input" />}
        <fieldset className="flex flex-wrap gap-2">
          <legend className="mb-2 text-xs text-mute">Icon</legend>
          {EMOJIS.map((e, i) => (
            <label key={e} className="cursor-pointer">
              <input type="radio" name="emoji" value={e} defaultChecked={i === 0} className="peer sr-only" />
              <span className="grid h-10 w-10 place-items-center rounded-full bg-card text-xl peer-checked:ring-2 peer-checked:ring-leaf">{e}</span>
            </label>
          ))}
        </fieldset>
        <p className="text-xs text-mute">Only post safe, clean items. Meet in a public place or hand over at school.</p>
        {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button className="btn">Publish</button>
      </form>
    </>
  );
}
