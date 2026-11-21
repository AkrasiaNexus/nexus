// Donna's voice: short, lowercase, dry. She's on your side but she's not polite about it.

const DEADLINE_MESSAGES = {
  gentle: [
    "u said u wanted to do {title}. still on that?",
    "{title} — quarter of ur time gone already",
    "soft one: {title}. no pressure yet",
  ],
  firm: [
    "halfway through ur time for {title}. move",
    "{title} — u set this deadline urself btw",
    "clock's going on {title}. break it smaller?",
  ],
  urgent: [
    "{title} is due. rn. did u do it?",
    "time's up on {title}. done, or push it?",
    "{title} — ur cooked unless this is done",
  ],
};

const SOON_MESSAGES = [
  "{title} in {mins}. get on it or ur cooked",
  "{mins} till {title}. wrap up whatever ur on",
  "heads up — {title} starts in {mins}",
];

const LATE_MESSAGES = [
  "{title} started {mins} ago. u good?",
  "ur late for {title}, {mins} down already",
  "{title} is running without u. {mins} in",
];

const pick = (pool) => pool[Math.floor(Math.random() * pool.length)];

const plural = (n) => `${n} min${n === 1 ? "" : "s"}`;

const fill = (template, title, mins) => template.replace("{title}", title).replace("{mins}", mins);

export function getNudgeMessage(tone, title) {
  return fill(pick(DEADLINE_MESSAGES[tone] || DEADLINE_MESSAGES.gentle), title, "");
}

// minutesUntil is negative once the session has already started.
export function getReminderMessage(title, minutesUntil) {
  const isLate = minutesUntil <= 0;
  return fill(pick(isLate ? LATE_MESSAGES : SOON_MESSAGES), title, plural(Math.abs(minutesUntil)));
}
