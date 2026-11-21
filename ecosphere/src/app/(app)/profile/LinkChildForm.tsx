"use client";

import { useFormState } from "react-dom";
import { linkChild } from "../../actions";

export function LinkChildForm() {
  const [state, action] = useFormState(linkChild, undefined);
  return (
    <form action={action} className="space-y-1">
      <div className="flex gap-2">
        <input name="email" type="email" required placeholder="Link child by email" aria-label="Child email" className="input py-2" />
        <button className="btn shrink-0 px-4 py-2 text-sm">Link</button>
      </div>
      {(state?.error || state?.ok) && <p role="status" className={`text-xs ${state.error ? "text-red-400" : "text-leaf"}`}>{state.error ?? state.ok}</p>}
    </form>
  );
}
