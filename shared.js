// URL to the shared JSON file
export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

// Fetch the schedule and auto-refresh data from the shared JSON file
export async function fetchSchedule() {
    try {
        const response = await fetch(SHARED_FILE_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return { schedule: [], autoRefresh: [] };
    }
}

// Save the updated schedule and auto-refresh data to the shared JSON file
export async function saveSchedule(data) {
    try {
        const response = await fetch(SHARED_FILE_URL, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`Failed to save schedule: ${response.status} ${response.statusText}`);
        }
        return await response.json();
    } catch (error) {
        console.error('Error saving schedule:', error);
    }
}

// Debounce function to limit the frequency of function execution
export function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Generate a unique ID for each schedule item or auto-refresh entry
export function generateUniqueId() {
    return '_' + Math.random().toString(36).substr(2, 9);
}
