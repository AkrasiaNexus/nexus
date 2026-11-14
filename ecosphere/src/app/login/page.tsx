"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Eye, EyeOff } from "lucide-react";
import { login } from "../actions";
import { LeafLogo } from "@/components/art";

const DEMO = [
  ["Student", "ayaan@eco.demo"], ["Parent", "sara@eco.demo"], ["Employee", "rohan@eco.demo"],
  ["Teacher", "daniel@eco.demo"], ["Health Monitor", "nurse@eco.demo"], ["Community", "community@eco.demo"],
  ["School Admin*", "priya@eco.demo"], ["Super Admin*", "admin@eco.demo"],
];

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn w-full py-3.5" disabled={pending}>{pending ? "Logging in…" : "Log In"}</button>;
}

export default function Login() {
  const [state, action] = useFormState(login, undefined);
  const [show, setShow] = useState(false);
  return (
    <div className="flex min-h-screen flex-col gap-8 px-6 pb-10 pt-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <LeafLogo size={84} />
        <h1 className="text-3xl font-semibold">EcoSphere AI</h1>
        <p className="text-white/75">Welcome back!</p>
      </div>
      <form action={action} className="flex flex-col gap-4">
        <input name="email" required autoComplete="username" placeholder="Email / Student ID / Employee ID" aria-label="Email, Student ID or Employee ID" className="input py-3.5" />
        <div className="relative">
          <input name="password" type={show ? "text" : "password"} required autoComplete="current-password" placeholder="Password" aria-label="Password" className="input py-3.5 pr-12" />
          <button type="button" onClick={() => setShow((v) => !v)} aria-label={show ? "Hide password" : "Show password"} className="absolute right-3 top-3 p-1 text-white/60">
            {show ? <EyeOff size={20} /> : <Eye size={20} />}
          </button>
        </div>
        <input name="adminCode" autoComplete="off" placeholder="Admin Code (Optional)" aria-label="Admin Code (optional, admins only)" className="input py-3.5" />
        <div className="flex items-center justify-between text-sm">
          <label className="flex items-center gap-2 text-white/75"><input type="checkbox" name="remember" defaultChecked className="h-4 w-4 accent-[#86d67e]" />Remember Me</label>
          <Link href="/forgot" className="text-leaf">Forgot Password?</Link>
        </div>
        {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <Submit />
      </form>
      <p className="text-center text-sm text-white/60">New here? <Link href="/signup" className="text-leaf">Create an account</Link></p>
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer text-leaf">Demo accounts (password: eco12345)</summary>
        <ul className="mt-2 space-y-1 text-white/60">
          {DEMO.map(([role, email]) => <li key={email}><span className="text-white">{role}:</span> {email}</li>)}
          <li className="pt-1 text-xs">* Admin Code: ECO-ADMIN</li>
        </ul>
      </details>
    </div>
  );
}
