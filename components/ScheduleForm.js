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
                    <input type="checkbox" id="reload" name="reload" >
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
            option.value = JSON.stringify({ id: tab.id, title: tab.title, url: tab.url, favicon: tab.favIconUrl });
            option.textContent = tab.title;
            tabSelect.appendChild(option);
        });
    
        console.log('Tab Select InnerHTML:', tabSelect.innerHTML); // Add this line for debugging
    }
    

   onSubmit(callback) {
        this.container.querySelector('#scheduleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
    
            const formData = new FormData(e.target);
            const tabSelectElement = this.container.querySelector('#tabSelect');
            const selectedTabValue = tabSelectElement.value;
    
            console.log('Selected Tab Value:', selectedTabValue); // Add this line for debugging
    
            if (!selectedTabValue) {
                console.error('No tab selected');
                return;
            }
            
            let selectedTab;
            try {
                selectedTab = JSON.parse(selectedTabValue);
                console.log('Parsed Selected Tab:', selectedTab); // Add this line for debugging
            } catch (error) {
                console.error('Error parsing selected tab:', error);
                return;
            }
    
            if (!selectedTab || !selectedTab.id) {
                console.error('Invalid tab selection:', selectedTab);
                return;
            }
    
            const newItem = {
                id: generateUniqueId(),
                date: formData.get('date'),
                time: formData.get('time'),
                tabId: selectedTab.id,
                tabName: selectedTab.title,
                url: selectedTab.url,
                favicon: selectedTab.favIconUrl || 'default_favicon.png',
                reload: formData.get('reload') === 'on',
                recurring: formData.get('recurringType') === 'recurring'
            };
    
            await callback(newItem);
            e.target.reset();
        });
    }   

}