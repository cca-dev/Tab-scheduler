@@ -3,6 +3,8 @@ import { fetchSchedule, saveSchedule } from './shared.js';
class BackgroundManager {
    constructor() {
        this.schedule = [];
        this.init();
    }

	@@ -15,12 +17,16 @@ class BackgroundManager {

    async loadSchedule() {
        try {
            const fetchedSchedule = await fetchSchedule();
            this.schedule = Array.isArray(fetchedSchedule) ? fetchedSchedule : [];
            console.log("Schedule Loaded:", this.schedule);
        } catch (error) {
            console.error('Error loading schedule:', error);
            this.schedule = [];
        }
    }

	@@ -37,11 +43,10 @@ class BackgroundManager {
        chrome.alarms.onAlarm.addListener(this.handleAlarm.bind(this));
        chrome.runtime.onMessage.addListener(this.handleMessage.bind(this));

        // Polling mechanism to check for updates in the shared JSON file
        setInterval(async () => {
            console.log("Polling for schedule updates...");
            await this.loadSchedule();
        }, 2000); // Check every 2 seconds
    }

    async handleAlarm(alarm) {
	@@ -56,8 +61,6 @@ class BackgroundManager {
            console.log("Schedule update received via message");
            await this.loadSchedule();
            sendResponse({ success: true });
        } else {
            sendResponse({ success: false, message: "Unknown message type" });
        }
    }

	@@ -67,37 +70,32 @@ class BackgroundManager {
            console.error('Schedule is not an array:', this.schedule);
            return;
        }
    
        const now = new Date();
        const tabs = await chrome.tabs.query({});
        console.log("Current tabs:", tabs);
    
        for (const item of this.schedule) {
            if (item && item.date && item.time) {
                const scheduleTime = new Date(`${item.date}T${item.time}`);
                console.log(`Checking item scheduled for ${scheduleTime}`);
    
                if (this.shouldSwitchTab(now, scheduleTime, item.recurring)) {
                    let tab = tabs.find(t => t.url === item.url);
    
                    if (!tab) {
                        console.log(`Tab not found for URL ${item.url}, creating new tab`);
                        try {
                            tab = await chrome.tabs.create({ url: item.url });
                        } catch (error) {
                            console.error(`Failed to create tab for URL ${item.url}:`, error);
                            continue; // Skip this item if tab creation fails
                        }
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
	@@ -122,6 +120,42 @@ class BackgroundManager {
            console.error('Error switching tab:', error);
        }
    }
}

new BackgroundManager();