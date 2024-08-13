import { syncScheduleWithNetwork, mergeSchedules, mergeArrays, cleanupSchedule, writeScheduleToNetwork } from './shared.js';
import { SHARED_FILE_URL } from './shared.js';

console.log(SHARED_FILE_URL);

document.addEventListener('DOMContentLoaded', async function() {
  try {
    await syncScheduleWithNetwork();
    await populateTabDropdown();
    await cleanupPastEvents();
    await updateScheduleDisplay();
    setupEventListeners();
  } catch (error) {
    console.error('Error during DOMContentLoaded:', error);
  }
});

async function cleanupPastEvents() {
  try {
    const { schedule } = await chrome.storage.local.get('schedule');
    let updatedSchedule = schedule || { recurring: {}, onetime: {} };
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    for (let date in updatedSchedule.onetime) {
      if (new Date(date) < today) {
        delete updatedSchedule.onetime[date];
      }
    }
    await chrome.storage.local.set({ schedule: updatedSchedule });
    chrome.runtime.sendMessage({ action: 'updateSchedule', schedule: updatedSchedule });
  } catch (error) {
    console.error('Error in cleanupPastEvents:', error);
  }
}

async function populateTabDropdown() {
  try {
    const tabs = await chrome.tabs.query({});
    const tabSelect = document.getElementById('tabSelect');
    if (tabSelect) {
      tabSelect.innerHTML = '';
      tabs.forEach((tab) => {
        const option = document.createElement('option');
        option.value = tab.id;
        option.textContent = tab.title.length > 50 ? tab.title.substring(0, 47) + '...' : tab.title;
        tabSelect.appendChild(option);
      });
    } else {
      console.error('tabSelect element not found');
    }
  } catch (error) {
    console.error('Error in populateTabDropdown:', error);
  }
}

function setupEventListeners() {
  const scheduleTypeElement = document.getElementById('scheduleType');
  const addScheduleElement = document.getElementById('addSchedule');

  if (scheduleTypeElement) {
    scheduleTypeElement.addEventListener('change', function() {
      const isRecurring = this.value === 'recurring';
      document.getElementById('day').style.display = isRecurring ? 'block' : 'none';
      document.getElementById('dateInput').style.display = isRecurring ? 'none' : 'block';
    });
  } else {
    console.error('scheduleType element not found');
  }

  if (addScheduleElement) {
    addScheduleElement.addEventListener('click', addScheduleItem);
  } else {
    console.error('addSchedule element not found');
  }
}

async function getFavicon(tabId) {
  return new Promise((resolve, reject) => {
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
  try {
    const { schedule } = await chrome.storage.local.get('schedule');
    let cleanedSchedule = await cleanupSchedule(schedule);
    let displayHtml = '<h3>Current Schedule:</h3>';
    displayHtml += '<h4>Recurring Events:</h4>';
    for (let day in cleanedSchedule.recurring) {
      displayHtml += `<strong>${day.charAt(0).toUpperCase() + day.slice(1)}:</strong><br>`;
      for (const item of cleanedSchedule.recurring[day]) {
        const faviconUrl = await getFavicon(item.id).catch(() => 'default_favicon.png');
        displayHtml += `
          <div class="event-item" data-id="${item.id}" data-day="${day}" data-type="recurring">
            <img src="${faviconUrl}" class="favicon" alt="Favicon">
            <span class="tab-title">${item.title}</span>
            <label class="reload-label">
              <input type="checkbox" ${item.reload ? 'checked' : ''} class="reload-checkbox"> Reload
            </label>
            <button class="remove-item">X</button>
          </div>`;
      }
    }
    displayHtml += '<h4>One-Time Events:</h4>';
    for (let date in cleanedSchedule.onetime) {
      displayHtml += `<strong>${new Date(date).toDateString()}:</strong><br>`;
      for (const item of cleanedSchedule.onetime[date]) {
        const faviconUrl = await getFavicon(item.id).catch(() => 'default_favicon.png');
        displayHtml += `
          <div class="event-item" data-id="${item.id}" data-date="${date}" data-type="onetime">
            <img src="${faviconUrl}" class="favicon" alt="Favicon">
            <span class="tab-title">${item.title}</span>
            <label class="reload-label">
              <input type="checkbox" ${item.reload ? 'checked' : ''} class="reload-checkbox"> Reload
            </label>
            <button class="remove-item">X</button>
          </div>`;
      }
    }
    document.getElementById('currentSchedule').innerHTML = displayHtml;
    
    // Add event listeners for reload checkboxes and remove buttons
    document.querySelectorAll('.reload-checkbox').forEach(checkbox => {
      checkbox.addEventListener('change', handleReloadChange);
    });
    document.querySelectorAll('.remove-item').forEach(button => {
      button.addEventListener('click', handleRemoveItem);
    });
  } catch (error) {
    console.error('Error in updateScheduleDisplay:', error);
  }
}

async function handleReloadChange(event) {
  const checkbox = event.target;
  const eventItem = checkbox.closest('.event-item');
  const id = eventItem.dataset.id;
  const dateOrDay = eventItem.dataset.day || eventItem.dataset.date;
  const type = eventItem.dataset.type;

  try {
    let { schedule } = await chrome.storage.local.get('schedule');
    if (type === 'recurring') {
      const item = schedule.recurring[dateOrDay].find(item => item.id === id);
      if (item) item.reload = checkbox.checked;
    } else {
      const item = schedule.onetime[dateOrDay].find(item => item.id === id);
      if (item) item.reload = checkbox.checked;
    }
    await chrome.storage.local.set({ schedule });
    await syncScheduleWithNetwork();
  } catch (error) {
    console.error('Error in handleReloadChange:', error);
  }
}

async function handleRemoveItem(event) {
  const button = event.target;
  const eventItem = button.closest('.event-item');
  const id = eventItem.dataset.id;
  const dateOrDay = eventItem.dataset.day || eventItem.dataset.date;
  const type = eventItem.dataset.type;

  try {
    let { schedule } = await chrome.storage.local.get('schedule');
    if (type === 'recurring') {
      schedule.recurring[dateOrDay] = schedule.recurring[dateOrDay].filter(item => item.id !== id);
    } else {
      schedule.onetime[dateOrDay] = schedule.onetime[dateOrDay].filter(item => item.id !== id);
    }
    await chrome.storage.local.set({ schedule });
    await syncScheduleWithNetwork();
    await updateScheduleDisplay();
  } catch (error) {
    console.error('Error in handleRemoveItem:', error);
  }
}


async function removeScheduleItem(id, dateOrDay, type) {
  try {
      let { schedule } = await chrome.storage.local.get('schedule');
      if (type === 'recurring') {
          schedule.recurring[dateOrDay] = schedule.recurring[dateOrDay].filter(item => item.id !== id);
      } else {
          schedule.onetime[dateOrDay] = schedule.onetime[dateOrDay].filter(item => item.id !== id);
      }
      await chrome.storage.local.set({ schedule });
      // Trigger sync after successful local update
      await syncScheduleWithNetwork();
      updateScheduleDisplay();
  } catch (error) {
      console.error('Error in removeScheduleItem:', error);
  }
}

async function updateReloadSetting(checkbox, id, dateOrDay, type) {
  try {
      let { schedule } = await chrome.storage.local.get('schedule');
      if (type === 'recurring') {
          const item = schedule.recurring[dateOrDay].find(item => item.id === id);
          if (item) item.reload = checkbox.checked;
      } else {
          const item = schedule.onetime[dateOrDay].find(item => item.id === id);
          if (item) item.reload = checkbox.checked;
      }
      await chrome.storage.local.set({ schedule });
      // Trigger sync after successful local update
      await syncScheduleWithNetwork();
  } catch (error) {
      console.error('Error in updateReloadSetting:', error);
  }
}


async function addScheduleItem() {
  try {
    const scheduleType = document.getElementById('scheduleType').value;
    const tabId = document.getElementById('tabSelect').value;
    const tab = await chrome.tabs.get(parseInt(tabId));
    const title = tab.title;
    const reloadElement = document.getElementById('reload');
    const reload = reloadElement ? reloadElement.checked : false;
    let date;
    let time;

    if (scheduleType === 'recurring') {
      date = document.getElementById('day').value.toLowerCase();
      time = document.getElementById('time').value;
    } else {
      date = document.getElementById('dateInput').value;
      time = '00:00';
    }

    const newItem = { id: tabId, title, time, reload };
    let { schedule } = await chrome.storage.local.get('schedule');
    schedule = schedule || { recurring: {}, onetime: {} };
    schedule[scheduleType][date] = schedule[scheduleType][date] || [];
    schedule[scheduleType][date].push(newItem);
    await chrome.storage.local.set({ schedule });
    await updateScheduleDisplay();
    document.getElementById('tabSelect').value = '';
    if (reloadElement) {
      reloadElement.checked = false;
    }
  } catch (error) {
    console.error('Error in addScheduleItem:', error);
  }
}

// Add these lines at the end of the file
window.removeScheduleItem = removeScheduleItem;
window.updateReloadSetting = updateReloadSetting;