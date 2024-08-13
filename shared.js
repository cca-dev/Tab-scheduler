// SHARED.JS

export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

export async function syncScheduleWithNetwork() {
  try {
    const { schedule: localSchedule } = await chrome.storage.local.get('schedule');
    console.log('Local schedule before sync:', localSchedule);

    const response = await fetch(SHARED_FILE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const networkSchedule = await response.json();
    console.log('Network schedule:', networkSchedule);

    const mergedSchedule = mergeSchedules(localSchedule || { recurring: {}, onetime: {} }, networkSchedule);
    console.log('Merged schedule:', mergedSchedule);

    const cleanedSchedule = await cleanupSchedule(mergedSchedule);
    console.log('Cleaned schedule:', cleanedSchedule);

    await chrome.storage.local.set({ schedule: cleanedSchedule });
    console.log('Updated local storage with cleaned schedule');

    const writeSuccess = await writeScheduleToNetwork(cleanedSchedule);
    if (!writeSuccess) {
      console.error('Failed to write merged schedule to network');
      return false;
    }
    console.log('Successfully wrote schedule to network');
    return true;
  } catch (error) {
    console.error('Error syncing schedule:', error);
    return false;
  }
}

export function mergeSchedules(localSchedule, networkSchedule) {
  const mergedSchedule = { recurring: {}, onetime: {} };

  const allDays = [...new Set([...Object.keys(localSchedule.recurring || {}), ...Object.keys(networkSchedule.recurring || {})])];
  for (const day of allDays) {
    mergedSchedule.recurring[day] = mergeArrays(localSchedule.recurring?.[day] || [], networkSchedule.recurring?.[day] || []);
  }

  const allDates = [...new Set([...Object.keys(localSchedule.onetime || {}), ...Object.keys(networkSchedule.onetime || {})])];
  for (const date of allDates) {
    mergedSchedule.onetime[date] = mergeArrays(localSchedule.onetime?.[date] || [], networkSchedule.onetime?.[date] || []);
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

  for (const date in schedule.onetime || {}) {
    cleanSchedule.onetime[date] = (schedule.onetime[date] || []).filter(item => existingTabIds.has(item.id.toString()));
    if (cleanSchedule.onetime[date].length === 0) {
      delete cleanSchedule.onetime[date];
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

    const responseText = await response.text();
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
