const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

// Create alarms for periodic tasks
chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });
chrome.alarms.create("syncSchedule", { periodInMinutes: 5 }); // Sync every 5 minutes
chrome.alarms.create("cleanupTabs", { periodInMinutes: 1 }); // Cleanup every minute

// Listen for alarm triggers
chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === "checkSchedule") {
    checkAndSwitchTabs();
  } else if (alarm.name === "syncSchedule") {
    syncScheduleWithNetwork();
  } else if (alarm.name === "cleanupTabs") {
    cleanupNonExistentTabs();
  }
});

// Listen for messages from other parts of the extension
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === "getFavicon") {
    chrome.tabs.get(request.tabId, (tab) => {
      sendResponse({ favIconUrl: tab.favIconUrl });
    });
    return true; // Keeps the message channel open for async sendResponse
  } else if (request.action === "updateSchedule") {
    chrome.storage.local.set({ schedule: request.schedule }, async () => {
      const syncResult = await syncScheduleWithNetwork();
      sendResponse({ status: syncResult ? 'success' : 'failure' });
    });
    return true; // Keeps the message channel open for async sendResponse
  }
});

// Sync the local schedule with the network
async function syncScheduleWithNetwork() {
  try {
    const { schedule: localSchedule } = await chrome.storage.local.get('schedule');
    const currentSchedule = await fetchScheduleFromNetwork();
    
    if (currentSchedule) {
      const mergedSchedule = mergeSchedules(currentSchedule, localSchedule);
      const writeSuccess = await writeScheduleToNetwork(mergedSchedule);
      
      if (writeSuccess) {
        console.log('Schedule successfully synced');
      } else {
        console.error('Failed to sync schedule');
      }
    }
  } catch (error) {
    console.error('Error syncing schedule:', error);
  }
}

// Fetch the current schedule from the network
async function fetchScheduleFromNetwork() {
  try {
    const response = await fetch(SHARED_FILE_URL);
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    return await response.json();
  } catch (error) {
    console.error('Error fetching schedule from network:', error);
    return { recurring: {}, onetime: {} }; // Fallback to empty schedule
  }
}

// Merge the local schedule with the network schedule
function mergeSchedules(remoteSchedule, localSchedule) {
  return {
    recurring: { ...remoteSchedule.recurring, ...localSchedule.recurring },
    onetime: { ...remoteSchedule.onetime, ...localSchedule.onetime }
  };
}

// Write the schedule to the network and verify it
async function writeScheduleToNetwork(schedule) {
  try {
    const response = await fetch(SHARED_FILE_URL, {
      method: 'POST',
      body: JSON.stringify(schedule),
      headers: { 'Content-Type': 'application/json' }
    });
    if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`);
    
    // Verification step
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
    const verificationResponse = await fetch(SHARED_FILE_URL);
    const updatedContent = await verificationResponse.json();
    
    return JSON.stringify(updatedContent) === JSON.stringify(schedule);
  } catch (error) {
    console.error('Error writing schedule to network:', error);
    return false;
  }
}

// Check and switch tabs based on the schedule
async function checkAndSwitchTabs() {
  const { schedule } = await chrome.storage.local.get('schedule');
  if (!schedule) return;

  const now = new Date();
  const day = now.toLocaleString('en-us', { weekday: 'long' }).toLowerCase();
  const date = now.toISOString().split('T')[0]; // YYYY-MM-DD format
  const time = now.toTimeString().slice(0, 5); // HH:MM format

  // Check recurring schedule
  if (schedule.recurring && schedule.recurring[day]) {
    const matchingItem = schedule.recurring[day].find(item => item.time === time);
    if (matchingItem) {
      await switchToTab(matchingItem);
    }
  }

  // Check one-time schedule
  if (schedule.onetime && schedule.onetime[date]) {
    const matchingItem = schedule.onetime[date].find(item => item.time === time);
    if (matchingItem) {
      await switchToTab(matchingItem);
      // Remove the one-time event after it's triggered
      schedule.onetime[date] = schedule.onetime[date].filter(item => item.time !== time);
      await chrome.storage.local.set({ schedule });
      await syncScheduleWithNetwork();
    }
  }
}

// Switch to a tab based on the given tab information
async function switchToTab(tabInfo) {
  console.log('Attempting to switch to tab:', tabInfo);
  try {
    if (tabInfo.id) {
      const tab = await chrome.tabs.get(parseInt(tabInfo.id)).catch(() => null);
      if (tab) {
        console.log('Switching to tab with ID:', tab.id);
        await chrome.tabs.update(tab.id, { active: true });
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
      await chrome.tabs.update(matchingTab.id, { active: true });
      if (tabInfo.reload) {
        console.log('Reloading tab:', matchingTab.id);
        await chrome.tabs.reload(matchingTab.id);
      }
    } else {
      console.log('No matching tab found');
    }
  }
}

// Cleanup tabs that no longer exist
async function cleanupNonExistentTabs() {
  const { schedule } = await chrome.storage.local.get('schedule');
  let updatedSchedule = { recurring: {}, onetime: {} };
  let hasChanges = false;

  const allTabs = await chrome.tabs.query({});
  const existingTabIds = new Set(allTabs.map(tab => tab.id));

  for (const day in schedule.recurring) {
    updatedSchedule.recurring[day] = schedule.recurring[day].filter(item => {
      if (existingTabIds.has(parseInt(item.id))) {
        return true;
      }
      console.log(`Removing non-existent tab ${item.id} from recurring schedule for ${day}`);
      hasChanges = true;
      return false;
    });
    if (updatedSchedule.recurring[day].length === 0) {
      delete updatedSchedule.recurring[day];
    }
  }

  for (const date in schedule.onetime) {
    updatedSchedule.onetime[date] = schedule.onetime[date].filter(item => {
      if (existingTabIds.has(parseInt(item.id))) {
        return true;
      }
      console.log(`Removing non-existent tab ${item.id} from one-time schedule for ${date}`);
      hasChanges = true;
      return false;
    });
    if (updatedSchedule.onetime[date].length === 0) {
      delete updatedSchedule.onetime[date];
    }
  }

  if (hasChanges) {
    await chrome.storage.local.set({ schedule: updatedSchedule });
    await syncScheduleWithNetwork();
  }
}
