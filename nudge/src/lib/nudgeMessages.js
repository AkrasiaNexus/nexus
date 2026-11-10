const MESSAGES = {
  gentle: [
    "Hey, you mentioned: {title}. Started thinking about it?",
    "Friendly tap — {title} is on your list. Any progress?",
    "Quarter of the way through your timeline for: {title}",
  ],
  firm: [
    "Halfway mark for {title}. Time to move on this.",
    "{title} — you set this deadline yourself. How's it going?",
    "Clock's ticking on {title}. Need to break it down smaller?",
  ],
  urgent: [
    "{title} — deadline is here. Did you do it?",
    "Final call: {title}. Mark it done or extend?",
    "Time's up on {title}. Be honest with yourself — done or reschedule?",
  ],
};

export function getNudgeMessage(tone, title) {
  const pool = MESSAGES[tone] || MESSAGES.gentle;
  const msg = pool[Math.floor(Math.random() * pool.length)];
  return msg.replace("{title}", title);
}
