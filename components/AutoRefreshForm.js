export default class AutoRefreshForm {
    constructor(container) {
        this.container = container;
        this.render();
    }

    render() {
        this.container.innerHTML = `
            <form id="autoRefreshForm">
                <label for="autoRefreshTabs">Select Tab:</label>
                <select id="autoRefreshTabs"></select>
                
                <label for="refreshInterval">Refresh Interval (seconds):</label>
                <input type="number" id="refreshInterval" name="refreshInterval" min="1" required>
                
                <button type="submit">Add/Update Refresh Timer</button>
            </form>
        `;
        this.populateTabSelect();
    }

    async populateTabSelect() {
        const tabSelect = this.container.querySelector('#autoRefreshTabs');
        tabSelect.innerHTML = ''; // Clear existing options if any

        const tabs = await chrome.tabs.query({});
        tabs.forEach(tab => {
            const option = document.createElement('option');
            option.value = JSON.stringify({ id: tab.id, title: tab.title, url: tab.url });
            option.textContent = tab.title;
            tabSelect.appendChild(option);
        });
    }

    onSubmit(callback) {
        this.container.querySelector('#autoRefreshForm').addEventListener('submit', async (e) => {
            e.preventDefault();
    
            const formData = new FormData(e.target);
            const tabSelectElement = this.container.querySelector('#autoRefreshTabs');
            const selectedTabValue = tabSelectElement.value;    

            if (!selectedTabValue) {
                console.error('No tab selected');
                return;
            }

            let selectedTab;
            try {
                selectedTab = JSON.parse(selectedTabValue);
            } catch (error) {
                console.error('Error parsing selected tab:', error);
                return;
            }

            if (!selectedTab || !selectedTab.id) {
                console.error('Invalid tab selection:', selectedTab);
                return;
            }

            const newRefreshItem = {
                id: selectedTab.id,
                tabName: selectedTab.title,
                url: selectedTab.url,
                interval: Number(formData.get('refreshInterval')),
            };

            await callback(newRefreshItem);
            
            e.target.reset();
        });
    }
}
