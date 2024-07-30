document.addEventListener('DOMContentLoaded', async function() {
  await populateTabDropdown();
  await cleanupPastEvents();
  updateScheduleDisplay();
  setupEventListeners();
});

async function cleanupPastEvents() {
  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || { recurring: {}, onetime: {} };
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let date in schedule.onetime) {
    if (new Date(date) < today) {
      delete schedule.onetime[date];
    }
  }

  await chrome.storage.sync.set({schedule: schedule});
}

async function populateTabDropdown() {
  const tabs = await chrome.tabs.query({});
  const tabSelect = document.getElementById('tabSelect');
  tabSelect.innerHTML = '';
  tabs.forEach((tab, index) => {
    const option = document.createElement('option');
    option.value = tab.id;
    option.textContent = tab.title.length > 50 ? tab.title.substring(0, 47) + '...' : tab.title;
    option.dataset.url = tab.url; // Add this line
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

async function addScheduleItem() {
  const scheduleType = document.getElementById('scheduleType').value;
  const day = document.getElementById('day').value;
  const date = document.getElementById('dateInput').value;
  const time = document.getElementById('time').value;
  const tabSelect = document.getElementById('tabSelect');
  const selectedTabId = tabSelect.value;
  const selectedTabTitle = tabSelect.options[tabSelect.selectedIndex].text;
  const selectedTabUrl = tabSelect.options[tabSelect.selectedIndex].dataset.url;

  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || {};
  if (!schedule.recurring) schedule.recurring = {};
  if (!schedule.onetime) schedule.onetime = {};

  const scheduleItem = {
    id: selectedTabId,
    title: selectedTabTitle,
    time: time,
    url: selectedTabUrl,
    reload: false // Initialize reload as false
  };

  if (scheduleType === 'recurring') {
    if (!schedule.recurring[day]) schedule.recurring[day] = [];
    schedule.recurring[day].push(scheduleItem);
  } else {
    if (!schedule.onetime[date]) schedule.onetime[date] = [];
    schedule.onetime[date].push(scheduleItem);
  }

  await chrome.storage.sync.set({schedule: schedule});
  updateScheduleDisplay();
}

async function updateScheduleDisplay() {
  const result = await chrome.storage.sync.get(['schedule']);
  const schedule = result.schedule || { recurring: {}, onetime: {} };
  let displayHtml = '<h3>Current Schedule:</h3>';

  displayHtml += '<h4>Recurring Events:</h4>';
  for (let day in schedule.recurring) {
    displayHtml += `<strong>${day.charAt(0).toUpperCase() + day.slice(1)}:</strong><br>`;
    schedule.recurring[day].forEach((item, index) => {
      displayHtml += `<div class="event-item">
        <img src="chrome://favicon/${item.url}" class="favicon" alt="Favicon">
        <span class="tab-title">${item.title}</span>
        <label class="reload-label">
          <input type="checkbox" class="reload-checkbox" 
                 ${item.reload ? 'checked' : ''}
                 data-type="recurring" data-day="${day}" data-index="${index}">
          Reload
        </label>
        <span class="delete-btn" data-type="recurring" data-day="${day}" data-index="${index}">&times;</span>
      </div>`;
    });
  }

  displayHtml += '<h4>One-time Events:</h4>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sortedDates = Object.keys(schedule.onetime).sort();

  for (let date of sortedDates) {
    if (new Date(date) >= today) {
      displayHtml += `<strong>${date}:</strong><br>`;
      schedule.onetime[date].forEach((item, index) => {
        displayHtml += `<div class="event-item">
          <img src="chrome://favicon/${item.url}" class="favicon" alt="Favicon">
          <span class="tab-title">${item.title}</span>
          <label class="reload-label">
            <input type="checkbox" class="reload-checkbox" 
                   ${item.reload ? 'checked' : ''}
                   data-type="onetime" data-date="${date}" data-index="${index}">
            Reload
          </label>
          <span class="delete-btn" data-type="onetime" data-date="${date}" data-index="${index}">&times;</span>
        </div>`;
      });
    }
  }

  document.getElementById('currentSchedule').innerHTML = displayHtml;
  addDeleteEventListeners();
  addReloadCheckboxListeners();
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

  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule;

  if (type === 'recurring') {
    schedule.recurring[day][index].reload = reload;
  } else if (type === 'onetime') {
    schedule.onetime[date][index].reload = reload;
  }

  await chrome.storage.sync.set({schedule: schedule});
}

async function deleteEvent(type, index, day, date) {
  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || { recurring: {}, onetime: {} };

  if (type === 'recurring') {
    schedule.recurring[day].splice(index, 1);
    if (schedule.recurring[day].length === 0) {
      delete schedule.recurring[day];
    }
  } else if (type === 'onetime') {
    schedule.onetime[date].splice(index, 1);
    if (schedule.onetime[date].length === 0) {
      delete schedule.onetime[date];
    }
  }

  await chrome.storage.sync.set({schedule: schedule});
  updateScheduleDisplay();
}