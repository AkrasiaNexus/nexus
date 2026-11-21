import { useEffect, useRef, useState } from "react";

// macOS dictation, through the webview's own recogniser. Note that unlike the planner,
// this is not local: WKWebView hands the audio to Apple. Swap for a local whisper
// sidecar if that matters more than the convenience.
const Recognition = typeof window !== "undefined" && (window.SpeechRecognition || window.webkitSpeechRecognition);

export function useDictation(onFinal) {
  const [listening, setListening] = useState(false);
  const [heard, setHeard] = useState("");
  const engine = useRef(null);
  const finalRef = useRef(onFinal);
  finalRef.current = onFinal;

  useEffect(() => () => engine.current?.abort(), []);

  function stop() {
    engine.current?.stop();
    setListening(false);
  }

  function start() {
    if (!Recognition || listening) return;

    const recogniser = new Recognition();
    recogniser.lang = navigator.language || "en-US";
    recogniser.interimResults = true;
    recogniser.continuous = false;

    recogniser.onresult = (event) => {
      let text = "";
      let done = false;
      for (const result of event.results) {
        text += result[0].transcript;
        if (result.isFinal) done = true;
      }
      setHeard(text);
      if (done) finalRef.current?.(text.trim());
    };
    recogniser.onerror = () => setListening(false);
    recogniser.onend = () => {
      setListening(false);
      setHeard("");
    };

    engine.current = recogniser;
    recogniser.start();
    setListening(true);
  }

  return { supported: Boolean(Recognition), listening, heard, toggle: () => (listening ? stop() : start()) };
}
