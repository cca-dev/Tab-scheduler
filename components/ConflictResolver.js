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
            await chrome.tabs.create({ url: tab.url });
        }
        document.querySelector('.dialog').remove();
    }

    async removeMissingTabs(missingTabs) {
        // Implement logic to remove missing tabs from the schedule
        document.querySelector('.dialog').remove();
    }
}