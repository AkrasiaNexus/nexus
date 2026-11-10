import { useEffect, useState } from "react";
import CaptureInput from "./CaptureInput";
import { hideThisWindow } from "../lib/notify";

export default function CaptureWindow() {
  const [last, setLast] = useState(null);

  useEffect(() => {
    const onKey = (e) => e.key === "Escape" && hideThisWindow();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  function handleCapture(item) {
    setLast(item);
    setTimeout(hideThisWindow, 600);
  }

  return (
    <div className="h-screen flex flex-col justify-center gap-3 p-4 bg-nudge-bg">
      <CaptureInput autoFocus onCapture={handleCapture} />
      <p className="text-xs text-nudge-muted px-2" role="status">
        {last ? `Saved: ${last.title} (${last.category}). First check-in at 25% of your time.` : "Blurt it, press Enter. Esc to close."}
      </p>
    </div>
  );
}
