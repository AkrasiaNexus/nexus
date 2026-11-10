(function (root) {
  const DAY = 864e5;
  // A real timer's deadline stays put between visits; allow a little rounding drift.
  const RESET_DRIFT_MS = 3000;
  const PER_YEAR = { week: 52, month: 12, year: 1 };

  function verifyTimer(prev, secondsLeft, now) {
    const deadline = now + secondsLeft * 1000;
    if (!prev) return { status: 'new', record: { deadline, firstSeen: now } };
    if (deadline - prev.deadline > RESET_DRIFT_MS) return { status: 'reset', record: prev };
    return { status: 'consistent', record: prev };
  }

  function verifyStock(prev, count, now) {
    if (!prev || prev.count !== count) return { status: 'new', record: { count, firstSeen: now } };
    if (now - prev.firstSeen >= DAY) return { status: 'frozen', record: prev };
    return { status: 'watching', record: prev };
  }

  function annualCost(price, period) {
    return PER_YEAR[period] ? price * PER_YEAR[period] : null;
  }

  function workHours(amount, wage) {
    return wage > 0 && amount > 0 ? amount / wage : null;
  }

  const api = { verifyTimer, verifyStock, annualCost, workHours };
  root.Verdict = Object.assign(root.Verdict || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
