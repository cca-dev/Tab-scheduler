chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  }
});

function checkAndSwitchTabs() {
  chrome.storage.sync.get(['schedule'], function(result) {
    const schedule = result.schedule || {};
    const now = new Date();
    const day = now.toLocaleString('en-us', {weekday: 'long'}).toLowerCase();
    const time = now.toTimeString().slice(0, 5); // HH:MM format

    if (schedule[day] && schedule[day][time]) {
      const tabToSwitch = schedule[day][time];
      switchToTab(tabToSwitch);
    }
  });
}

function switchToTab(tabName) {
  chrome.tabs.query({}, function(tabs) {
    const tab = tabs.find(t => t.title.includes(tabName));
    if (tab) {
      chrome.tabs.update(tab.id, {active: true});
    }
  });
}