import { useRef, useState } from "react";
import { createTools, runTurn, systemPrompt, messagesForModel } from "../lib/planner";
import { parseReminder, completeReminder, whenSaid } from "../lib/remind";
import { planStore } from "../stores/planStore";
import { itemStore } from "../stores/itemStore";
import profileText from "../lib/profile.md?raw";
import { parseProfile, profileForPrompt } from "../lib/idiolect";

// Enough back-and-forth for "how many mins a day?" → "30, 2 weeks", without the
// thread crowding the plan out of the 8192-token context.
const HISTORY_LIMIT = 10;
// Built once: the substitutions the normalizer applies, and the prose the model is sent.
const PROFILE = parseProfile(profileText);
const VOICE = profileForPrompt(profileText);
// A turn is up to 7 model calls at ~25s of prefill each; past this the panel unlocks with an error.
const TURN_TIMEOUT_MS = 4 * 60_000;

const tools = createTools({
  plan: () => planStore.getAll(),
  items: () => itemStore.getAll(),
  onAddGoal: (goal) => ({ id: itemStore.addGoal(goal).id }),
  onSchedule: ({ goal_id, ...block }) => planStore.schedule({ itemId: goal_id ?? null, ...block }),
  onMoveBlock: ({ id, date, start }) => planStore.move(id, date, start),
  onRemoveBlock: ({ id }) => {
    planStore.remove(id);
    return "removed";
  },
  onRemoveGoal: ({ id }) => {
    planStore.removeForItem(id);
    itemStore.remove(id);
    return "removed";
  },
  onSetFixed: (entry) => planStore.setFixed(entry),
  onRemember: (text) => planStore.remember(text),
  onForget: ({ id }) => planStore.forget(id),
});

// One conversation with Donna. `say` never throws: failures come back as Donna's line,
// so the panel always has something to show.
export function useDonna() {
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  // A reminder asked for without a time, waiting for the reply that names one.
  const pendingRef = useRef(null);

  async function say(text) {
    if (busyRef.current) return false;

    // "remind me to X in 20 mins" is a two-minute job, not a session. It reads the text
    // and saves it — no model, and nothing added to the week. The model has no reminder tool,
    // so anything that is a reminder has to be finished here or it never fires.
    const pending = pendingRef.current;
    pendingRef.current = null;
    const reminder = (pending && completeReminder(pending, text)) || parseReminder(text);
    if (reminder?.at) {
      planStore.remind(reminder.text, reminder.at);
      // Said on the real clock, so a time she read wrong is seen now, not when it fails to arrive.
      answer(text, `got it. ${reminder.text.toLowerCase()} — i'll say ${whenSaid(reminder.at)}.`);
      return true;
    }
    if (reminder) {
      pendingRef.current = reminder.text;
      answer(text, "when?");
      return true;
    }

    busyRef.current = true;
    setBusy(true);

    const history = [...thread, { role: "user", content: text }].slice(-HISTORY_LIMIT);
    setThread(history);
    let reply;
    try {
      const system = systemPrompt({ plan: planStore.getAll(), items: itemStore.getAll(), profile: VOICE });
      const said = messagesForModel(history, PROFILE);
      const { text: answer } = await runTurn([{ role: "system", content: system }, ...said], tools, { signal: AbortSignal.timeout(TURN_TIMEOUT_MS) });
      reply = { role: "assistant", content: answer };
    } catch (e) {
      reply = { role: "error", content: e.message };
    }

    setThread([...history, reply]);
    busyRef.current = false;
    setBusy(false);
    return true;
  }

  // An answer Donna already knows goes straight in: no model, no wait.
  function answer(question, said) {
    setThread((prev) => [...prev, { role: "user", content: question }, { role: "assistant", content: said }].slice(-HISTORY_LIMIT));
  }
  const tell = answer;

  return { thread, busy, say, tell };
}
