// SHARED.JS
// constants.js

export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

async function syncScheduleWithNetwork() {
    try {
      const response = await fetch(SHARED_FILE_URL);
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      const networkSchedule = await response.json();
      const { schedule: localSchedule } = await chrome.storage.local.get('schedule');
      
      const mergedSchedule = mergeSchedules(localSchedule || { recurring: {}, onetime: {} }, networkSchedule);
      
      const cleanedSchedule = await cleanupSchedule(mergedSchedule);
      
      await chrome.storage.local.set({ schedule: cleanedSchedule });
      const writeSuccess = await writeScheduleToNetwork(cleanedSchedule);
      if (!writeSuccess) {
        console.error('Failed to write merged schedule to network');
        return false;
      }
      return true;
    } catch (error) {
      console.error('Error syncing schedule:', error);
      return false;
    }
  }
  
  function mergeSchedules(localSchedule, networkSchedule) {
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
  
  function mergeArrays(arr1, arr2) {
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
  
  async function cleanupSchedule(schedule) {
    if (!schedule || (Object.keys(schedule.recurring || {}).length === 0 && Object.keys(schedule.onetime || {}).length === 0)) {
      return { recurring: {}, onetime: {} };
    }
  
    const cleanSchedule = { recurring: {}, onetime: {} };
    const allTabs = await chrome.tabs.query({});
    const existingTabIds = new Set(allTabs.map(tab => tab.id));
  
    for (const day in schedule.recurring || {}) {
      cleanSchedule.recurring[day] = (schedule.recurring[day] || []).filter(item => existingTabIds.has(parseInt(item.id)));
      if (cleanSchedule.recurring[day].length === 0) {
        delete cleanSchedule.recurring[day];
      }
    }
  
    for (const date in schedule.onetime || {}) {
      cleanSchedule.onetime[date] = (schedule.onetime[date] || []).filter(item => existingTabIds.has(parseInt(item.id)));
      if (cleanSchedule.onetime[date].length === 0) {
        delete cleanSchedule.onetime[date];
      }
    }
  
    return cleanSchedule;
  }
  
  async function writeScheduleToNetwork(schedule) {
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
        return true;
      } else {
        return false;
      }
    } catch (error) {
      console.error('Error writing schedule to network:', error);
      return false;
    }
  }
  
  export {
    syncScheduleWithNetwork,
    mergeSchedules,
    mergeArrays,
    cleanupSchedule,
    writeScheduleToNetwork
};
