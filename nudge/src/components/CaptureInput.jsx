import { useState, useRef, useEffect } from "react";
import { Zap, Mic } from "lucide-react";
import { nudgeStore } from "../stores/nudgeStore";

export default function CaptureInput({ autoFocus = false, onCapture }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  function handleSubmit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text) return;
    const item = nudgeStore.add(text);
    setValue("");
    onCapture?.(item);
  }

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className="flex items-center gap-3 bg-nudge-surface border border-nudge-border rounded-2xl px-5 py-4 focus-within:border-nudge-accent transition-colors">
        <Zap size={18} className="text-nudge-accent shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="blurt it out... &quot;learn rust 2 weeks&quot;"
          className="flex-1 text-base placeholder:text-nudge-muted"
        />
        <button
          type="button"
          className="p-2 rounded-lg text-nudge-muted hover:text-nudge-text hover:bg-nudge-border/50 transition-colors"
          title="Voice input (coming soon)"
        >
          <Mic size={16} />
        </button>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] text-nudge-muted bg-nudge-bg rounded-md border border-nudge-border">
          ⏎
        </kbd>
      </div>
    </form>
  );
}
