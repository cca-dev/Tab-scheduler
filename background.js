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
        const tabs = await chrome.tabs.query({});
    
        for (const item of this.schedule) {
            if (item && item.date && item.time) {
                const scheduleTime = new Date(item.date + 'T' + item.time);
    
                if (this.shouldSwitchTab(now, scheduleTime, item.recurring)) {
                    // Check if the URL is present among the current tabs
                    let tab = tabs.find(t => t.url === item.url);
    
                    // If the tab is not found, create it
                    if (!tab) {
                        tab = await chrome.tabs.create({ url: item.url });
                    }
    
                    // Switch to the tab
                    await this.switchTab(tab, item.reload);
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

    async switchTab(tab, reload) {
        try {
            // Activate the tab
            await chrome.tabs.update(tab.id, { active: true });

            // Reload the tab if needed
            if (reload) {
                await chrome.tabs.reload(tab.id);
            }
        } catch (error) {
            console.error('Error switching tab:', error);
        }
    }
}

new BackgroundManager();
