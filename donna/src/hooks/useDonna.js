import { useRef, useState } from "react";
import { createTools, runTurn, systemPrompt, messagesForModel } from "../lib/planner";
import { parseReminder } from "../lib/remind";
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
});

// One conversation with Donna. `say` never throws: failures come back as Donna's line,
// so the panel always has something to show.
export function useDonna() {
  const [thread, setThread] = useState([]);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);

  async function say(text) {
    if (busyRef.current) return false;

    // "remind me to X in 20 mins" is a two-minute job, not a session. It reads the text
    // and saves it — no model, and nothing added to the week.
    const reminder = parseReminder(text);
    if (reminder?.at) {
      planStore.remind(reminder.text, reminder.at);
      const mins = Math.max(1, Math.round((reminder.at - Date.now()) / 60_000));
      answer(text, `got it. ${reminder.text.toLowerCase()} — i'll say in ${mins} min${mins === 1 ? "" : "s"}.`);
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
