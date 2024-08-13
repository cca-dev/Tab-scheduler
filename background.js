import { SHARED_FILE_URL } from './shared.js';

class BackgroundManager {
    constructor() {
        this.schedule = [];
        this.init();
    }

    async init() {
        await this.loadSchedule();
        this.setupAlarms();
        this.setupListeners();
    }

    async loadSchedule() {
        try {
            const response = await fetch(SHARED_FILE_URL);
            this.schedule = await response.json();
        } catch (error) {
            console.error('Error loading schedule:', error);
        }
    }

    setupAlarms() {
        chrome.alarms.create('checkSchedule', { periodInMinutes: 1 });
    }

    setupListeners() {
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
    }

    async handleAlarm(alarm) {
        if (alarm.name === 'checkSchedule') {
            await this.checkSchedule();
        }
    }

    async checkSchedule() {
        const now = new Date();
        for (const item of this.schedule) {
            const scheduleTime = new Date(item.date + 'T' + item.time);
            if (this.shouldSwitchTab(now, scheduleTime, item.recurring)) {
                await this.switchTab(item);
            }
        }
    }

    shouldSwitchTab(now, scheduleTime, recurring) {
        if (recurring) {
            return now.getDay() === scheduleTime.getDay() &&
                   now.getHours() === scheduleTime.getHours() &&
                   now.getMinutes() === scheduleTime.getMinutes();
        } else {
            return now.getTime() - scheduleTime.getTime() < 60000 && // Within the last minute
                   now.getTime() >= scheduleTime.getTime();
        }
    }

    async switchTab(item) {
        try {
            const tabs = await chrome.tabs.query({});
            const tab = tabs.find(tab => tab.id === item.tabId);
            if (tab) {
                await chrome.tabs.update(tab.id, { active: true });
                if (item.reload) {
                    await chrome.tabs.reload(tab.id);
                }
            } else {
                console.warn(`Tab not found: ${item.tabId}`);
            }
        } catch (error) {
            console.error('Error switching tab:', error);
        }
    }
}

new BackgroundManager();