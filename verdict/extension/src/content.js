(function () {
  const V = globalThis.Verdict;
  const STYLE_ID = 'verdict-style';
  // A hostile page can render thousands of fake claims; only the first few get remembered.
  const MAX_TRACKED = 20;
  const PRUNE_TO = 2000;
  let findings = [];

  function injectStyle() {
    if (document.getElementById(STYLE_ID)) return;
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = '[data-verdict]{outline:2px solid #FF5A5F !important;outline-offset:3px !important;border-radius:4px}' +
      '[data-verdict-verified="reset"],[data-verdict-verified="frozen"]{outline-style:double !important;outline-width:4px !important}';
    document.documentElement.appendChild(style);
  }

  function storageKey(f, index) {
    return `v|${location.origin}${location.pathname}|${f.type}|${index}`;
  }

  function serialize(f) {
    const { el, input, ...rest } = f;
    return { ...rest, ticked: input ? input.checked : undefined };
  }

  async function safeGet(keys) {
    try { return await chrome.storage.local.get(keys); } catch (e) { return {}; }
  }

  // If storage is full, forget the oldest records and try once more; highlighting never depends on it.
  async function safeSet(updates) {
    try {
      await chrome.storage.local.set(updates);
    } catch (e) {
      try {
        const all = await chrome.storage.local.get(null);
        const oldest = Object.entries(all).sort((a, b) => (a[1].firstSeen || 0) - (b[1].firstSeen || 0));
        await chrome.storage.local.remove(oldest.slice(0, Math.max(0, oldest.length - PRUNE_TO)).map(([k]) => k));
        await chrome.storage.local.set(updates);
      } catch (e2) { /* still full: skip verification this time */ }
    }
  }

  async function scan() {
    const found = V.detectAll(document);
    const counters = {};
    const keyed = found.map(f => {
      counters[f.type] = (counters[f.type] || 0) + 1;
      return { f, key: storageKey(f, counters[f.type]) };
    });
    const verifiable = keyed.filter(({ f }) => f.type === 'timer' || (f.type === 'scarcity' && f.count !== null)).slice(0, MAX_TRACKED);
    const stored = verifiable.length ? await safeGet(verifiable.map(k => k.key)) : {};
    const updates = {};
    const now = Date.now();
    for (const { f, key } of verifiable) {
      const result = f.type === 'timer' ? V.verifyTimer(stored[key], f.seconds, now) : V.verifyStock(stored[key], f.count, now);
      f.verified = result.status;
      updates[key] = result.record;
    }
    if (verifiable.length) await safeSet(updates);

    injectStyle();
    document.querySelectorAll('[data-verdict]').forEach(el => { el.removeAttribute('data-verdict'); el.removeAttribute('data-verdict-verified'); });
    for (const f of found) {
      f.el.setAttribute('data-verdict', f.type);
      if (f.verified) f.el.setAttribute('data-verdict-verified', f.verified);
      if (!f.el.title) f.el.title = 'Verdict: ' + V.LESSONS[f.type].title;
    }
    findings = found;
    chrome.runtime.sendMessage({ type: 'verdict:count', count: found.length }).catch(() => {});
  }

  chrome.runtime.onMessage.addListener((msg, _sender, reply) => {
    if (msg.type === 'verdict:get') reply({ url: location.href, findings: findings.map(serialize) });
    if (msg.type === 'verdict:untick') {
      let unticked = 0;
      for (const f of findings) {
        if (f.input && f.input.checked) {
          f.input.checked = false;
          f.input.dispatchEvent(new Event('change', { bubbles: true }));
          unticked++;
        }
      }
      reply({ unticked, findings: findings.map(serialize) });
    }
  });

  scan();
  // Checkouts often render prices and timers after load.
  setTimeout(scan, 2500);
})();
