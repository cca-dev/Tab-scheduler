chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  }
});

async function checkAndSwitchTabs() {
  const result = await chrome.storage.sync.get(['schedule']);
  const schedule = result.schedule || { recurring: {}, onetime: {} };
  const now = new Date();
  const day = now.toLocaleString('en-us', {weekday: 'long'}).toLowerCase();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const time = now.toTimeString().slice(0, 5); // HH:MM format

  // Check recurring schedule
  if (schedule.recurring[day]) {
    const matchingItem = schedule.recurring[day].find(item => item.time === time);
    if (matchingItem) {
      switchToTab(matchingItem);
    }
  }

  // Check one-time schedule
  if (schedule.onetime[date]) {
    const matchingItem = schedule.onetime[date].find(item => item.time === time);
    if (matchingItem) {
      switchToTab(matchingItem);
      // Remove the one-time event after it's triggered
      schedule.onetime[date] = schedule.onetime[date].filter(item => item.time !== time);
      await chrome.storage.sync.set({schedule: schedule});
    }
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