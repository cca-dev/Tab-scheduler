document.addEventListener('DOMContentLoaded', async function() {
  await populateTabDropdown();
  updateScheduleDisplay();
});

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

document.getElementById('addSchedule').addEventListener('click', async function() {
  const day = document.getElementById('day').value;
  const time = document.getElementById('time').value;
  const tabSelect = document.getElementById('tabSelect');
  const selectedTabId = tabSelect.value;
  const selectedTabTitle = tabSelect.options[tabSelect.selectedIndex].text;

  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || {};
  if (!schedule[day]) schedule[day] = {};
  schedule[day][time] = { id: selectedTabId, title: selectedTabTitle };

  await chrome.storage.sync.set({schedule: schedule});
  updateScheduleDisplay();
});

async function updateScheduleDisplay() {
  const result = await chrome.storage.sync.get(['schedule']);
  const schedule = result.schedule || {};
  let displayHtml = '<h3>Current Schedule:</h3>';
  for (let day in schedule) {
    displayHtml += `<h4>${day.charAt(0).toUpperCase() + day.slice(1)}</h4>`;
    for (let time in schedule[day]) {
      displayHtml += `${time} - ${schedule[day][time].title}<br>`;
    }
  }
  document.getElementById('currentSchedule').innerHTML = displayHtml;
}

// background.js (only the switchToTab function needs to be updated)
async function switchToTab(tabInfo) {
  if (tabInfo.id) {
    const tab = await chrome.tabs.get(parseInt(tabInfo.id)).catch(() => null);
    if (tab) {
      await chrome.tabs.update(tab.id, {active: true});
    } else {
      // If the tab with the saved ID is not found, fall back to searching by title
      const tabs = await chrome.tabs.query({});
      const matchingTab = tabs.find(t => t.title.includes(tabInfo.title));
      if (matchingTab) {
        await chrome.tabs.update(matchingTab.id, {active: true});
      }
    }
  }
}