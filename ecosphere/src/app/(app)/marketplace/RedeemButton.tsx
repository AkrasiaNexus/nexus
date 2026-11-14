"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { redeem } from "../../actions";

export function RedeemButton({ id, disabled, label = "Redeem" }: { id: string; disabled: boolean; label?: string }) {
  const [pending, start] = useTransition();
  const [error, setError] = useState<string>();
  const router = useRouter();
  return (
    <>
      <button className="btn w-full py-3.5" disabled={disabled || pending}
        onClick={() => start(async () => {
          const r = await redeem(id);
          // Claimed peer items disappear from the grid, so confirm on the history page instead.
          if (r?.ok) router.push(`/history?t=Marketplace&msg=${encodeURIComponent(r.ok)}`);
          else setError(r?.error);
        })}>
        {pending ? "…" : label}
      </button>
      {error && <p role="status" className="text-center text-sm text-red-400">{error}</p>}
    </>
  );
}
