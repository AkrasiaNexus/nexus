import type { Metadata } from "next";
import { Cinematic } from "@/components/landing/Cinematic";

export const metadata: Metadata = {
  title: "EcoSphere AI · Technology for a greener tomorrow",
  description: "Scan waste with on-device AI, track your impact, trade in a circular marketplace and earn EcoCreds, for schools and communities.",
};

// Public presentation layer. Signed-in users are sent to /home by middleware; the app itself is unchanged.
export default function Landing() {
  return <Cinematic />;
}
