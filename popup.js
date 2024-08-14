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
        const missingTabs = schedule.filter(item => !tabs.some(tab => tab.url === item.url));
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

    async handleEditItem(itemId) {
        const schedule = await fetchSchedule();
        const itemToEdit = schedule.find(item => item.id === itemId);
        
        if (itemToEdit) {
            // Populate the form with the item details for editing
            document.querySelector('#date').value = itemToEdit.date;
            document.querySelector('#time').value = itemToEdit.time;
    
            // Query the current tabs to find one that matches the item's URL
            const tabs = await chrome.tabs.query({});
            const matchingTab = tabs.find(tab => tab.url === itemToEdit.url);
            
            let tabSelect = document.querySelector('#tabSelect');
    
            // Check if the matching tab is already in the dropdown; if not, add it
            if (matchingTab) {
                const matchingOption = Array.from(tabSelect.options).find(option => JSON.parse(option.value).url === matchingTab.url);
                if (matchingOption) {
                    matchingOption.selected = true;
                } else {
                    const newOption = new Option(matchingTab.title, JSON.stringify({ url: matchingTab.url, title: matchingTab.title }));
                    tabSelect.add(newOption);
                    tabSelect.value = newOption.value;
                }
            } else {
                // If no matching tab is found (e.g., tab is closed), add a placeholder option
                const placeholderOption = new Option(itemToEdit.tabName, JSON.stringify({ url: itemToEdit.url, title: itemToEdit.tabName }));
                tabSelect.add(placeholderOption);
                tabSelect.value = placeholderOption.value;
            }
    
            document.querySelector('#reload').checked = itemToEdit.reload;
            document.querySelector(`input[name="recurringType"][value="${itemToEdit.recurring ? 'recurring' : 'oneOff'}"]`).checked = true;
    
            // Remove the old item from the schedule so that it can be replaced with the updated item
            const newSchedule = schedule.filter(item => item.id !== itemId);
            await saveSchedule(newSchedule);
            this.scheduleTable.render(newSchedule);
        }
    } 
    

    async handleDeleteItem(itemId) {
        const schedule = await fetchSchedule();
        const newSchedule = schedule.filter(item => item.id !== itemId);
        await this.saveAndSync(newSchedule);
    }

    saveAndSync = debounce(async (schedule) => {
        console.log('Saving Schedule:', schedule); // Debugging
        try {
            await saveSchedule(schedule);
            this.scheduleTable.render(schedule);
            chrome.runtime.sendMessage({ type: 'scheduleUpdated', schedule });
        } catch (error) {
            console.error('Error saving schedule:', error);
            // Implement error handling (e.g., show an error message to the user)
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});
