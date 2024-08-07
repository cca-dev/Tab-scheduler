const SHARED_FILE_URL = 'https://localhost:44300/tab_schedule.json';

// Log all network requests (for debugging)
chrome.webRequest.onBeforeRequest.addListener(
  function(details) {
    console.log('Network request:', details);
  },
  {urls: ["<all_urls>"]}
);

chrome.alarms.create("checkSchedule", { periodInMinutes: 1 });
chrome.alarms.create("syncSchedule", { periodInMinutes: 5 }); // Sync every 5 minutes
chrome.alarms.create("cleanupTabs", { periodInMinutes: 15 }); // Cleanup every 15 minutes

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
    return true; // Keeps the message channel open for async sendResponse
  } else if (request.action === "updateSchedule") {
    chrome.storage.local.set({ schedule: request.schedule }, async () => {
      const syncResult = await syncScheduleWithNetwork();
      sendResponse({ status: syncResult ? 'success' : 'failure' });
    });
    return true; // Keeps the message channel open for async sendResponse
  }
});

async function syncScheduleWithNetwork() {
  try {
    const { schedule } = await chrome.storage.local.get('schedule');
    const writeSuccess = await writeScheduleToNetwork(schedule);
    if (!writeSuccess) {
      console.error('Failed to write schedule to network');
      return false;
    }
    return true;
  } catch (error) {
    console.error('Error syncing schedule:', error);
    return false;
  }
}

async function writeScheduleToNetwork(schedule) {
  console.log('Attempting to write schedule to network...');
  console.log('Schedule to write:', JSON.stringify(schedule, null, 2));
  try {
    const response = await fetch(SHARED_FILE_URL, {
      method: 'POST',
      body: JSON.stringify(schedule),
      headers: {
        'Content-Type': 'application/json'
      }
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const responseText = await response.text();
    console.log('Response from write operation:', responseText);

    // Introduce a delay before verification
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify if the file was actually updated
    const verificationResponse = await fetch(SHARED_FILE_URL);
    const updatedContent = await verificationResponse.json();
    console.log('Updated file content:', JSON.stringify(updatedContent, null, 2));

    if (JSON.stringify(updatedContent) === JSON.stringify(schedule)) {
      console.log('Schedule successfully written and verified on network');
      return true;
    } else {
      console.warn('Write operation completed, but content verification failed');
      console.log('Expected:', JSON.stringify(schedule, null, 2));
      console.log('Actual:', JSON.stringify(updatedContent, null, 2));
      return false;
    }
  } catch (error) {
    console.error('Error writing schedule to network:', error);
    console.error('Error details:', error.message);
    console.error('Error stack:', error.stack);
    return false;
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
    await chrome.storage.local.set({schedule: updatedSchedule});
    await syncScheduleWithNetwork();
  }
}