"use client";

import Link from "next/link";
import { useFormState, useFormStatus } from "react-dom";
import { login } from "../actions";
import { Logo } from "@/components/Logo";

const DEMO = [
  ["Student", "ayaan@eco.demo"], ["Parent", "sara@eco.demo"], ["Employee", "rohan@eco.demo"],
  ["School Admin", "priya@eco.demo"], ["Community", "community@eco.demo"], ["Super Admin", "admin@eco.demo"],
];

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn w-full" disabled={pending}>{pending ? "Logging in…" : "Log In"}</button>;
}

export default function Login() {
  const [state, action] = useFormState(login, undefined);
  return (
    <div className="flex min-h-screen flex-col gap-6 px-6 py-12">
      <div className="flex flex-col items-center gap-2 text-center">
        <Logo size={64} />
        <h1 className="text-2xl font-semibold">EcoSphere AI</h1>
        <p className="text-mute">Welcome back!</p>
      </div>
      <form action={action} className="flex flex-col gap-3">
        <label className="sr-only" htmlFor="email">Email</label>
        <input id="email" name="email" type="email" required autoComplete="email" placeholder="Email" className="input" />
        <label className="sr-only" htmlFor="password">Password</label>
        <input id="password" name="password" type="password" required autoComplete="current-password" placeholder="Password" className="input" />
        {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <Submit />
      </form>
      <p className="text-center text-sm text-mute">New here? <Link href="/signup" className="text-leaf">Create an account</Link></p>
      <details className="card p-4 text-sm">
        <summary className="cursor-pointer text-leaf">Demo accounts (password: eco12345)</summary>
        <ul className="mt-2 space-y-1 text-mute">
          {DEMO.map(([role, email]) => <li key={email}><span className="text-white">{role}:</span> {email}</li>)}
        </ul>
      </details>
    </div>
  );
}
