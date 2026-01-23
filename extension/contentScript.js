// =============================================
// TEXA Extension - Content Script
// Bridges communication between web app and extension
// =============================================

const STORAGE_KEYS = {
    TEXA_ORIGIN: 'texa_origin',
    TEXA_TOKEN: 'texa_token',
    TEXA_USER: 'texa_user',
    LAST_SYNC: 'last_sync'
};

// Listen for messages from the web page (Dashboard)
window.addEventListener('message', async (event) => {
    // Security check: only accept messages from the same window
    if (event.source !== window) return;
    if (!event.data || !event.data.type) return;

    console.log('TEXA ContentScript received:', event.data.type);

    // Handle TEXA_EXTENSION_PING message (for extension detection)
    if (event.data.type === 'TEXA_EXTENSION_PING') {
        console.log('ContentScript: Responding to PING');
        window.postMessage({
            type: 'TEXA_EXTENSION_PONG',
            requestId: event.data.requestId,
            source: 'TEXA_EXTENSION'
        }, window.location.origin);
        return;
    }

    // Handle TEXA_OPEN_TOOL message
    if (event.data.type === 'TEXA_OPEN_TOOL') {
        console.log('ContentScript: Forwarding OPEN_TOOL to background');
        try {
            const response = await chrome.runtime.sendMessage(event.data);
            console.log('Background response:', response);

            // Send ACK back to the page
            window.postMessage({
                type: 'TEXA_OPEN_TOOL_ACK',
                requestId: event.data.requestId,
                ok: true
            }, window.location.origin);
        } catch (err) {
            console.error('Error sending to background:', err);
            window.postMessage({
                type: 'TEXA_OPEN_TOOL_ACK',
                requestId: event.data.requestId,
                ok: false,
                error: err.message
            }, window.location.origin);
        }
    }

    // Handle TEXA_LOGIN_SYNC message (from App.tsx after login)
    if (event.data.type === 'TEXA_LOGIN_SYNC') {
        console.log('ContentScript: Processing LOGIN_SYNC');

        const { idToken, user, origin } = event.data;

        if (idToken && user) {
            // Store complete user data including subscription info
            const storageData = {
                [STORAGE_KEYS.TEXA_ORIGIN]: origin || window.location.origin,
                [STORAGE_KEYS.TEXA_TOKEN]: idToken,
                [STORAGE_KEYS.TEXA_USER]: {
                    id: user.id || user.uid,
                    email: user.email,
                    name: user.name || user.displayName || 'Pengguna',
                    role: user.role || 'MEMBER',
                    subscriptionEnd: user.subscriptionEnd || null,
                    isActive: user.isActive !== undefined ? user.isActive : true,
                    photoURL: user.photoURL || null,
                    createdAt: user.createdAt || null,
                    lastLogin: user.lastLogin || new Date().toISOString()
                },
                [STORAGE_KEYS.LAST_SYNC]: Date.now()
            };

            chrome.storage.local.set(storageData, () => {
                console.log('TEXA Extension: Session synced successfully');
                console.log('User data stored:', storageData[STORAGE_KEYS.TEXA_USER]);

                // Notify background to show notification
                chrome.runtime.sendMessage({ type: 'TEXA_LOGIN_SUCCESS' });
            });
        }
    }

    // Handle TEXA_SYNC_SESSION message (legacy support)
    if (event.data.type === 'TEXA_SYNC_SESSION') {
        console.log('ContentScript: Processing SYNC_SESSION (legacy)');
        const sessionData = event.data.data;

        if (sessionData) {
            chrome.storage.local.set({
                [STORAGE_KEYS.TEXA_ORIGIN]: sessionData.origin,
                [STORAGE_KEYS.TEXA_TOKEN]: sessionData.token,
                [STORAGE_KEYS.TEXA_USER]: sessionData.user,
                [STORAGE_KEYS.LAST_SYNC]: Date.now()
            }, () => {
                console.log('TEXA Extension: Session synced (legacy)');
                chrome.runtime.sendMessage({ type: 'TEXA_LOGIN_SUCCESS' });
            });
        }
    }

    // Handle TEXA_LOGOUT message
    if (event.data.type === 'TEXA_LOGOUT') {
        console.log('ContentScript: Processing LOGOUT');

        chrome.storage.local.remove([
            STORAGE_KEYS.TEXA_ORIGIN,
            STORAGE_KEYS.TEXA_TOKEN,
            STORAGE_KEYS.TEXA_USER,
            STORAGE_KEYS.LAST_SYNC
        ], () => {
            console.log('TEXA Extension: Session cleared');
        });
    }
});

// Inject helper script to expose window.TEXAExtension API
function injectHelperScript() {
    try {
        const script = document.createElement('script');
        script.src = chrome.runtime.getURL('injectedScript.js');
        script.onload = function () {
            this.remove();
            // Dispatch ready event after injection
            window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
        };
        (document.head || document.documentElement).appendChild(script);
        console.log('TEXA Extension: Helper script injected');
    } catch (e) {
        console.error('TEXA Extension: Failed to inject helper script', e);
    }
}

// Auto-sync check: Read from localStorage if extension storage is empty
async function checkLocalStorageSync() {
    try {
        const result = await chrome.storage.local.get([STORAGE_KEYS.TEXA_TOKEN]);

        if (!result[STORAGE_KEYS.TEXA_TOKEN]) {
            // Try to read from localStorage (set by App.tsx)
            const idToken = window.localStorage.getItem('texa_id_token');
            const userEmail = window.localStorage.getItem('texa_user_email');
            const userRole = window.localStorage.getItem('texa_user_role');

            if (idToken && userEmail) {
                console.log('TEXA Extension: Found localStorage data, syncing...');

                chrome.storage.local.set({
                    [STORAGE_KEYS.TEXA_ORIGIN]: window.location.origin,
                    [STORAGE_KEYS.TEXA_TOKEN]: idToken,
                    [STORAGE_KEYS.TEXA_USER]: {
                        email: userEmail,
                        role: userRole || 'MEMBER',
                        name: userEmail.split('@')[0]
                    },
                    [STORAGE_KEYS.LAST_SYNC]: Date.now()
                });
            }
        }
    } catch (e) {
        console.error('Error checking localStorage:', e);
    }
}

// Initialize
injectHelperScript();

// Wait a bit for page to load, then check localStorage
setTimeout(checkLocalStorageSync, 1000);
