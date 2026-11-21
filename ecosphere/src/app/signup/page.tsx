import { createClient } from "@/lib/supabase/server";
import { SignupForm } from "./SignupForm";

export const dynamic = "force-dynamic";

export default async function Signup() {
  const sb = createClient();
  const [schools, communities] = await Promise.all([
    sb.from("schools").select("id, name").order("name"),
    sb.from("communities").select("id, name").order("name"),
  ]);
  return <SignupForm schools={schools.data ?? []} communities={communities.data ?? []} />;
}
