chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  }
});

async function checkAndSwitchTabs() {
  const result = await chrome.storage.sync.get(['schedule']);
  const schedule = result.schedule || {};
  const now = new Date();
  const day = now.toLocaleString('en-us', {weekday: 'long'}).toLowerCase();
  const time = now.toTimeString().slice(0, 5); // HH:MM format

  if (schedule[day] && schedule[day][time]) {
    const tabToSwitch = schedule[day][time];
    switchToTab(tabToSwitch);
  }
}

async function switchToTab(tabInfo) {
  if (tabInfo.id) {
    const tab = await chrome.tabs.get(parseInt(tabInfo.id)).catch(() => null);
    if (tab) {
      await chrome.tabs.update(tab.id, {active: true});
    } else {
      // If the tab with the saved ID is not found, fall back to searching by title
      const tabs = await chrome.tabs.query({});
      const matchingTab = tabs.find(t => t.title.includes(tabInfo.title));
      if (matchingTab) {
        await chrome.tabs.update(matchingTab.id, {active: true});
      }
    }
  }
}