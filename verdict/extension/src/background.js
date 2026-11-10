chrome.runtime.onMessage.addListener((msg, sender) => {
  if (msg.type !== 'verdict:count' || !sender.tab) return;
  const tabId = sender.tab.id;
  chrome.action.setBadgeText({ tabId, text: msg.count ? String(msg.count) : '' });
  chrome.action.setBadgeBackgroundColor({ tabId, color: '#FF5A5F' });
});
