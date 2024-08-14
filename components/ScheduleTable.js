export default class ScheduleTable {
    constructor(container) {
        this.container = container;
    }

    render(schedule) {
        this.container.innerHTML = `
            <table>
                <thead>
                    <tr>
                        <th>Favicon</th>
                        <th>Tab Name</th>
                        <th>Date</th>
                        <th>Time</th>
                        <th>Type</th>
                        <th>Reload</th>
                        <th>Actions</th>
                    </tr>
                </thead>
                <tbody>
                    ${schedule.map(this.renderRow).join('')}
                </tbody>
            </table>
        `;

        this.setupEventListeners();
    }

    renderRow(item) {
        return `
            <tr data-id="${item.id}">
                <td><img src="${item.favicon}" alt="Favicon" width="16" height="16"></td>
                <td>${item.tabName}</td>
                <td>${item.date}</td>
                <td>${item.time}</td>
                <td>${item.recurring ? 'Recurring' : 'One-off'}</td>
                <td><input type="checkbox" ${item.reload ? 'checked' : ''} disabled></td>
                <td>
                    <button class="edit">Edit</button>
                    <button class="delete">Delete</button>
                </td>
            </tr>
        `;
    }

    setupEventListeners() {
        this.container.addEventListener('click', (e) => {
            if (e.target.classList.contains('edit')) {
                const row = e.target.closest('tr');
                this.editItem(row.dataset.id);
            } else if (e.target.classList.contains('delete')) {
                const row = e.target.closest('tr');
                this.deleteItem(row.dataset.id);
            }
        });
    }

    editItem(id) {
        // Implement edit functionality
        if (this.onEditCallback) {
            this.onEditCallback(id);
        }
    }

    deleteItem(id) {
        // Implement delete functionality
        if (this.onDeleteCallback) {
            this.onDeleteCallback(id);
        }
    }

    onEdit(callback) {
        this.onEditCallback = callback;
    }

    onDelete(callback) {
        this.onDeleteCallback = callback;
    }
}