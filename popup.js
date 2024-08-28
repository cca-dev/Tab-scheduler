import { fetchSchedule, saveSchedule, debounce } from './shared.js';
import ScheduleForm from './components/ScheduleForm.js';
import ScheduleTable from './components/ScheduleTable.js';
import ConflictResolver from './components/ConflictResolver.js';
import AutoRefreshForm from './components/AutoRefreshForm.js';
import AutoRefreshTable from './components/AutoRefreshTable.js';

class PopupManager {
    constructor() {
        this.scheduleForm = new ScheduleForm(document.getElementById('scheduleForm'));
        this.scheduleTable = new ScheduleTable(document.getElementById('scheduleTable'));
        this.conflictResolver = new ConflictResolver();

        this.autoRefreshForm = new AutoRefreshForm(document.getElementById('autoRefreshForm'));
        this.autoRefreshTable = new AutoRefreshTable(document.getElementById('refreshTable'));

        this.schedule = [];
        this.autoRefresh = [];

        this.init();
    }

    async init() {
        try {
            const data = await fetchSchedule();
            this.schedule = data.schedule || [];
            this.autoRefresh = data.autoRefresh || [];

            this.scheduleTable.render(this.schedule);
            this.autoRefreshTable.render(this.autoRefresh);

            this.scheduleForm.onSubmit(this.handleScheduleFormSubmit.bind(this));
            this.scheduleTable.onEdit(this.handleEditScheduleItem.bind(this));
            this.scheduleTable.onDelete(this.handleDeleteScheduleItem.bind(this));

            this.autoRefreshForm.onSubmit(this.handleAutoRefreshFormSubmit.bind(this));
            this.autoRefreshTable.onDelete(this.handleDeleteAutoRefreshItem.bind(this));

            this.setupMessageListener();
            await this.checkForMissingTabs(this.schedule);
        } catch (error) {
            console.error('Error initializing PopupManager:', error);
        }
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'scheduleUpdated') {
                this.scheduleTable.render(message.schedule);
                this.autoRefreshTable.render(message.autoRefresh || []);
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

    async handleScheduleFormSubmit(newItem) {
        newItem.id = generateUniqueId();
        this.schedule.push(newItem);
        await this.saveAndSync();
    }

    async handleEditScheduleItem(itemId) {
        // Handle editing schedule items
    }

    async handleDeleteScheduleItem(itemId) {
        this.schedule = this.schedule.filter(item => item.id !== itemId);
        await this.saveAndSync();
    }

    async handleAutoRefreshFormSubmit(newRefreshItem) {
        const index = this.autoRefresh.findIndex(item => item.id === newRefreshItem.id);
        if (index !== -1) {
            this.autoRefresh.splice(index, 1);
        }
        this.autoRefresh.push(newRefreshItem);
        this.autoRefreshTable.render(this.autoRefresh);
        await this.saveAndSync();
    }

    async handleDeleteAutoRefreshItem(id) {
        this.autoRefresh = this.autoRefresh.filter(item => item.id !== id);
        this.autoRefreshTable.render(this.autoRefresh);
        await this.saveAndSync();
    }

    async saveAndSync() {
        await saveSchedule({ schedule: this.schedule, autoRefresh: this.autoRefresh });
        chrome.runtime.sendMessage({ type: 'scheduleUpdated', schedule: this.schedule, autoRefresh: this.autoRefresh });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
