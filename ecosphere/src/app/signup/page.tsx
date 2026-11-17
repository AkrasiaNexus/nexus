import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function Signup() {
  const schools = (await createClient().from("schools").select("id, name").order("name")).data ?? [];
  return <SignupForm schools={schools} />;
}
