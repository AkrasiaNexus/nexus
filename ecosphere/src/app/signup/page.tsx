import { db } from "@/lib/db";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function Signup() {
  const schools = await db.school.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } });
  return <SignupForm schools={schools} />;
}
