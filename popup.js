const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

document.addEventListener('DOMContentLoaded', async function() {
  await syncScheduleWithNetwork();
  await populateTabDropdown();
  await cleanupPastEvents();
  updateScheduleDisplay();
  setupEventListeners();
});

async function syncScheduleWithNetwork() {
  console.log('Starting syncScheduleWithNetwork');
  try {
    const response = await fetch(SHARED_FILE_URL);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const networkSchedule = await response.json();
    console.log('Network schedule:', JSON.stringify(networkSchedule, null, 2));

    const { schedule: localSchedule } = await chrome.storage.local.get('schedule');
    console.log('Local schedule:', JSON.stringify(localSchedule, null, 2));
    
    const mergedSchedule = mergeSchedules(localSchedule || { recurring: {}, onetime: {} }, networkSchedule);
    console.log('Merged schedule:', JSON.stringify(mergedSchedule, null, 2));
    
    await chrome.storage.local.set({ schedule: mergedSchedule });
    console.log('Local storage updated with merged schedule');

    const writeSuccess = await writeScheduleToNetwork(mergedSchedule);
    if (!writeSuccess) {
      console.error('Failed to write merged schedule to network');
      return false;
    }
    console.log('Successfully synced schedule with network');
    return true;
  } catch (error) {
    console.error('Error syncing schedule:', error);
    return false;
  }
}

function mergeSchedules(localSchedule, networkSchedule) {
  console.log('Merging schedules');
  console.log('Local schedule:', JSON.stringify(localSchedule, null, 2));
  console.log('Network schedule:', JSON.stringify(networkSchedule, null, 2));

  const mergedSchedule = { recurring: {}, onetime: {} };

  // Merge recurring schedules
  const allDays = [...new Set([...Object.keys(localSchedule.recurring || {}), ...Object.keys(networkSchedule.recurring || {})])];
  for (const day of allDays) {
    mergedSchedule.recurring[day] = mergeArrays(localSchedule.recurring?.[day] || [], networkSchedule.recurring?.[day] || []);
  }

  // Merge one-time schedules
  const allDates = [...new Set([...Object.keys(localSchedule.onetime || {}), ...Object.keys(networkSchedule.onetime || {})])];
  for (const date of allDates) {
    mergedSchedule.onetime[date] = mergeArrays(localSchedule.onetime?.[date] || [], networkSchedule.onetime?.[date] || []);
  }

  console.log('Merged schedule:', JSON.stringify(mergedSchedule, null, 2));
  return mergedSchedule;
}

function mergeArrays(arr1, arr2) {
  const merged = [...arr1];
  for (const item of arr2) {
    const existingIndex = merged.findIndex(e => e.id === item.id && e.time === item.time);
    if (existingIndex === -1) {
      merged.push(item);
    } else {
      // If the item already exists, use the most recent version
      merged[existingIndex] = { ...merged[existingIndex], ...item };
    }
  }
  return merged;
}

async function cleanupPastEvents() {
  const { schedule } = await chrome.storage.local.get('schedule');
  let updatedSchedule = schedule || { recurring: {}, onetime: {} };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let date in updatedSchedule.onetime) {
    if (new Date(date) < today) {
      delete updatedSchedule.onetime[date];
    }
  }

  await chrome.storage.local.set({schedule: updatedSchedule});
  chrome.runtime.sendMessage({action: 'updateSchedule', schedule: updatedSchedule});
}

async function populateTabDropdown() {
  const tabs = await chrome.tabs.query({});
  const tabSelect = document.getElementById('tabSelect');
  tabSelect.innerHTML = '';
  tabs.forEach((tab) => {
    const option = document.createElement('option');
    option.value = tab.id;
    option.textContent = tab.title.length > 50 ? tab.title.substring(0, 47) + '...' : tab.title;
    tabSelect.appendChild(option);
  });
}

function setupEventListeners() {
  document.getElementById('scheduleType').addEventListener('change', function() {
    const isRecurring = this.value === 'recurring';
    document.getElementById('day').style.display = isRecurring ? 'block' : 'none';
    document.getElementById('dateInput').style.display = isRecurring ? 'none' : 'block';
  });

  document.getElementById('addSchedule').addEventListener('click', addScheduleItem);
}

async function getFavicon(tabId) {
  return new Promise((resolve) => {
    chrome.tabs.get(parseInt(tabId), (tab) => {
      if (chrome.runtime.lastError) {
        console.log(`Tab ${tabId} not found:`, chrome.runtime.lastError.message);
        resolve('default_favicon.png');
      } else {
        resolve(tab.favIconUrl || 'default_favicon.png');
      }
    });
  });
}

async function updateScheduleDisplay() {
  const { schedule } = await chrome.storage.local.get('schedule');
  let displayHtml = '<h3>Current Schedule:</h3>';

  displayHtml += '<h4>Recurring Events:</h4>';
  for (let day in schedule.recurring) {
    displayHtml += `<strong>${day.charAt(0).toUpperCase() + day.slice(1)}:</strong><br>`;
    for (const item of schedule.recurring[day]) {
      const faviconUrl = await getFavicon(item.id).catch(() => 'default_favicon.png');
      displayHtml += `<div class="event-item">
        <img src="${faviconUrl}" class="favicon" alt="Favicon">
        <span class="tab-title">${item.title}</span>
        <label class="reload-label">
          <input type="checkbox" class="reload-checkbox" 
                 ${item.reload ? 'checked' : ''}
                 data-type="recurring" data-day="${day}" data-index="${schedule.recurring[day].indexOf(item)}">
          Reload
        </label>
        <span class="delete-btn" data-type="recurring" data-day="${day}" data-index="${schedule.recurring[day].indexOf(item)}">&times;</span>
      </div>`;
    }
  }

  displayHtml += '<h4>One-time Events:</h4>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sortedDates = Object.keys(schedule.onetime).sort();

  for (let date of sortedDates) {
    if (new Date(date) >= today) {
      displayHtml += `<strong>${date}:</strong><br>`;
      for (const item of schedule.onetime[date]) {
        const faviconUrl = await getFavicon(item.id).catch(() => 'default_favicon.png');
        displayHtml += `<div class="event-item">
          <img src="${faviconUrl}" class="favicon" alt="Favicon">
          <span class="tab-title">${item.title}</span>
          <label class="reload-label">
            <input type="checkbox" class="reload-checkbox" 
                   ${item.reload ? 'checked' : ''}
                   data-type="onetime" data-date="${date}" data-index="${schedule.onetime[date].indexOf(item)}">
            Reload
          </label>
          <span class="delete-btn" data-type="onetime" data-date="${date}" data-index="${schedule.onetime[date].indexOf(item)}">&times;</span>
        </div>`;
      }
    }
  }

  document.getElementById('currentSchedule').innerHTML = displayHtml;
  addDeleteEventListeners();
  addReloadCheckboxListeners();
}

async function addScheduleItem() {
  const scheduleType = document.getElementById('scheduleType').value;
  const day = document.getElementById('day').value;
  const date = document.getElementById('dateInput').value;
  const time = document.getElementById('time').value;
  const tabSelect = document.getElementById('tabSelect');
  const selectedTabId = parseInt(tabSelect.value);
  const selectedTabTitle = tabSelect.options[tabSelect.selectedIndex].text;
  
  const reloadCheckbox = document.getElementById('reloadCheckbox');
  const reload = reloadCheckbox ? reloadCheckbox.checked : false;

  const { schedule } = await chrome.storage.local.get('schedule');
  let updatedSchedule = schedule || { recurring: {}, onetime: {} };

  const scheduleItem = {
    id: selectedTabId,
    title: selectedTabTitle,
    time: time,
    reload: reload
  };

  if (scheduleType === 'recurring') {
    if (!updatedSchedule.recurring[day]) updatedSchedule.recurring[day] = [];
    // Remove any existing entries for this tab at this time
    updatedSchedule.recurring[day] = updatedSchedule.recurring[day].filter(item => 
      item.id !== selectedTabId || item.time !== time
    );
    updatedSchedule.recurring[day].push(scheduleItem);
  } else {
    if (!updatedSchedule.onetime[date]) updatedSchedule.onetime[date] = [];
    // Remove any existing entries for this tab at this time
    updatedSchedule.onetime[date] = updatedSchedule.onetime[date].filter(item => 
      item.id !== selectedTabId || item.time !== time
    );
    updatedSchedule.onetime[date].push(scheduleItem);
  }

  await chrome.storage.local.set({schedule: updatedSchedule});
  await syncScheduleWithNetwork();
  updateScheduleDisplay();
}

function addDeleteEventListeners() {
  const deleteButtons = document.querySelectorAll('.delete-btn');
  deleteButtons.forEach(button => {
    button.addEventListener('click', confirmDelete);
  });
}

function confirmDelete(event) {
  const type = event.target.dataset.type;
  const index = event.target.dataset.index;
  const day = event.target.dataset.day;
  const date = event.target.dataset.date;

  if (confirm('Are you sure you want to delete this event?')) {
    deleteEvent(type, index, day, date);
  }
}

function addReloadCheckboxListeners() {
  const checkboxes = document.querySelectorAll('.reload-checkbox');
  checkboxes.forEach(checkbox => {
    checkbox.addEventListener('change', updateReloadSetting);
  });
}

async function updateReloadSetting(event) {
  console.log('Starting updateReloadSetting');
  const type = event.target.dataset.type;
  const index = parseInt(event.target.dataset.index);
  const day = event.target.dataset.day;
  const date = event.target.dataset.date;
  const reload = event.target.checked;
  console.log('Update details:', { type, index, day, date, reload });

  try {
    const { schedule } = await chrome.storage.local.get('schedule');
    console.log('Current schedule:', JSON.stringify(schedule, null, 2));
    let updatedSchedule = JSON.parse(JSON.stringify(schedule));

    let tabToUpdate;
    if (type === 'recurring' && day && updatedSchedule.recurring[day]) {
      tabToUpdate = updatedSchedule.recurring[day][index];
    } else if (type === 'onetime' && date && updatedSchedule.onetime[date]) {
      tabToUpdate = updatedSchedule.onetime[date][index];
    }

    if (tabToUpdate) {
      // Check if the tab still exists
      try {
        await chrome.tabs.get(parseInt(tabToUpdate.id));
        tabToUpdate.reload = reload;
        console.log(`Updated ${type} event for ${day || date} at index ${index}`);
      } catch (error) {
        console.error(`Tab ${tabToUpdate.id} no longer exists. Removing from schedule.`);
        if (type === 'recurring') {
          updatedSchedule.recurring[day].splice(index, 1);
        } else {
          updatedSchedule.onetime[date].splice(index, 1);
        }
      }
    } else {
      console.error('Invalid type or missing day/date, or index out of bounds');
    }

    console.log('Updated schedule:', JSON.stringify(updatedSchedule, null, 2));

    await chrome.storage.local.set({schedule: updatedSchedule});
    console.log('Local storage updated');

    const syncSuccess = await syncScheduleWithNetwork();
    
    if (!syncSuccess) {
      console.error('Failed to sync schedule with network');
    } else {
      console.log('Successfully synced schedule with network');
    }

    // Force a refresh of the display
    await updateScheduleDisplay();
  } catch (error) {
    console.error('Error in updateReloadSetting:', error);
  }
}

async function deleteEvent(type, index, day, date) {
  console.log('Starting deleteEvent');
  console.log('Delete details:', { type, index, day, date });

  const { schedule } = await chrome.storage.local.get('schedule');
  console.log('Current schedule:', schedule);
  let updatedSchedule = JSON.parse(JSON.stringify(schedule)) || { recurring: {}, onetime: {} };

  if (type === 'recurring') {
    updatedSchedule.recurring[day].splice(index, 1);
    if (updatedSchedule.recurring[day].length === 0) {
      delete updatedSchedule.recurring[day];
    }
  } else if (type === 'onetime') {
    updatedSchedule.onetime[date].splice(index, 1);
    if (updatedSchedule.onetime[date].length === 0) {
      delete updatedSchedule.onetime[date];
    }
  }

  // Cleanup missing tabs
  updatedSchedule = await cleanupSchedule(updatedSchedule);

  console.log('Updated schedule:', updatedSchedule);

  await chrome.storage.local.set({schedule: updatedSchedule});
  console.log('Local storage updated');

  const syncSuccess = await syncScheduleWithNetwork();
  
  if (syncSuccess) {
    console.log('Successfully synced schedule with network');
    await updateScheduleDisplay();
  } else {
    console.error('Failed to sync schedule with network');
    // Optionally, you can show an error message to the user here
  }
}

async function writeScheduleToNetwork(schedule) {
  console.log('Starting writeScheduleToNetwork');
  
  // Cleanup non-existent tabs before writing
  const cleanSchedule = await cleanupSchedule(schedule);
  
  console.log('Cleaned schedule to write:', JSON.stringify(cleanSchedule, null, 2));
  try {
    const response = await fetch(SHARED_FILE_URL, {
      method: 'POST',
      body: JSON.stringify(cleanSchedule),
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
    console.log('Waiting 2 seconds before verification...');
    await new Promise(resolve => setTimeout(resolve, 2000));

    // Verify if the file was actually updated
    console.log('Verifying update...');
    const verificationResponse = await fetch(SHARED_FILE_URL);
    if (!verificationResponse.ok) {
      throw new Error(`HTTP error during verification! status: ${verificationResponse.status}`);
    }
    const updatedContent = await verificationResponse.json();
    console.log('Updated file content:', JSON.stringify(updatedContent, null, 2));

    const isEqual = JSON.stringify(updatedContent) === JSON.stringify(cleanSchedule);
    console.log('Verification result:', isEqual ? 'Success' : 'Failure');

    if (isEqual) {
      console.log('Schedule successfully written and verified on network');
      return true;
    } else {
      console.warn('Write operation completed, but content verification failed');
      console.log('Expected:', JSON.stringify(cleanSchedule, null, 2));
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

async function cleanupSchedule(schedule) {
  const cleanSchedule = { recurring: {}, onetime: {} };
  const allTabs = await chrome.tabs.query({});
  const existingTabIds = new Set(allTabs.map(tab => tab.id));

  for (const day in schedule.recurring) {
    cleanSchedule.recurring[day] = schedule.recurring[day].filter(item => existingTabIds.has(parseInt(item.id)));
    if (cleanSchedule.recurring[day].length === 0) {
      delete cleanSchedule.recurring[day];
    }
  }

  for (const date in schedule.onetime) {
    cleanSchedule.onetime[date] = schedule.onetime[date].filter(item => existingTabIds.has(parseInt(item.id)));
    if (cleanSchedule.onetime[date].length === 0) {
      delete cleanSchedule.onetime[date];
    }
  }

  // Remove empty date entries from onetime schedule
  for (const date in cleanSchedule.onetime) {
    if (cleanSchedule.onetime[date].length === 0) {
      delete cleanSchedule.onetime[date];
    }
  }

  return cleanSchedule;
}