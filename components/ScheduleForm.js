import {generateUniqueId} from '../shared.js';

export default class ScheduleForm {
    constructor(container) {
        this.container = container;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <form id="scheduleForm">
            <input type="date" id="date" name="date" required>
            <input type="time" id="time" name="time" required>
                <select id="tabSelect" required></select>
                <label>
                    <input type="checkbox" name="reload" id="reload">
                    Reload
                </label>
                <label>
                    <input type="radio" name="recurringType" value="oneOff" checked>
                    One-off
                </label>
                <label>
                    <input type="radio" name="recurringType" value="recurring">
                    Recurring
                </label>
                <button type="submit">Add to Schedule</button>
            </form>
        `;

        this.populateTabSelect();
    }

    async populateTabSelect() {
        const tabSelect = this.container.querySelector('#tabSelect');
        tabSelect.innerHTML = ''; // Clear existing options if any
    
        const tabs = await chrome.tabs.query({});
        console.log('Tabs:', tabs); // Add this line for debugging
    
        tabs.forEach(tab => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ id: tab.id, title: tab.title, url: tab.url });
            option.textContent = tab.title;
            tabSelect.appendChild(option);
        });
    
        console.log('Tab Select InnerHTML:', tabSelect.innerHTML); // Add this line for debugging
    }
    
    

    onSubmit(callback) {
        this.container.querySelector('#scheduleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
    
            const formData = new FormData(e.target);
    
            const date = formData.get('date');
            const time = formData.get('time');
            const reload = formData.get('reload'); // This is a string, either 'on' or null

            console.log('Date:', date);
            console.log('Time:', time);
            console.log('Reload:', reload);
    
            if (!date || !time) {
                console.error('Date or time is missing');
                return;
            }    
            const newItem = {
                id: generateUniqueId(),
                date: date,
                time: time,
                tabId: selectedTab.id,
                tabName: selectedTab.title,
                url: selectedTab.url,
                favicon: selectedTab.favIconUrl || 'default_favicon.png',
                reload: reload === 'on', // Converts to boolean
                recurring: formData.get('recurringType') === 'recurring'
            };
    
            await callback(newItem);
            e.target.reset();
        });
    }     
}