document.addEventListener('DOMContentLoaded', async function() {
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
  const reload = document.getElementById('reloadCheckbox').checked;

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
  chrome.runtime.sendMessage({action: 'updateSchedule', schedule: updatedSchedule});
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
  const type = event.target.dataset.type;
  const index = parseInt(event.target.dataset.index);
  const day = event.target.dataset.day;
  const date = event.target.dataset.date;
  const reload = event.target.checked;

  const { schedule } = await chrome.storage.local.get('schedule');
  let updatedSchedule = schedule;

  if (type === 'recurring') {
    updatedSchedule.recurring[day][index].reload = reload;
  } else if (type === 'onetime') {
    updatedSchedule.onetime[date][index].reload = reload;
  }

  await chrome.storage.local.set({schedule: updatedSchedule});
  chrome.runtime.sendMessage({action: 'updateSchedule', schedule: updatedSchedule});
}

async function deleteEvent(type, index, day, date) {
  const { schedule } = await chrome.storage.local.get('schedule');
  let updatedSchedule = schedule || { recurring: {}, onetime: {} };

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

  await chrome.storage.local.set({schedule: updatedSchedule});
  
  // Trigger a network sync
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({action: 'updateSchedule', schedule: updatedSchedule}, async (response) => {
      if (chrome.runtime.lastError) {
        console.error('Error syncing schedule:', chrome.runtime.lastError);
      } else if (response && response.status === 'success') {
        console.log('Schedule successfully synced after deletion');
      }
      await updateScheduleDisplay();
      resolve();
    });
  });
}