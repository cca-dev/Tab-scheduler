// SHARED.JS

export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

export async function syncScheduleWithNetwork() {
  try {
    console.log('Starting syncScheduleWithNetwork');

    // Fetch network schedule
    const networkSchedule = await fetchNetworkSchedule();
    console.log('Network schedule:', networkSchedule);

    // Get local schedule
    const { schedule: localSchedule } = await chrome.storage.local.get('schedule');
    console.log('Local schedule:', localSchedule);

    // Merge schedules, prioritizing network schedule
    const mergedSchedule = mergeSchedules(networkSchedule, localSchedule || { recurring: {}, onetime: {} });
    console.log('Merged schedule:', mergedSchedule);

    // Clean up the merged schedule
    const cleanedSchedule = await cleanupSchedule(mergedSchedule);
    console.log('Cleaned schedule:', cleanedSchedule);

    // Write the cleaned schedule back to the network
    const writeSuccess = await writeScheduleToNetwork(cleanedSchedule);
    if (!writeSuccess) {
      console.error('Failed to write merged schedule to network');
      return false;
    }

    // Update local storage with the cleaned schedule
    await chrome.storage.local.set({ schedule: cleanedSchedule });
    console.log('Updated local storage with cleaned schedule');

    console.log('Successfully synced schedule');
    return true;
  } catch (error) {
    console.error('Error syncing schedule:', error);
    return false;
  }
}

async function fetchNetworkSchedule() {
  const response = await fetch(SHARED_FILE_URL);
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return await response.json();
}

export function mergeSchedules(networkSchedule, localSchedule) {
  const mergedSchedule = JSON.parse(JSON.stringify(networkSchedule));

  // Merge recurring events
  for (const day in localSchedule.recurring) {
    if (!mergedSchedule.recurring[day]) {
      mergedSchedule.recurring[day] = [];
    }
    mergedSchedule.recurring[day] = mergeArrays(mergedSchedule.recurring[day], localSchedule.recurring[day]);
  }

  // Merge one-time events
  for (const date in localSchedule.onetime) {
    if (!mergedSchedule.onetime[date]) {
      mergedSchedule.onetime[date] = [];
    }
    mergedSchedule.onetime[date] = mergeArrays(mergedSchedule.onetime[date], localSchedule.onetime[date]);
  }

  return mergedSchedule;
}

export function mergeArrays(arr1, arr2) {
  const merged = [...arr1];
  for (const item of arr2) {
    const existingIndex = merged.findIndex(e => e.id === item.id && e.time === item.time);
    if (existingIndex === -1) {
      merged.push(item);
    } else {
      merged[existingIndex] = { ...merged[existingIndex], ...item };
    }
  }
  return merged;
}

export async function cleanupSchedule(schedule) {
  if (!schedule || (Object.keys(schedule.recurring || {}).length === 0 && Object.keys(schedule.onetime || {}).length === 0)) {
    return { recurring: {}, onetime: {} };
  }

  const cleanSchedule = { recurring: {}, onetime: {} };
  const allTabs = await chrome.tabs.query({});
  const existingTabIds = new Set(allTabs.map(tab => tab.id.toString()));

  for (const day in schedule.recurring || {}) {
    cleanSchedule.recurring[day] = (schedule.recurring[day] || []).filter(item => existingTabIds.has(item.id.toString()));
    if (cleanSchedule.recurring[day].length === 0) {
      delete cleanSchedule.recurring[day];
    }
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (const date in schedule.onetime || {}) {
    if (new Date(date) >= today) {
      cleanSchedule.onetime[date] = (schedule.onetime[date] || []).filter(item => existingTabIds.has(item.id.toString()));
      if (cleanSchedule.onetime[date].length === 0) {
        delete cleanSchedule.onetime[date];
      }
    }
  }

  return cleanSchedule;
}

export async function writeScheduleToNetwork(schedule) {
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

    await new Promise(resolve => setTimeout(resolve, 2000));

    const verificationResponse = await fetch(SHARED_FILE_URL);
    const updatedContent = await verificationResponse.json();

    if (JSON.stringify(updatedContent) === JSON.stringify(schedule)) {
      console.log('Network write verified successfully');
      return true;
    } else {
      console.error('Network write verification failed');
      return false;
    }
  } catch (error) {
    console.error('Error writing schedule to network:', error);
    return false;
  }
}