"use client";

import { useState, useTransition } from "react";
import { resetPassword } from "@/app/actions";

export function ResetButton({ userId }: { userId: string }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <div className="flex flex-col items-end gap-1">
      <button className="chip" disabled={pending} onClick={() => start(async () => { const r = await resetPassword(userId); setMsg(r?.error ?? r?.ok); })}>
        {pending ? "…" : "Reset password"}
      </button>
      {msg && <p role="status" className="max-w-[14rem] select-all text-right text-[11px] text-leaf">{msg}</p>}
    </div>
  );
}
