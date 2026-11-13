"use client";

import { useFormState } from "react-dom";
import { logFood } from "../../feature-actions";
import { FOOD_CATEGORIES, FOOD_DISPOSALS, FOOD_REASONS } from "@/lib/food";

const options = (o: Record<string, string>) => Object.entries(o).map(([k, v]) => <option key={k} value={k}>{v}</option>);

export function FoodForm() {
  const [state, action] = useFormState(logFood, undefined);
  return (
    <form action={action} className="card grid grid-cols-2 gap-2 p-4">
      <h2 className="col-span-2 text-sm font-medium">Log food waste</h2>
      <input name="item" required maxLength={60} placeholder="What? e.g. rice" aria-label="Food item" className="input col-span-2" />
      <select name="category" required aria-label="Category" className="input col-span-2">{options(FOOD_CATEGORIES)}</select>
      <input name="kg" type="number" step="0.01" min="0.01" max="100" required placeholder="kg" aria-label="Weight in kg" className="input" defaultValue="0.2" />
      <select name="reason" aria-label="Reason" className="input">{options(FOOD_REASONS)}</select>
      <select name="disposal" aria-label="Disposal" className="input col-span-2" defaultValue="COMPOST">{options(FOOD_DISPOSALS)}</select>
      {(state?.error || state?.ok) && <p role="status" className={`col-span-2 text-xs ${state.error ? "text-red-400" : "text-leaf"}`}>{state.error ?? state.ok}</p>}
      <button className="btn col-span-2 py-2">Log it</button>
    </form>
  );
}
