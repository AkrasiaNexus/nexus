"use client";

import Link from "next/link";
import { useState } from "react";
import { useFormState, useFormStatus } from "react-dom";
import { Briefcase, ChevronLeft, GraduationCap, HeartPulse, Presentation, School, Users, UsersRound } from "lucide-react";
import { signup } from "../actions";

const ROLES = [
  { id: "STUDENT", name: "Student", hint: "Track your progress and earn rewards", icon: GraduationCap },
  { id: "PARENT", name: "Parent", hint: "Monitor your child's impact", icon: Users },
  { id: "EMPLOYEE", name: "Employee", hint: "Contribute at work", icon: Briefcase },
  { id: "TEACHER", name: "Teacher / Staff", hint: "Manage your class, assign tasks", icon: Presentation },
  { id: "HEALTH_MONITOR", name: "Health Monitor", hint: "Classroom health, safety & attendance", icon: HeartPulse },
  { id: "SCHOOL_ADMIN", name: "School Administrator", hint: "Manage your school", icon: School },
  { id: "COMMUNITY", name: "Community Member", hint: "Join the green community", icon: UsersRound },
] as const;

function Submit() {
  const { pending } = useFormStatus();
  return <button className="btn w-full" disabled={pending}>{pending ? "Creating…" : "Create account"}</button>;
}

export function SignupForm({ schools }: { schools: { id: string; name: string }[] }) {
  const [role, setRole] = useState<string>("STUDENT");
  const [step, setStep] = useState(1);
  const [state, action] = useFormState(signup, undefined);
  const needsSchool = ["STUDENT", "TEACHER", "HEALTH_MONITOR", "SCHOOL_ADMIN"].includes(role);
  const needsClass = ["STUDENT", "TEACHER", "HEALTH_MONITOR"].includes(role);
  const isStaff = role === "TEACHER" || role === "HEALTH_MONITOR";

  if (step === 1)
    return (
      <div className="flex min-h-screen flex-col gap-4 px-6 py-8">
        <Link href="/" aria-label="Back" className="-ml-2 w-fit rounded-full p-2 hover:bg-card"><ChevronLeft /></Link>
        <h1 className="text-2xl font-semibold">Select Your Role</h1>
        <p className="-mt-2 text-mute">Choose how you&apos;ll use EcoSphere</p>
        <div role="radiogroup" className="flex flex-col gap-3">
          {ROLES.map(({ id, name, hint, icon: Icon }) => (
            <button key={id} type="button" role="radio" aria-checked={role === id} onClick={() => setRole(id)}
              className={`card flex items-center gap-4 p-4 text-left transition ${role === id ? "border-leaf ring-1 ring-leaf" : ""}`}>
              <Icon className="text-leaf" />
              <span><span className="block font-medium">{name}</span><span className="text-xs text-mute">{hint}</span></span>
            </button>
          ))}
        </div>
        <button className="btn mt-2" onClick={() => setStep(2)}>Continue</button>
        <p className="text-center text-xs text-mute">Super Administrator accounts are created by the platform team.</p>
      </div>
    );

  return (
    <div className="flex min-h-screen flex-col gap-4 px-6 py-8">
      <button aria-label="Back" onClick={() => setStep(1)} className="-ml-2 w-fit rounded-full p-2 hover:bg-card"><ChevronLeft /></button>
      <h1 className="text-2xl font-semibold">Create your account</h1>
      <p className="-mt-2 text-mute">{ROLES.find((r) => r.id === role)?.name}</p>
      <form action={action} className="flex flex-col gap-3">
        <input type="hidden" name="role" value={role} />
        <input name="name" required minLength={2} placeholder="Full name" className="input" aria-label="Full name" />
        <input name="email" type="email" required placeholder="Email" className="input" aria-label="Email" autoComplete="email" />
        <input name="password" type="password" required minLength={8} placeholder="Password (8+ characters)" className="input" aria-label="Password" autoComplete="new-password" />
        {needsSchool && (
          <select name="schoolId" required className="input" aria-label="School" defaultValue="">
            <option value="" disabled>Choose your school</option>
            {schools.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        )}
        {needsClass && <input name="grade" required placeholder={role === "STUDENT" ? "Your class (e.g. Class 10)" : "Class you look after (e.g. Class 10)"} className="input" aria-label="Class" />}
        {isStaff && <input name="adminCode" required placeholder="Staff code from your school" className="input" aria-label="Staff code" />}
        {role === "PARENT" && <input name="childEmail" type="email" placeholder="Your child's EcoSphere email (optional)" className="input" aria-label="Child email" />}
        {role === "EMPLOYEE" && <input name="department" placeholder="Department (e.g. Facilities)" className="input" aria-label="Department" />}
        {role === "COMMUNITY" && <input name="community" placeholder="Community name" className="input" aria-label="Community" />}
        {role === "SCHOOL_ADMIN" && <input name="adminCode" required placeholder="Admin code" className="input" aria-label="Admin code" />}
        {state?.error && <p role="alert" className="text-sm text-red-400">{state.error}</p>}
        <Submit />
      </form>
      <p className="text-center text-sm text-mute">Have an account? <Link href="/login" className="text-leaf">Log in</Link></p>
    </div>
  );
}
