export default class AutoRefreshTable {
    constructor(container) {
        this.container = container;
    }

    render(autoRefreshList) {
        if (!Array.isArray(autoRefreshList)) {
            console.error('Invalid auto-refresh data:', autoRefreshList);
            autoRefreshList = [];
        }

        this.container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Tab Name</th>
                        <th>URL</th>
                        <th>Interval (s)</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${autoRefreshList.map(this.renderRow).join('')}
                </tbody>
            </table>
        `;

        this.setupEventListeners();
    }

    renderRow(item) {
        return `
            <tr data-id="${item.id}">
                <td>${item.tabName || 'Unknown'}</td>
                <td>${item.url || 'N/A'}</td>
                <td>${item.interval}</td>
                <td>
                    <button class="delete">Delete</button>
                </td>
            </tr>
        `;
    }

    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete')) {
                const row = e.target.closest('tr');
                this.deleteItem(row.dataset.id);
            }
        });
    }

    deleteItem(id) {
        // Implement delete functionality
        if (this.onDeleteCallback) {
            this.onDeleteCallback(id);
        }
    }

    onDelete(callback) {
        this.onDeleteCallback = callback;
    }
}
