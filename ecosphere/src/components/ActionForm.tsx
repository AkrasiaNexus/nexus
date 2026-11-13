"use client";

import { useFormState } from "react-dom";
import type { FormState } from "@/app/actions";

// Generic form wrapper: shows the action's error/ok message under the fields.
export function ActionForm({ action, children, submit, className = "" }: {
  action: (s: FormState, fd: FormData) => Promise<FormState>; children: React.ReactNode; submit: string; className?: string;
}) {
  const [state, run] = useFormState(action, undefined);
  return (
    <form action={run} className={`card flex flex-col gap-2 p-4 ${className}`}>
      {children}
      {(state?.error || state?.ok) && <p role="status" className={`text-xs ${state.error ? "text-red-400" : "text-leaf"}`}>{state.error ?? state.ok}</p>}
      <button className="btn py-2">{submit}</button>
    </form>
  );
}
