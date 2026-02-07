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
        console.log('🔧 ContentScript: Forwarding OPEN_TOOL to background');

        // Use Promise with timeout for reliability
        const sendWithTimeout = async () => {
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    console.log('⚠️ ContentScript: Background timeout after 5s');
                    resolve({ success: false, error: 'Background timeout' });
                }, 5000);

                chrome.runtime.sendMessage(event.data, (response) => {
                    clearTimeout(timeout);
                    if (chrome.runtime.lastError) {
                        console.error('❌ ContentScript: Runtime error:', chrome.runtime.lastError.message);
                        resolve({ success: false, error: chrome.runtime.lastError.message });
                    } else {
                        console.log('✅ ContentScript: Background response:', response);
                        resolve(response || { success: false, error: 'No response' });
                    }
                });
            });
        };

        try {
            const response = await sendWithTimeout();

            // Send ACK back to the page with actual result
            window.postMessage({
                type: 'TEXA_OPEN_TOOL_ACK',
                requestId: event.data.requestId,
                ok: response?.success === true,
                error: response?.error || null
            }, window.location.origin);
        } catch (err) {
            console.error('❌ ContentScript: Error:', err);
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
        // Check if already injected (prevent duplicates)
        if (document.getElementById('texa-extension-helper')) {
            console.log('TEXA Extension: Helper already injected, dispatching ready event');
            window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
            return;
        }

        const script = document.createElement('script');
        script.id = 'texa-extension-helper';
        script.src = chrome.runtime.getURL('injectedScript.js');
        script.onload = function () {
            // Don't remove - keep in DOM for HMR compatibility
            console.log('TEXA Extension: Helper script loaded');
            window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
        };
        (document.head || document.documentElement).appendChild(script);
        console.log('✅ TEXA Extension: Helper script injected');
    } catch (e) {
        console.error('TEXA Extension: Failed to inject helper script', e);
    }
}

// Monitor for HMR/page changes and re-inject if needed
function monitorExtensionState() {
    setInterval(() => {
        if (!window.TEXAExtension || !window.TEXAExtension.ready) {
            console.log('⚠️ TEXA Extension: Lost, re-injecting...');
            // Remove old script if exists
            const oldScript = document.getElementById('texa-extension-helper');
            if (oldScript) oldScript.remove();
            // Re-inject
            injectHelperScript();
        }
    }, 2000); // Check every 2 seconds
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

// Real-time localStorage monitoring for login/logout detection
let lastUserState = null;

function monitorUserState() {
    setInterval(async () => {
        try {
            const idToken = window.localStorage.getItem('texa_id_token');
            const userEmail = window.localStorage.getItem('texa_user_email');
            const userRole = window.localStorage.getItem('texa_user_role');
            const userId = window.localStorage.getItem('texa_user_id');

            const currentState = idToken ? `${userId}_${userEmail}` : null;

            // Check if user state changed (login/logout)
            if (currentState !== lastUserState) {
                console.log('🔄 TEXA: User state changed:', currentState ? 'logged in' : 'logged out');
                lastUserState = currentState;

                if (idToken && userEmail) {
                    // User logged in - sync to extension
                    const userData = {
                        id: userId,
                        email: userEmail,
                        role: userRole || 'MEMBER',
                        name: userEmail.split('@')[0]
                    };

                    // Try to get subscription data from localStorage
                    const subEnd = window.localStorage.getItem('texa_subscription_end');
                    if (subEnd) {
                        userData.subscriptionEnd = subEnd;
                    }

                    chrome.storage.local.set({
                        [STORAGE_KEYS.TEXA_ORIGIN]: window.location.origin,
                        [STORAGE_KEYS.TEXA_TOKEN]: idToken,
                        [STORAGE_KEYS.TEXA_USER]: userData,
                        [STORAGE_KEYS.LAST_SYNC]: Date.now()
                    }, () => {
                        console.log('✅ TEXA: User synced to extension:', userEmail);
                        // Notify background
                        chrome.runtime.sendMessage({ type: 'TEXA_LOGIN_SUCCESS' });
                        // Dispatch event to web app
                        window.dispatchEvent(new CustomEvent('TEXA_USER_SYNCED', { detail: userData }));
                    });
                } else {
                    // User logged out - clear extension storage
                    chrome.storage.local.remove([
                        STORAGE_KEYS.TEXA_ORIGIN,
                        STORAGE_KEYS.TEXA_TOKEN,
                        STORAGE_KEYS.TEXA_USER,
                        STORAGE_KEYS.LAST_SYNC
                    ], () => {
                        console.log('🚪 TEXA: User logged out, extension storage cleared');
                        window.dispatchEvent(new CustomEvent('TEXA_USER_LOGGED_OUT'));
                    });
                }
            }
        } catch (e) {
            // Silently ignore errors
        }
    }, 3000); // Check every 3 seconds
}

// Listen for storage changes from other tabs
window.addEventListener('storage', (event) => {
    if (event.key === 'texa_id_token' || event.key === 'texa_user_email') {
        console.log('🔄 TEXA: Storage changed in another tab, syncing...');
        setTimeout(checkLocalStorageSync, 500);
    }
});

// Initialize
injectHelperScript();

// Start monitoring for HMR/page changes
monitorExtensionState();

// Start monitoring user state for login/logout
monitorUserState();

// Wait a bit for page to load, then check localStorage
setTimeout(checkLocalStorageSync, 1000);

console.log('✅ TEXA Extension: Content script initialized with HMR + User Sync support');
