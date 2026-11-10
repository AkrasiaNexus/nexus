const V = globalThis.Verdict;
const $ = id => document.getElementById(id);
const DEFAULTS = { wage: 26, currency: 'AED' };

function h(tag, cls, text) {
  const el = document.createElement(tag);
  if (cls) el.className = cls;
  if (text !== undefined) el.textContent = text;
  return el;
}

const money = (n, cur) => `${cur} ${n.toLocaleString(undefined, { maximumFractionDigits: 2 })}`;
const hours = (amount, wage) => {
  const hrs = V.workHours(amount, wage);
  return hrs === null ? '' : ` = ${hrs < 1 ? Math.round(hrs * 60) + ' min' : hrs.toFixed(1) + ' h'} of your work`;
};

const VERIFY_TEXT = {
  timer: {
    new: ['Deadline saved. Come back later: if it has moved, Verdict will prove it is fake.', ''],
    consistent: ['The deadline has not moved since you first saw it.', 'ok'],
    reset: ['Proven fake: the deadline moved later since your last visit.', 'proven']
  },
  scarcity: {
    new: ['Count saved. If it never changes for a day, Verdict flags it.', ''],
    watching: ['Same count as last time. Still watching.', ''],
    frozen: ['Suspicious: the exact same count after a full day.', 'proven']
  }
};

function moneyLine(f, s) {
  if (f.type === 'addon' && f.price) return `${money(f.price, s.currency)} added for you${hours(f.price, s.wage)}`;
  if (f.type === 'trial' && f.price) {
    const year = V.annualCost(f.price, f.period);
    return `${money(f.price, s.currency)}/${f.period} → ${money(year, s.currency)} a year${hours(year, s.wage)}`;
  }
  return '';
}

function renderItem(f, s) {
  const lesson = V.LESSONS[f.type];
  const li = h('li', 'item');
  const head = h('div', 'head');
  head.append(h('span', 'title', lesson.title), h('span', 'chip', lesson.category));
  li.append(head, h('div', 'quote', f.text));
  const v = f.verified && VERIFY_TEXT[f.type] && VERIFY_TEXT[f.type][f.verified];
  if (v) li.append(h('div', 'verify ' + v[1], v[0]));
  if (f.type === 'scarcity' && f.count === null) li.append(h('div', 'verify', 'Claim only. Verdict cannot check numbers that are not shown.'));
  const m = moneyLine(f, s);
  if (m) li.append(h('div', 'money', m));
  const d = h('details');
  d.append(h('summary', '', 'Why this is a trick'), h('p', '', lesson.lesson));
  li.append(d);
  return li;
}

function render(findings, s, tabId) {
  const main = $('main');
  main.replaceChildren();
  const proven = findings.filter(f => f.verified === 'reset' || f.verified === 'frozen').length;
  const ruling = h('div', 'ruling ' + (findings.length ? 'bad' : 'good'));
  const copy = h('div');
  if (findings.length) {
    copy.append(h('b', '', `${findings.length} ${findings.length === 1 ? 'trick' : 'tricks'} on this page`),
      h('small', '', proven ? `${proven} proven by revisiting` : 'Highlighted in red on the page'));
  } else {
    copy.append(h('b', '', 'No tricks found'), h('small', '', 'Verdict checked timers, stock claims, fees, trials, pre-ticked boxes and guilt-trip buttons.'));
  }
  ruling.append(h('span', 'badge', findings.length ? 'FLAGGED' : 'CLEAN'), copy);
  main.append(ruling);

  const trials = findings.filter(f => f.type === 'trial' && f.price);
  if (trials.length) {
    const year = trials.reduce((t, f) => t + (V.annualCost(f.price, f.period) || 0), 0);
    const cost = h('div', 'cost');
    cost.append('If you forget to cancel: ', h('b', '', money(year, s.currency) + ' a year'), hours(year, s.wage) + '.');
    main.append(cost);
  }

  if (findings.length) {
    const list = h('ul', 'list');
    findings.forEach(f => list.append(renderItem(f, s)));
    main.append(list);
  }

  if (findings.some(f => f.ticked)) {
    const btn = h('button', 'btn', 'Untick the boxes ticked for you');
    btn.type = 'button';
    btn.addEventListener('click', async () => {
      const res = await chrome.tabs.sendMessage(tabId, { type: 'verdict:untick' });
      render(res.findings, s, tabId);
    });
    main.append(btn);
  }
}

function renderUnavailable() {
  $('main').replaceChildren(h('p', 'empty', 'Verdict can only read regular web pages. Open a shop or checkout page and try again.'));
}

async function init() {
  const s = { ...DEFAULTS, ...(await chrome.storage.sync.get(['wage', 'currency'])) };
  $('wage').value = s.wage;
  $('currency').value = s.currency;
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let res = null;
  try {
    if (tab && tab.url) $('host').textContent = new URL(tab.url).host;
    res = await chrome.tabs.sendMessage(tab.id, { type: 'verdict:get' });
  } catch (e) {
    res = null;
  }
  if (!res) return renderUnavailable();

  const rerender = () => render(res.findings, s, tab.id);
  rerender();
  $('wage').addEventListener('change', () => {
    const w = parseFloat($('wage').value);
    if (w > 0) { s.wage = w; chrome.storage.sync.set({ wage: w }); rerender(); }
  });
  $('currency').addEventListener('change', () => {
    s.currency = ($('currency').value || 'AED').toUpperCase().slice(0, 5);
    chrome.storage.sync.set({ currency: s.currency });
    rerender();
  });
}

init();
