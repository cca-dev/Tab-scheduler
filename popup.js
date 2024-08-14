import { fetchSchedule, saveSchedule, generateUniqueId, debounce } from './shared.js';
import ScheduleForm from './components/ScheduleForm.js';
import ScheduleTable from './components/ScheduleTable.js';
import ConflictResolver from './components/ConflictResolver.js';

class PopupManager {
    constructor() {
        this.scheduleForm = new ScheduleForm(document.getElementById('scheduleForm'));
        this.scheduleTable = new ScheduleTable(document.getElementById('scheduleTable'));
        this.conflictResolver = new ConflictResolver();
        this.init();
    }

    async init() {
        try {
            await this.loadSchedule();
            this.setupEventListeners();
            this.setupMessageListener();
        } catch (error) {
            console.error('Error initializing PopupManager:', error);
            // Optionally, display an error message to the user
        }
    }

    async loadSchedule() {
        try {
            const schedule = await fetchSchedule();
            this.scheduleTable.render(schedule);
            await this.checkForMissingTabs(schedule);
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.scheduleTable.render([]); // Render an empty table if there's an error
        }
    }

    setupEventListeners() {
        this.scheduleForm.onSubmit(this.handleFormSubmit.bind(this));
        this.scheduleTable.onEdit(this.handleEditItem.bind(this));
        this.scheduleTable.onDelete(this.handleDeleteItem.bind(this));
    }

    setupMessageListener() {
        chrome.runtime.onMessage.addListener((message) => {
            if (message.type === 'scheduleUpdated') {
                this.scheduleTable.render(message.schedule);
            }
        });
    }

    async checkForMissingTabs(schedule) {
        const tabs = await chrome.tabs.query({});
        const missingTabs = schedule.filter(item => !tabs.some(tab => tab.id === item.tabId));
        if (missingTabs.length > 0) {
            this.conflictResolver.showMissingTabsDialog(missingTabs);
        }
    }

    async handleFormSubmit(newItem) {
        newItem.id = generateUniqueId();
        const schedule = await fetchSchedule();
        schedule.push(newItem);
        await this.saveAndSync(schedule);
    }

    async handleEditItem(editedItem) {
        const schedule = await fetchSchedule();
        const index = schedule.findIndex(item => item.id === editedItem.id);
        if (index !== -1) {
            schedule[index] = editedItem;
            await this.saveAndSync(schedule);
        }
    }

    async handleDeleteItem(itemId) {
        const schedule = await fetchSchedule();
        const newSchedule = schedule.filter(item => item.id !== itemId);
        await this.saveAndSync(newSchedule);
    }

    saveAndSync = debounce(async (schedule) => {
        try {
            await saveSchedule(schedule);
            this.scheduleTable.render(schedule);
            chrome.runtime.sendMessage({ type: 'scheduleUpdated' });
        } catch (error) {
            console.error('Error saving schedule:', error);
            // Implement error handling (e.g., show an error message to the user)
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});