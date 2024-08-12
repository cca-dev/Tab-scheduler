import { syncScheduleWithNetwork, mergeSchedules, mergeArrays, cleanupSchedule, writeScheduleToNetwork } from './shared.js';

const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    console.log('Network request:', details);
  },
  {urls: ["<all_urls>"]}
);

chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });
chrome.alarms.create("syncSchedule", { periodInMinutes: 1 });
chrome.alarms.create("cleanupTabs", { periodInMinutes: 1 });

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  } else if (alarm.name === "syncSchedule") {
    syncScheduleWithNetwork();
  } else if (alarm.name === "cleanupTabs") {
    cleanupNonExistentTabs();
  }
});

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFavicon") {
    chrome.tabs.get(request.tabId, (tab) => {
      sendResponse({favIconUrl: tab.favIconUrl});
    });
    return true;
  } else if (request.action === "updateSchedule") {
    syncScheduleWithNetwork().then(syncResult => {
      sendResponse({ status: syncResult ? 'success' : 'failure' });
    });
    return true;
  }
});

async function checkAndSwitchTabs() {
  const { schedule } = await chrome.storage.local.get('schedule');
  if (!schedule) return;

  const now = new Date();
  const day = now.toLocaleString('en-us', {weekday: 'long'}).toLowerCase();
  const date = now.toISOString().split('T')[0];
  const time = now.toTimeString().slice(0, 5);

  if (schedule.recurring && schedule.recurring[day]) {
    const matchingItem = schedule.recurring[day].find(item => item.time === time);
    if (matchingItem) {
      switchToTab(matchingItem);
    }
  }

  if (schedule.onetime && schedule.onetime[date]) {
    const matchingItem = schedule.onetime[date].find(item => item.time === time);
    if (matchingItem) {
      switchToTab(matchingItem);
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

async function cleanupNonExistentTabs() {
  console.log('Starting cleanupNonExistentTabs');
  const { schedule } = await chrome.storage.local.get('schedule');
  let updatedSchedule = { recurring: {}, onetime: {} };
  let hasChanges = false;

  const allTabs = await chrome.tabs.query({});
  const existingTabIds = new Set(allTabs.map(tab => tab.id));

  for (const day in schedule.recurring) {
    updatedSchedule.recurring[day] = await Promise.all(schedule.recurring[day].filter(async (item) => {
      try {
        await chrome.tabs.get(parseInt(item.id));
        return true;
      } catch (error) {
        console.log(`Removing non-existent tab ${item.id} from recurring schedule for ${day}`);
        hasChanges = true;
        return false;
      }
    }));
    if (updatedSchedule.recurring[day].length === 0) {
      delete updatedSchedule.recurring[day];
    }
  }

  for (const date in schedule.onetime) {
    updatedSchedule.onetime[date] = await Promise.all(schedule.onetime[date].filter(async (item) => {
      try {
        await chrome.tabs.get(parseInt(item.id));
        return true;
      } catch (error) {
        console.log(`Removing non-existent tab ${item.id} from one-time schedule for ${date}`);
        hasChanges = true;
        return false;
      }
    }));
    if (updatedSchedule.onetime[date].length === 0) {
      delete updatedSchedule.onetime[date];
    }
  }

  if (hasChanges) {
    await chrome.storage.local.set({schedule: updatedSchedule});
    await syncScheduleWithNetwork();
  }
  
  console.log('Finished cleanupNonExistentTabs');
}

chrome.alarms.create("cleanupTabs", { periodInMinutes: 0.5 });
