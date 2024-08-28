import { fetchSchedule, saveSchedule } from './shared.js';

class BackgroundManager {
    constructor() {
        this.schedule = [];
        this.autoRefresh = [];
        this.refreshIntervals = {};
        this.init();
    }

    async init() {
        console.log("Initializing Background Manager");
        await this.loadSchedule();
        this.setupAlarms();
        this.setupListeners();
    }

    async loadSchedule() {
        try {
            const data = await fetchSchedule();
            this.schedule = Array.isArray(data.schedule) ? data.schedule : [];
            this.autoRefresh = Array.isArray(data.autoRefresh) ? data.autoRefresh : [];
            console.log("Schedule Loaded:", this.schedule);
            console.log("Auto Refresh Loaded:", this.autoRefresh);
            this.setupAutoRefresh();
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.schedule = [];
            this.autoRefresh = [];
        }
    }

    setupAlarms() {
        console.log("Setting up alarms");
        chrome.alarms.clearAll(() => {
            chrome.alarms.create('checkSchedule', { periodInMinutes: 1 });
            console.log("Alarm created for checkSchedule");
        });
    }

    setupListeners() {
        console.log("Setting up listeners");
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

        setInterval(async () => {
            console.log("Checking for schedule updates...");
            await this.loadSchedule();
        }, 5000); // Check every 5 seconds
    }

    async handleAlarm(alarm) {
        if (alarm.name === 'checkSchedule') {
            console.log("Alarm triggered: checkSchedule");
            await this.checkSchedule();
        }
    }

    async handleMessage(message, sender, sendResponse) {
        if (message.type === 'scheduleUpdated') {
            console.log("Schedule update received via message");
            await this.loadSchedule();
            sendResponse({ success: true });
        }
    }

    async checkSchedule() {
        console.log("Checking schedule...");
        if (!Array.isArray(this.schedule)) {
            console.error('Schedule is not an array:', this.schedule);
            return;
        }

        const now = new Date();
        const tabs = await chrome.tabs.query({});
        console.log("Current tabs:", tabs);

        for (const item of this.schedule) {
            if (item && item.date && item.time) {
                const scheduleTime = new Date(item.date + 'T' + item.time);
                console.log(`Checking item scheduled for ${scheduleTime}`);

                if (this.shouldSwitchTab(now, scheduleTime, item.recurring)) {
                    let tab = tabs.find(t => t.url === item.url);

                    if (!tab) {
                        console.log(`Tab not found for URL ${item.url}, creating new tab`);
                        tab = await chrome.tabs.create({ url: item.url });
                    } else {
                        console.log(`Found tab for URL ${item.url}`);
                    }

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
            console.log(`Switching to tab: ${tab.id}`);
            await chrome.tabs.update(tab.id, { active: true });

            if (reload) {
                console.log(`Reloading tab: ${tab.id}`);
                await chrome.tabs.reload(tab.id);
            }
        } catch (error) {
            console.error('Error switching tab:', error);
        }
    }

    setupAutoRefresh() {
        console.log("Setting up auto-refresh timers");

        for (const refreshItem of this.autoRefresh) {
            // Clear existing intervals
            if (this.refreshIntervals[refreshItem.id]) {
                clearInterval(this.refreshIntervals[refreshItem.id]);
            }

            // Find the tab
            chrome.tabs.query({ url: refreshItem.url }, (tabs) => {
                let tab = tabs[0];

                if (!tab) {
                    console.log(`Tab not found for URL ${refreshItem.url}, creating new tab`);
                    chrome.tabs.create({ url: refreshItem.url }, (newTab) => {
                        tab = newTab;
                        this.startAutoRefresh(tab.id, refreshItem.interval);
                    });
                } else {
                    this.startAutoRefresh(tab.id, refreshItem.interval);
                }
            });
        }
    }

    startAutoRefresh(tabId, interval) {
        console.log(`Setting auto-refresh for tab ${tabId} every ${interval} seconds`);

        // Start interval for refreshing tab
        this.refreshIntervals[tabId] = setInterval(() => {
            console.log(`Refreshing tab ${tabId}`);
            chrome.tabs.reload(tabId);
        }, interval * 1000);
    }
}

new BackgroundManager();
