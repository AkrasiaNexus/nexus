"use client";

import { useFormState } from "react-dom";
import { broadcast } from "@/app/actions";

export function BroadcastForm({ audience }: { audience: string }) {
  const [state, action] = useFormState(broadcast, undefined);
  return (
    <form id="broadcast" action={action} className="card flex flex-col gap-2 p-4">
      <h2 className="text-sm font-medium">Send a notification to {audience}</h2>
      <select name="kind" className="input" aria-label="Type" defaultValue="ANNOUNCEMENT">
        <option value="ANNOUNCEMENT">Announcement</option><option value="PICKUP">Waste pickup</option>
        <option value="CHALLENGE">Challenge</option><option value="EVENT">Event</option>
      </select>
      <input name="title" required maxLength={80} placeholder="Title" aria-label="Title" className="input" />
      <textarea name="body" required maxLength={280} rows={2} placeholder="Message" aria-label="Message" className="input" />
      {(state?.error || state?.ok) && <p role="status" className={`text-xs ${state.error ? "text-red-400" : "text-leaf"}`}>{state.error ?? state.ok}</p>}
      <button className="btn py-2">Send</button>
    </form>
  );
}
