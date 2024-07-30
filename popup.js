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

  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || {};
  if (!schedule.recurring) schedule.recurring = {};
  if (!schedule.onetime) schedule.onetime = {};

  const scheduleItem = {
    id: selectedTabId,
    title: selectedTabTitle,
    time: time
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
    schedule.recurring[day].forEach(item => {
      displayHtml += `${item.time} - ${item.title}<br>`;
    });
  }

  displayHtml += '<h4>One-time Events:</h4>';
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const sortedDates = Object.keys(schedule.onetime).sort();

  for (let date of sortedDates) {
    if (new Date(date) >= today) {
      displayHtml += `<strong>${date}:</strong><br>`;
      schedule.onetime[date].forEach(item => {
        displayHtml += `${item.time} - ${item.title}<br>`;
      });
    }
  }

  document.getElementById('currentSchedule').innerHTML = displayHtml;
}