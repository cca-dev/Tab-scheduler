import { fetchSchedule, saveSchedule } from './shared.js';

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
            const fetchedSchedule = await fetchSchedule();
            this.schedule = Array.isArray(fetchedSchedule) ? fetchedSchedule : [];
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.schedule = [];
        }
    }

    setupAlarms() {
        chrome.alarms.create('checkSchedule', { periodInMinutes: 1 });
    }

    setupListeners() {
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));
    }

    async handleAlarm(alarm) {
        if (alarm.name === 'checkSchedule') {
            await this.checkSchedule();
        }
    }

    async handleMessage(message, sender, sendResponse) {
        if (message.type === 'scheduleUpdated') {
            await this.loadSchedule();
            sendResponse({ success: true });
        }
    }

    async checkSchedule() {
        if (!Array.isArray(this.schedule)) {
            console.error('Schedule is not an array:', this.schedule);
            return;
        }

        const now = new Date();
        for (const item of this.schedule) {
            if (item && item.date && item.time) {
                const scheduleTime = new Date(item.date + 'T' + item.time);
                if (this.shouldSwitchTab(now, scheduleTime, item.recurring)) {
                    await this.switchTab(item);
                }
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
            let tab = tabs.find(tab => tab.id === item.tabId);
    
            // If the tab is not found, look for a tab with the same URL
            if (!tab) {
                tab = tabs.find(t => t.url === item.url);
            }
    
            // If still no tab, open a new one with the same URL
            if (!tab) {
                tab = await chrome.tabs.create({ url: item.url });
            }
    
            // Now activate the tab and reload if required
            if (tab) {
                await chrome.tabs.update(tab.id, { active: true });
                if (item.reload) {
                    await chrome.tabs.reload(tab.id);
                }
            } else {
                console.warn(`Tab not found and could not be reopened: ${item.tabId} - ${item.url}`);
            }
        } catch (error) {
            console.error('Error switching tab:', error);
        }
    }
    
}

new BackgroundManager();