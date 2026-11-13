"use client";

import { useState, useTransition } from "react";
import { redeem } from "../../actions";

export function RedeemButton({ id, disabled }: { id: string; disabled: boolean }) {
  const [pending, start] = useTransition();
  const [msg, setMsg] = useState<string>();
  return (
    <>
      <button className="btn py-2 text-xs" disabled={disabled || pending}
        onClick={() => start(async () => { const r = await redeem(id); setMsg(r?.error ?? r?.ok); })}>
        {pending ? "…" : "Redeem"}
      </button>
      {msg && <p role="status" className="text-center text-[11px] text-leaf">{msg}</p>}
    </>
  );
}
