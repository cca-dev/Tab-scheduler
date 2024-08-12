import { syncScheduleWithNetwork, mergeSchedules, mergeArrays, cleanupSchedule, writeScheduleToNetwork } from './shared.js';

import { SHARED_FILE_URL } from './shared.js';
console.log(SHARED_FILE_URL);

document.addEventListener('DOMContentLoaded', async function() {
  const { schedule } = await chrome.storage.local.get('schedule');
  const cleanedSchedule = await cleanupSchedule(schedule);
  await chrome.storage.local.set({ schedule: cleanedSchedule });
  
  await syncScheduleWithNetwork();
  await populateTabDropdown();
  await cleanupPastEvents();
  updateScheduleDisplay();
  setupEventListeners();
});

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
  let cleanedSchedule = await cleanupSchedule(schedule);
  
  await chrome.storage.local.set({ schedule: cleanedSchedule });

  let displayHtml = '<h3>Current Schedule:</h3>';

  displayHtml += '<h4>Recurring Events:</h4>';
  for (let day in cleanedSchedule.recurring) {
    displayHtml += `<strong>${day.charAt(0).toUpperCase() + day.slice(1)}:</strong><br>`;
    for (const item of cleanedSchedule.recurring[day]) {
      const faviconUrl = await getFavicon(item.id).catch(() => 'default_favicon.png');
      displayHtml += `<div class="event-item">
        <img src="${faviconUrl}" class="favicon" alt="Favicon">
        <span class="tab-title">${item.title}</span>
        <label class="reload-label">
          <input type="checkbox" ${item.reload ? 'checked' : ''} disabled> Reload
        </label>
      </div>`;
    }
  }

  displayHtml += '<h4>One-Time Events:</h4>';
  for (let date in cleanedSchedule.onetime) {
    displayHtml += `<strong>${new Date(date).toDateString()}:</strong><br>`;
    for (const item of cleanedSchedule.onetime[date]) {
      const faviconUrl = await getFavicon(item.id).catch(() => 'default_favicon.png');
      displayHtml += `<div class="event-item">
        <img src="${faviconUrl}" class="favicon" alt="Favicon">
        <span class="tab-title">${item.title}</span>
        <label class="reload-label">
          <input type="checkbox" ${item.reload ? 'checked' : ''} disabled> Reload
        </label>
      </div>`;
    }
  }

  document.getElementById('currentSchedule').innerHTML = displayHtml;
}

async function addScheduleItem() {
  const scheduleType = document.getElementById('scheduleType').value;
  const tabId = document.getElementById('tabSelect').value;
  const tab = await chrome.tabs.get(parseInt(tabId));
  const title = tab.title;
  const reload = document.getElementById('reload').checked;

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
  document.getElementById('reload').checked = false;
}