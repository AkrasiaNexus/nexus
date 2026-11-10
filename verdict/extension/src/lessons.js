(function (root) {
  const LESSONS = {
    timer: {
      title: 'Countdown timer',
      category: 'Urgency',
      lesson: 'Researchers who crawled 11,000 shopping sites found countdown timers that reset every time the page reloads. Come back later: if the deadline moved, it was never real.'
    },
    scarcity: {
      title: 'Scarcity claim',
      category: 'Scarcity',
      lesson: '"Only 2 left" and "14 people are viewing this" are often made up to rush you. Verdict remembers the number and flags it if it never changes.'
    },
    drip: {
      title: 'Fees held back',
      category: 'Sneaking',
      lesson: 'Showing a low price and adding shipping or fees at the last step is drip pricing. Judge the deal by the final total, not the sticker.'
    },
    trial: {
      title: 'Trial that turns into a bill',
      category: 'Sneaking',
      lesson: 'Free trials that need your card are built to be forgotten. Put a reminder two days before the first charge, or skip it.'
    },
    addon: {
      title: 'Pre-ticked add-on',
      category: 'Sneaking',
      lesson: 'An extra that is already ticked counts on you not noticing. You never chose it, so untick it.'
    },
    privacy: {
      title: 'Pre-ticked data sharing',
      category: 'Forced action',
      lesson: 'Consent that is ticked for you is not consent. Untick anything that shares your data or signs you up for marketing.'
    },
    shame: {
      title: 'Guilt-trip button',
      category: 'Misdirection',
      lesson: 'The "no" option is worded to make you feel bad for declining. Saying no is fine.'
    }
  };
  root.Verdict = Object.assign(root.Verdict || {}, { LESSONS });
  if (typeof module !== 'undefined') module.exports = { LESSONS };
})(globalThis);
