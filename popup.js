import { fetchSchedule, saveSchedule, generateUniqueId, debounce } from './shared.js';
import ScheduleForm from './components/ScheduleForm.js';
import ScheduleTable from './components/ScheduleTable.js';
import ConflictResolver from './components/ConflictResolver.js';

class PopupManager {
    constructor() {
        this.scheduleForm = new ScheduleForm(document.getElementById('scheduleForm'));
        this.scheduleTable = new ScheduleTable(document.getElementById('scheduleTable'));
        this.conflictResolver = new ConflictResolver();

        this.autoRefreshForm = document.getElementById('autoRefreshForm');
        this.autoRefreshTabs = document.getElementById('autoRefreshTabs');
        this.refreshTable = document.getElementById('refreshTable');
        this.autoRefresh = [];

        this.init();
    }

    async init() {
        try {
            const scheduleData = await fetchSchedule();
            this.scheduleTable.render(scheduleData.schedule || []);
            this.autoRefresh = scheduleData.autoRefresh || [];
            this.populateTabOptions();
            this.renderRefreshTable();

            this.setupEventListeners();
            this.setupMessageListener();
            await this.checkForMissingTabs(scheduleData.schedule || []);
        } catch (error) {
            console.error('Error initializing PopupManager:', error);
        }
    }

    setupEventListeners() {
        this.scheduleForm.onSubmit(this.handleFormSubmit.bind(this));
        this.scheduleTable.onEdit(this.handleEditItem.bind(this));
        this.scheduleTable.onDelete(this.handleDeleteItem.bind(this));
        
        document.getElementById('addRefreshBtn').addEventListener('click', this.handleAddRefresh.bind(this));
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'scheduleUpdated') {
                this.scheduleTable.render(message.schedule);
                this.autoRefresh = message.autoRefresh || [];
                this.renderRefreshTable();
            }
        });
    }

    async checkForMissingTabs(schedule) {
        const tabs = await chrome.tabs.query({});
        const missingTabs = schedule.filter(item => !tabs.some(tab => tab.url === item.url));
        if (missingTabs.length > 0) {
            this.conflictResolver.showMissingTabsDialog(missingTabs);
        }
    }

    async handleFormSubmit(newItem) {
        newItem.id = generateUniqueId();
        const schedule = await fetchSchedule();
        schedule.push(newItem);
        await this.saveAndSync(schedule, this.autoRefresh);
    }

    async handleEditItem(itemId) {
        // Same handleEditItem method as you provided earlier
        // This section remains unchanged for now.
    }

    async handleDeleteItem(itemId) {
        const schedule = await fetchSchedule();
        const newSchedule = schedule.filter(item => item.id !== itemId);
        await this.saveAndSync(newSchedule, this.autoRefresh);
    }

    async handleAddRefresh() {
        const selectedTabValue = this.autoRefreshTabs.value;
        const refreshInterval = document.getElementById('refreshInterval').value;

        if (!selectedTabValue || !refreshInterval) return;

        let selectedTab;
        try {
            selectedTab = JSON.parse(selectedTabValue);
        } catch (error) {
            console.error('Error parsing selected tab:', error);
            return;
        }

        const newRefreshItem = {
            id: selectedTab.id,
            tabName: selectedTab.title,
            url: selectedTab.url,
            interval: Number(refreshInterval),
        };

        const index = this.autoRefresh.findIndex(item => item.id === selectedTab.id);
        if (index !== -1) {
            this.autoRefresh.splice(index, 1);
            this.refreshTable.deleteRow(index);
        }

        this.autoRefresh.push(newRefreshItem);
        this.renderRefreshTable();

        await this.saveAndSync(this.scheduleTable.schedule, this.autoRefresh);
    }

    populateTabOptions() {
        chrome.tabs.query({}, (tabs) => {
            tabs.forEach(tab => {
                const option = document.createElement('option');
                option.value = JSON.stringify({
                    id: tab.id,
                    title: tab.title,
                    url: tab.url,
                });
                option.textContent = tab.title;
                this.autoRefreshTabs.appendChild(option);
            });
        });
    }

    renderRefreshTable() {
        this.refreshTable.innerHTML = ''; // Clear the table

        this.autoRefresh.forEach(item => {
            const row = document.createElement('tr');

            const tabNameCell = document.createElement('td');
            tabNameCell.textContent = item.tabName;
            row.appendChild(tabNameCell);

            const urlCell = document.createElement('td');
            urlCell.textContent = item.url;
            row.appendChild(urlCell);

            const intervalCell = document.createElement('td');
            intervalCell.textContent = item.interval;
            row.appendChild(intervalCell);

            const actionsCell = document.createElement('td');
            const deleteButton = document.createElement('button');
            deleteButton.textContent = 'Delete';
            deleteButton.addEventListener('click', async () => {
                this.autoRefresh = this.autoRefresh.filter(refreshItem => refreshItem.id !== item.id);
                this.renderRefreshTable();
                await this.saveAndSync(this.scheduleTable.schedule, this.autoRefresh);
            });
            actionsCell.appendChild(deleteButton);
            row.appendChild(actionsCell);

            this.refreshTable.appendChild(row);
        });
    }

    saveAndSync = debounce(async (schedule, autoRefresh) => {
        try {
            await saveSchedule({ schedule, autoRefresh });
            this.scheduleTable.render(schedule);
            chrome.runtime.sendMessage({ type: 'scheduleUpdated', schedule, autoRefresh });
        } catch (error) {
            console.error('saveAndSync Stage:', error);
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
