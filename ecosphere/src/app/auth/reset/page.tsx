"use client";

import { useFormState } from "react-dom";
import { LeafLogo } from "@/components/art";
import { setNewPassword } from "../../actions";

export default function ResetPassword() {
  const [state, action] = useFormState(setNewPassword, undefined);
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-md flex-col gap-6 px-6 pb-10 pt-20">
      <div className="flex flex-col items-center gap-3 text-center">
        <span className="blur-in"><LeafLogo size={64} /></span>
        <h1 className="text-2xl font-semibold">Choose a new password</h1>
      </div>
      <form action={action} className="stagger flex flex-col gap-4">
        <input name="password" type="password" required minLength={8} autoComplete="new-password" placeholder="New password (8+ characters)" aria-label="New password" className="input py-3.5" />
        {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <button className="btn py-3.5">Save and continue</button>
      </form>
    </div>
  );
}
