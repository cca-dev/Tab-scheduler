export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

export async function fetchSchedule() {
    try {
        const response = await fetch(SHARED_FILE_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data || { schedule: [], autoRefresh: [] }; // Modified to return both schedules and auto-refresh
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return { schedule: [], autoRefresh: [] };
    }
}

export async function saveSchedule(data) {
    try {
        const response = await fetch(SHARED_FILE_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(data),
        });
        if (!response.ok) {
            throw new Error(`Failed to save schedule: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error('Error saving schedule:', error);
        throw error;
    }
}

export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

export function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}
