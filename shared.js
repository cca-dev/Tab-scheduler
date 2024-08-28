// URL to the shared JSON file
export const SHARED_FILE_URL = 'https://ccc.local:44300/tab_schedule.json';

// Fetch the schedule and auto-refresh data from the shared JSON file
export async function fetchSchedule() {
    try {
        const response = await fetch(SHARED_FILE_URL);
        if (!response.ok) {
            throw new Error(`Failed to fetch schedule: ${response.status} ${response.statusText}`);
        }
        const data = await response.json();
        return data || { schedule: [], autoRefresh: [] };
    } catch (error) {
        console.error('Error fetching schedule:', error);
        return { schedule: [], autoRefresh: [] };
    }
}

// Save the updated schedule and auto-refresh data to the shared JSON file
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

// Generate a unique identifier, useful for creating new schedule or auto-refresh items
export function generateUniqueId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
}

// Debounce function to prevent excessive function calls
export function debounce(func, delay) {
    let timeoutId;
    return (...args) => {
        clearTimeout(timeoutId);
        timeoutId = setTimeout(() => func(...args), delay);
    };
}

// Throttle function to ensure a function is called at most once in a specified period
export function throttle(func, limit) {
    let lastFunc;
    let lastRan;
    return function(...args) {
        const context = this;
        if (!lastRan) {
            func.apply(context, args);
            lastRan = Date.now();
        } else {
            clearTimeout(lastFunc);
            lastFunc = setTimeout(() => {
                if (Date.now() - lastRan >= limit) {
                    func.apply(context, args);
                    lastRan = Date.now();
                }
            }, limit - (Date.now() - lastRan));
        }
    };
}

// Send a message to the background script or other parts of the extension
export function sendMessage(message) {
    return new Promise((resolve, reject) => {
        chrome.runtime.sendMessage(message, (response) => {
            if (chrome.runtime.lastError) {
                reject(chrome.runtime.lastError);
            } else {
                resolve(response);
            }
        });
    });
}

// Listen for incoming messages and handle them
export function listenForMessages(handler) {
    chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
        handler(message, sender, sendResponse);
        return true; // Keeps the message channel open for async responses
    });
}
