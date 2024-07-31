const SHARED_FILE_URL = 'http://localhost/tab_schedule.json';

chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });
chrome.alarms.create("syncSchedule", { periodInMinutes: 5 }); // Sync every 5 minutes

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  } else if (alarm.name === "syncSchedule") {
    syncScheduleWithNetwork();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFavicon") {
    // ... (keep existing getFavicon code)
  } else if (request.action === "updateSchedule") {
    chrome.storage.local.set({ schedule: request.schedule }, async () => {
      await syncScheduleWithNetwork();
      sendResponse({ status: 'success' });
    });
    return true; // Keeps the message channel open for async sendResponse
  }
});

async function syncScheduleWithNetwork() {
  try {
    const response = await fetch(SHARED_FILE_URL);
    if (response.ok) {
      const networkSchedule = await response.json();
      const { schedule: localSchedule } = await chrome.storage.local.get('schedule');
      
      const mergedSchedule = mergeSchedules(networkSchedule, localSchedule);
      
      await chrome.storage.local.set({schedule: mergedSchedule});
      
      await writeScheduleToNetwork(mergedSchedule);
    }
  } catch (error) {
    console.error('Error syncing schedule:', error);
  }
}

function mergeSchedules(networkSchedule, localSchedule) {
  const mergedSchedule = { recurring: {}, onetime: {} };

  // Merge recurring events
  for (const day in {...networkSchedule.recurring, ...localSchedule.recurring}) {
    mergedSchedule.recurring[day] = [
      ...(networkSchedule.recurring[day] || []),
      ...(localSchedule.recurring[day] || [])
    ];
    // Remove duplicates
    mergedSchedule.recurring[day] = Array.from(new Set(mergedSchedule.recurring[day].map(JSON.stringify))).map(JSON.parse);
  }

  // Merge one-time events
  for (const date in {...networkSchedule.onetime, ...localSchedule.onetime}) {
    mergedSchedule.onetime[date] = [
      ...(networkSchedule.onetime[date] || []),
      ...(localSchedule.onetime[date] || [])
    ];
    // Remove duplicates
    mergedSchedule.onetime[date] = Array.from(new Set(mergedSchedule.onetime[date].map(JSON.stringify))).map(JSON.parse);
  }

  return mergedSchedule;
}

async function writeScheduleToNetwork(schedule) {
  console.log('Attempting to write schedule to network...');
  try {
    const response = await fetch(SHARED_FILE_URL, {
      method: 'PUT',
      body: JSON.stringify(schedule),
      headers: {
        'Content-Type': 'application/json'
      }
    });
    
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    
    console.log('Schedule successfully written to network');
  } catch (error) {
    console.error('Error writing schedule to network:', error);
  }
}


async function checkAndSwitchTabs() {
  const { schedule } = await chrome.storage.local.get('schedule');
  if (!schedule) return;

  const now = new Date();
  const day = now.toLocaleString('en-us', {weekday: 'long'}).toLowerCase();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const time = now.toTimeString().slice(0, 5); // HH:MM format

  // Check recurring schedule
  if (schedule.recurring && schedule.recurring[day]) {
    const matchingItem = schedule.recurring[day].find(item => item.time === time);
    if (matchingItem) {
      switchToTab(matchingItem);
    }
  }

  // Check one-time schedule
  if (schedule.onetime && schedule.onetime[date]) {
    const matchingItem = schedule.onetime[date].find(item => item.time === time);
    if (matchingItem) {
      switchToTab(matchingItem);
      // Remove the one-time event after it's triggered
      schedule.onetime[date] = schedule.onetime[date].filter(item => item.time !== time);
      await chrome.storage.local.set({schedule});
      syncScheduleWithNetwork();
    }
  }
}

async function switchToTab(tabInfo) {
  console.log('Attempting to switch to tab:', tabInfo);
  try {
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
        throw new Error('Tab not found by ID');
      }
    } else {
      throw new Error('No tab ID provided');
    }
  } catch (error) {
    console.log('Error occurred, searching by title:', tabInfo.title);
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
}