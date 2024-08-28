import { fetchSchedule, saveSchedule } from '../shared.js';

export default class ConflictResolver {
    
    showMissingTabsDialog(missingTabs) {
        const dialog = document.createElement('div');
        dialog.className = 'dialog';
        dialog.innerHTML = `
            <h2>Missing Tabs</h2>
            <p>The following scheduled tabs are not currently open:</p>
            <ul>
                ${missingTabs.map(tab => `<li>${tab.tabName}</li>`).join('')}
            </ul>
            <button id="openTabs">Open Missing Tabs</button>
            <button id="removeTabs">Remove from Schedule</button>
            <button id="ignore">Ignore</button>
        `;

        document.body.appendChild(dialog);

        dialog.querySelector('#openTabs').addEventListener('click', () => this.openMissingTabs(missingTabs));
        dialog.querySelector('#removeTabs').addEventListener('click', () => this.removeMissingTabs(missingTabs));
        dialog.querySelector('#ignore').addEventListener('click', () => dialog.remove());
    }

    async openMissingTabs(missingTabs) {
        for (const tab of missingTabs) {
            if (tab.url) {
                await chrome.tabs.create({ url: tab.url });
            } else {
                console.error('No URL found for missing tab:', tab);
            }
        }
        document.querySelector('.dialog').remove();
    }

    async removeMissingTabs(missingTabs) {
        // Remove the missing tabs from the schedule
        const schedule = await fetchSchedule();
        const newSchedule = schedule.filter(item => !missingTabs.some(missingTab => missingTab.url === item.url));
        await saveSchedule(newSchedule);
        chrome.runtime.sendMessage({ type: 'scheduleUpdated', schedule: newSchedule });
        document.querySelector('.dialog').remove();
    }

    
}
