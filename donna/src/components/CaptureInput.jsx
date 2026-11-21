import { useState, useRef, useEffect } from "react";
import { Zap, Mic } from "lucide-react";
import { itemStore } from "../stores/itemStore";

// `onSubmit` hands the text to Donna instead of the plain parser; `busy` refuses a second
// send while she is still answering, and keeps what was typed rather than losing it.
export default function CaptureInput({ autoFocus = false, onCapture, onSubmit, busy = false }) {
  const [value, setValue] = useState("");
  const inputRef = useRef(null);

  useEffect(() => {
    if (autoFocus && inputRef.current) inputRef.current.focus();
  }, [autoFocus]);

  function handleSubmit(e) {
    e.preventDefault();
    const text = value.trim();
    if (!text || busy) return;
    setValue("");
    if (onSubmit) return onSubmit(text);
    const item = itemStore.add(text);
    onCapture?.(item);
  }

  return (
    <form onSubmit={handleSubmit} className="relative group">
      <div className="flex items-center gap-3 bg-donna-surface border border-donna-border rounded-2xl px-5 py-4 focus-within:border-donna-accent transition-colors">
        <Zap size={18} className="text-donna-accent shrink-0" />
        <input
          ref={inputRef}
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          placeholder="blurt it out... &quot;learn rust 2 weeks&quot;"
          className="flex-1 text-base placeholder:text-donna-muted"
        />
        <button
          type="button"
          className="p-2 rounded-lg text-donna-muted hover:text-donna-text hover:bg-donna-border/50 transition-colors"
          title="Voice input (coming soon)"
        >
          <Mic size={16} />
        </button>
        <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 text-[11px] text-donna-muted bg-donna-bg rounded-md border border-donna-border">
          ⏎
        </kbd>
      </div>
    </form>
  );
}
