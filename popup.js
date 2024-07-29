document.getElementById('addSchedule').addEventListener('click', async function() {
  const day = document.getElementById('day').value;
  const time = document.getElementById('time').value;
  const tabName = document.getElementById('tabName').value;

  const result = await chrome.storage.sync.get(['schedule']);
  let schedule = result.schedule || {};
  if (!schedule[day]) schedule[day] = {};
  schedule[day][time] = tabName;

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
      displayHtml += `${time} - ${schedule[day][time]}<br>`;
    }
  }
  document.getElementById('currentSchedule').innerHTML = displayHtml;
}

updateScheduleDisplay();