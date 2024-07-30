chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  }
});

async function checkAndSwitchTabs() {
  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || {};
  if (!schedule.recurring) schedule.recurring = {};
  if (!schedule.onetime) schedule.onetime = {};

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

// Also, let's add some console logging to help with debugging
async function switchToTab(tabInfo) {
  console.log('Attempting to switch to tab:', tabInfo);
  if (tabInfo.id) {
    const tab = await chrome.tabs.get(parseInt(tabInfo.id)).catch(() => null);
    if (tab) {
      console.log('Switching to tab with ID:', tab.id);
      await chrome.tabs.update(tab.id, {active: true});
      if (tabInfo.reload) {
        console.log('Reloading tab:', tab.id);
        await chrome.tabs.reload(tab.id);
      }
    } else {
      console.log('Tab not found by ID, searching by title:', tabInfo.title);
      const tabs = await chrome.tabs.query({});
      const matchingTab = tabs.find(t => t.title.includes(tabInfo.title));
      if (matchingTab) {
        console.log('Switching to tab with title:', matchingTab.title);
        await chrome.tabs.update(matchingTab.id, {active: true});
        if (tabInfo.reload) {
          console.log('Reloading tab:', matchingTab.id);
          await chrome.tabs.reload(matchingTab.id);
        }
      } else {
        console.log('No matching tab found');
      }
    }
  } else {
    console.log('No tab ID provided');
  }
}