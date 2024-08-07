document.addEventListener('DOMContentLoaded', () => {
  // Initialize and load schedule data when the popup is opened
  loadSchedule();
  document.getElementById('updateSchedule').addEventListener('click', updateSchedule);
});

async function loadSchedule() {
  try {
    const { schedule } = await chrome.storage.local.get('schedule');
    if (schedule) {
      displaySchedule(schedule);
    } else {
      console.log('No schedule found in storage.');
      document.getElementById('scheduleContainer').innerText = 'No schedule available.';
    }
  } catch (error) {
    console.error('Error loading schedule:', error);
    document.getElementById('scheduleContainer').innerText = 'Error loading schedule.';
  }
}

function displaySchedule(schedule) {
  const container = document.getElementById('scheduleContainer');
  container.innerHTML = '';

  if (schedule.recurring && Object.keys(schedule.recurring).length) {
    const recurringTitle = document.createElement('h3');
    recurringTitle.textContent = 'Recurring Schedule';
    container.appendChild(recurringTitle);

    for (const day in schedule.recurring) {
      const dayTitle = document.createElement('h4');
      dayTitle.textContent = day.charAt(0).toUpperCase() + day.slice(1);
      container.appendChild(dayTitle);

      schedule.recurring[day].forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.textContent = `${item.time} - ${item.title} (ID: ${item.id})`;
        container.appendChild(itemElement);
      });
    }
  }

  if (schedule.onetime && Object.keys(schedule.onetime).length) {
    const onetimeTitle = document.createElement('h3');
    onetimeTitle.textContent = 'One-Time Schedule';
    container.appendChild(onetimeTitle);

    for (const date in schedule.onetime) {
      const dateTitle = document.createElement('h4');
      dateTitle.textContent = date;
      container.appendChild(dateTitle);

      schedule.onetime[date].forEach(item => {
        const itemElement = document.createElement('div');
        itemElement.textContent = `${item.time} - ${item.title} (ID: ${item.id})`;
        container.appendChild(itemElement);
      });
    }
  }
}

async function updateSchedule() {
  try {
    const schedule = parseScheduleFromInput();
    if (schedule) {
      chrome.runtime.sendMessage({ action: 'updateSchedule', schedule }, response => {
        if (response.status === 'success') {
          console.log('Schedule successfully updated.');
          alert('Schedule successfully updated.');
        } else {
          console.error('Failed to update schedule.');
          alert('Failed to update schedule.');
        }
      });
    } else {
      console.error('Invalid schedule data.');
      alert('Invalid schedule data.');
    }
  } catch (error) {
    console.error('Error updating schedule:', error);
    alert('Error updating schedule.');
  }
}

function parseScheduleFromInput() {
  const scheduleInput = document.getElementById('scheduleInput').value;
  try {
    return JSON.parse(scheduleInput);
  } catch (error) {
    console.error('Invalid JSON format:', error);
    return null;
  }
}
