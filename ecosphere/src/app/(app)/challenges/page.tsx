import { requireUser } from "@/lib/auth";
import { ChallengeList } from "@/components/ChallengeList";
import { Header } from "@/components/ui";

export default async function Challenges() {
  const user = await requireUser();
  return (
    <>
      <Header title="Challenges" />
      <div className="px-5">
        <p className="mb-4 text-sm text-white/55">Join a challenge, log matching waste with the scanner, then claim your points.</p>
        <ChallengeList userId={user.id} />
      </div>
    </>
  );
}
