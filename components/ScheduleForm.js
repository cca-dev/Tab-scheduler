export default class ScheduleForm {
    constructor(container) {
        this.container = container;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <form id="scheduleForm">
                <input type="date" id="date" required>
                <input type="time" id="time" required>
                <select id="tabSelect" required></select>
                <label>
                    <input type="checkbox" id="reload">
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
        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ id: tab.id, title: tab.title, url: tab.url });
            option.textContent = tab.title;
            tabSelect.appendChild(option);
        });
    }
    
    onSubmit(callback) {
        this.container.querySelector('#scheduleForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            const formData = new FormData(e.target);
            const selectedTab = JSON.parse(formData.get('tabSelect'));
    
            const newItem = {
                id: generateUniqueId(), // Use the shared function for generating unique IDs
                date: formData.get('date'),
                time: formData.get('time'),
                tabId: selectedTab.id,
                tabName: selectedTab.title,
                url: selectedTab.url,
                reload: formData.get('reload') === 'on',
                recurring: formData.get('recurringType') === 'recurring'
            };
            await callback(newItem);
            e.target.reset();
        });
    }    
}