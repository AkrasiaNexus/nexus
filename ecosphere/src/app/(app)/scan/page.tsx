import { Header } from "@/components/ui";
import { Scanner } from "./Scanner";

export default function ScanPage() {
  return (
    <>
      <Header title="AI Waste Scanner" />
      {/* Server-side AI only when an operator configured CLASSIFIER_URL; otherwise on-device only. */}
      <Scanner serverAI={!!process.env.CLASSIFIER_URL} />
    </>
  );
}
