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
        console.log('handleFormSubmit Stage:', schedule);
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
            console.error('saveAndSync Stage:', error);
            // Implement error handling (e.g., show an error message to the user)
        }
    }, 1000);
}

document.addEventListener('DOMContentLoaded', () => {
    new PopupManager();
});

import { fetchSchedule, saveSchedule, generateUniqueId } from './shared.js';

document.addEventListener('DOMContentLoaded', async () => {
    // Load current schedule and auto-refresh settings
    const data = await fetchSchedule();
    const { autoRefresh } = data;
    
    // Populate tab options
    const tabs = await chrome.tabs.query({});
    const autoRefreshTabs = document.getElementById('autoRefreshTabs');
    tabs.forEach(tab => {
        const option = document.createElement('option');
        option.value = JSON.stringify({
            id: tab.id,
            title: tab.title,
            url: tab.url,
            favIconUrl: tab.favIconUrl
        });
        option.textContent = tab.title;
        autoRefreshTabs.appendChild(option);
    });

    // Display existing auto-refresh settings
    const refreshTable = document.getElementById('refreshTable').querySelector('tbody');
    autoRefresh.forEach(refreshItem => addRefreshRow(refreshItem, refreshTable));

    // Handle adding/updating auto-refresh
    document.getElementById('autoRefreshForm').addEventListener('submit', async (e) => {
        e.preventDefault();

        const selectedTabValue = document.getElementById('autoRefreshTabs').value;
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
            favicon: selectedTab.favIconUrl || 'default_favicon.png',
            interval: Number(refreshInterval)
        };

        // Remove existing entry if exists
        const index = autoRefresh.findIndex(item => item.id === selectedTab.id);
        if (index !== -1) {
            autoRefresh.splice(index, 1);
            refreshTable.deleteRow(index);
        }

        // Add new item
        autoRefresh.push(newRefreshItem);
        addRefreshRow(newRefreshItem, refreshTable);

        // Save to shared JSON
        await saveSchedule({ ...data, autoRefresh });
    });

    // Function to add a row to the refresh table
    function addRefreshRow(item, table) {
        const row = table.insertRow();
        row.insertCell(0).textContent = item.tabName;
        row.insertCell(1).textContent = item.url;
        row.insertCell(2).textContent = item.interval;

        const actionsCell = row.insertCell(3);
        const deleteButton = document.createElement('button');
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async () => {
            const index = autoRefresh.findIndex(refreshItem => refreshItem.id === item.id);
            if (index !== -1) {
                autoRefresh.splice(index, 1);
                table.deleteRow(index);
                await saveSchedule({ ...data, autoRefresh });
            }
        });
        actionsCell.appendChild(deleteButton);
    }
});
