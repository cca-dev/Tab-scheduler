export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

export async function fetchSchedule() {
    try {
        const response = await fetch(SHARED_FILE_URL);
        if (!response.ok) {
            throw new Error('Failed to fetch schedule');
        }
        const data = await response.json();
        return Array.isArray(data) ? data : [];
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return [];
    }
}

export async function saveSchedule(schedule) {
    try {
        const response = await fetch(SHARED_FILE_URL, {
            method: 'PUT',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(schedule),
        });
        if (!response.ok) {
            throw new Error('Failed to save schedule');
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