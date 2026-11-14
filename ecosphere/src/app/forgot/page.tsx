"use client";

import Link from "next/link";
import { useFormState } from "react-dom";
import { ChevronLeft } from "lucide-react";
import { requestReset } from "../actions";
import { LeafLogo } from "@/components/art";

export default function Forgot() {
  const [state, action] = useFormState(requestReset, undefined);
  return (
    <div className="flex min-h-screen flex-col gap-6 px-6 py-8">
      <Link href="/login" aria-label="Back" className="-ml-2 w-fit rounded-full p-2 hover:bg-card"><ChevronLeft /></Link>
      <div className="flex flex-col items-center gap-3 text-center">
        <LeafLogo size={64} />
        <h1 className="text-2xl font-semibold">Forgot Password?</h1>
        <p className="text-sm text-white/65">Enter your email or ID. Your school admin (or the EcoSphere team) will reset it and give you a temporary password.</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input name="email" required placeholder="Email / Student ID / Employee ID" aria-label="Email or ID" className="input py-3.5" />
        {(state?.error || state?.ok) && <p role="status" className={`text-sm ${state.error ? "text-red-400" : "text-leaf"}`}>{state.error ?? state.ok}</p>}
        <button className="btn py-3.5">Request reset</button>
      </form>
    </div>
  );
}
