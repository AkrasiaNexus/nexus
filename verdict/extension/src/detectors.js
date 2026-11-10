(function (root) {
  const CURRENCY = '(?:AED|USD|SAR|EUR|GBP|INR|dirhams?|\\$|€|£|₹)';
  const AMOUNT = '(\\d{1,3}(?:,\\d{3})*(?:\\.\\d{1,2})?)';
  const PRICE_RE = new RegExp(`${CURRENCY}\\s?${AMOUNT}|${AMOUNT}\\s?${CURRENCY}`, 'i');
  const PERIOD_RE = new RegExp(`(?:${CURRENCY}\\s?${AMOUNT}|${AMOUNT}\\s?${CURRENCY})\\s*(?:\\/|per|a|an|each|every)\\s*(week|wk|month|mo|year|yr)\\b`, 'i');

  const TIMER_RE = /\b(\d{1,2}):(\d{2})(?::(\d{2}))?\b(?!\s*(?:am|pm)\b)/i;
  const TIMER_HMS_RE = /\b(\d{1,2})\s*h(?:ours?|rs?)?\s*(\d{1,2})\s*m(?:in(?:utes?)?)?(?:\s*(\d{1,2})\s*s(?:ec(?:onds?)?)?)?\b/i;
  const URGENCY_RE = /\b(ends?|ending|expires?|left|hurry|offer|sale|deal|reserved|countdown|limited|only)\b/i;
  const CLOCK_CONTEXT_RE = /\b(opens?|closes?|open|hours|at|from|until|delivery between)\s+\d{1,2}:\d{2}/i;

  const STOCK_RE = /\b(?:only|just)\s+(\d+)\s+(?:left|remaining|in stock|available|items? left|boxes left|seats left)\b/i;
  const VIEWERS_RE = /\b(\d+)\s+(?:people|others|shoppers|customers|users)\s+(?:are\s+)?(?:viewing|looking at|watching|have this in their (?:cart|basket))\b/i;
  const PRESSURE_RE = /\b(selling fast|in high demand|almost gone|\d+\s+sold in (?:the )?last)\b/i;

  const DRIP_RE = /\b(shipping|delivery|fees?|taxes|service charges?)\b[^.]{0,40}\b(calculated|added|shown|applied|revealed)\b[^.]{0,25}\b(next|final|later|checkout|step)\b/i;

  const TRIAL_RE = /\b(free trial|trial|free for \d+ days?|first month free)\b/i;
  const RENEW_RE = /\b(renews?|recurring|auto(?:matically)?[- ]?renews?|then|after that|billed)\b/i;

  const SHAME_RE = /^\s*no,?\s*(?:thanks|thank you)?[,.]?\s*i\s*(?:don'?t|do not|'d rather not|prefer not)\b|\bi\s+(?:don'?t|do not)\s+(?:like|want|care about|need)\s+(?:saving|savings|money|discounts?|deals?|free|to save|my\s+\w+)|\b(?:pay full price|i'?ll miss out|i hate)\b/i;

  const ADDON_RE = /\b(protection|insurance|warranty|cover(?:age)?|gift|donat\w*|priority|express|upgrade|membership|subscription|plan|add)\b/i;
  const PRIVACY_RE = /\b(e-?mail|newsletter|offers|promotions?|marketing|partners?|third[- ]part\w*|share my|sms|updates)\b/i;
  const SKIP_CHECKBOX_RE = /\b(remember me|keep me (?:signed|logged) in|stay signed in)\b/i;

  const SKIP_TAGS = new Set(['SCRIPT', 'STYLE', 'NOSCRIPT', 'TEMPLATE', 'SVG', 'HEAD']);
  const BLOCK_MAX = 220;

  const clean = s => s.replace(/\s+/g, ' ').trim();
  const num = s => parseFloat(String(s).replace(/,/g, ''));
  const snippet = s => { const t = clean(s); return t.length > 140 ? t.slice(0, 137) + '…' : t; };

  function parsePrice(text) {
    const m = text.match(PRICE_RE);
    return m ? num(m[1] || m[2]) : null;
  }

  function parsePeriodPrice(text) {
    const m = text.match(PERIOD_RE);
    if (!m) return null;
    const period = { wk: 'week', week: 'week', mo: 'month', month: 'month', yr: 'year', year: 'year' }[m[3].toLowerCase()];
    return { price: num(m[1] || m[2]), period };
  }

  function parseTimerSeconds(text) {
    const hms = text.match(TIMER_HMS_RE);
    if (hms) return (+hms[1]) * 3600 + (+hms[2]) * 60 + (+(hms[3] || 0));
    const m = text.match(TIMER_RE);
    if (!m) return null;
    return m[3] !== undefined ? (+m[1]) * 3600 + (+m[2]) * 60 + (+m[3]) : (+m[1]) * 60 + (+m[2]);
  }

  // Smallest ancestor that still reads as one sentence, so "Sale ends in <b>04:59</b>" stays together.
  function textBlocks(doc) {
    const blocks = new Set();
    const walker = doc.createTreeWalker(doc.body, NodeFilter.SHOW_TEXT);
    for (let node = walker.nextNode(); node; node = walker.nextNode()) {
      if (!node.nodeValue.trim()) continue;
      let el = node.parentElement;
      if (!el || SKIP_TAGS.has(el.tagName) || el.closest('[data-verdict-ui]')) continue;
      while (el.parentElement && el.parentElement !== doc.body && clean(el.parentElement.textContent).length <= BLOCK_MAX) el = el.parentElement;
      if (clean(el.textContent).length <= BLOCK_MAX * 2) blocks.add(el);
    }
    return [...blocks].filter(el => ![...blocks].some(other => other !== el && other.contains(el)));
  }

  function labelFor(input) {
    const doc = input.ownerDocument;
    const byFor = input.id && doc.querySelector(`label[for="${CSS.escape(input.id)}"]`);
    const label = byFor || input.closest('label') || input.parentElement;
    return { el: label || input, text: clean(label ? label.textContent : '') };
  }

  function detectText(blocks) {
    const out = [];
    for (const el of blocks) {
      const text = clean(el.textContent);
      const seconds = parseTimerSeconds(text);
      if (seconds !== null && seconds > 0 && URGENCY_RE.test(text) && !CLOCK_CONTEXT_RE.test(text)) {
        out.push({ type: 'timer', el, text: snippet(text), seconds });
      }
      const stock = text.match(STOCK_RE);
      const viewers = text.match(VIEWERS_RE);
      if (stock || viewers || PRESSURE_RE.test(text)) {
        out.push({ type: 'scarcity', el, text: snippet(text), count: stock ? +stock[1] : null, viewers: viewers ? +viewers[1] : null });
      }
      if (DRIP_RE.test(text)) out.push({ type: 'drip', el, text: snippet(text) });
      const recurring = parsePeriodPrice(text);
      if (recurring && (TRIAL_RE.test(text) || RENEW_RE.test(text))) {
        out.push({ type: 'trial', el, text: snippet(text), price: recurring.price, period: recurring.period });
      }
    }
    return out;
  }

  function detectCheckboxes(doc) {
    const out = [];
    for (const input of doc.querySelectorAll('input[type=checkbox]')) {
      if (!input.checked || input.disabled) continue;
      const { el, text } = labelFor(input);
      if (!text || SKIP_CHECKBOX_RE.test(text)) continue;
      const price = parsePrice(text);
      if (price !== null && ADDON_RE.test(text)) out.push({ type: 'addon', el, input, text: snippet(text), price });
      else if (PRIVACY_RE.test(text)) out.push({ type: 'privacy', el, input, text: snippet(text) });
    }
    return out;
  }

  function detectShame(doc) {
    const out = [];
    const sel = 'button, a, [role=button], input[type=submit], input[type=button]';
    for (const el of doc.querySelectorAll(sel)) {
      const text = clean(el.value || el.textContent || '');
      if (text && text.length < 120 && SHAME_RE.test(text)) out.push({ type: 'shame', el, text: snippet(text) });
    }
    return out;
  }

  function detectAll(doc) {
    const found = [...detectText(textBlocks(doc)), ...detectCheckboxes(doc), ...detectShame(doc)];
    const seen = new Set();
    return found.filter(f => {
      const key = f.type + '|' + f.text;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }

  const api = { detectAll, parsePrice, parsePeriodPrice, parseTimerSeconds };
  root.Verdict = Object.assign(root.Verdict || {}, api);
  if (typeof module !== 'undefined') module.exports = api;
})(globalThis);
