// =============================================
// TEXA-Ai Manager - Background Service Worker
// SILENT Token Scraping dengan Google Identity
// IMPROVED: Auto-close tabs, faster extraction,silent operation
// =============================================

// Firebase REST API Configuration
// PRIMARY: texa-ai (NEW MAIN DATABASE)
const FIREBASE_PRIMARY = {
    projectId: 'texa-ai',
    rtdbUrl: 'https://texa-ai-default-rtdb.firebaseio.com',
    tokenPath: 'texa_tokens/google_oauth_user_1'
};

// BACKUP 1: texa-ai
const FIREBASE_BACKUP_1 = {
    projectId: 'texa-ai',
    tokenPath: 'artifacts/my-token-vault/public/data/tokens/google_oauth_user_1'
};

// BACKUP 2: texa-ai
const FIREBASE_BACKUP_2 = {
    projectId: 'texa-ai',
    rtdbUrl: 'https://texa-ai-default-rtdb.firebaseio.com',
    tokenPath: 'texa_tokens/google_oauth_user_1'
};

// For backward compatibility
const FIREBASE_BACKUP = FIREBASE_BACKUP_2;

const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/flow';
const GOOGLE_LABS_API = 'https://labs.google/fx/api/tools';
const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

function getFirestoreUrl(projectId, path) {
    return `https://firestore.googleapis.com/v1/projects/${projectId}/databases/(default)/documents/${path}`;
}

function getPrimaryRtdbUrl(path) {
    return `${FIREBASE_PRIMARY.rtdbUrl}/${path}.json`;
}

function getBackupRtdbUrl(path) {
    return `${FIREBASE_BACKUP.rtdbUrl}/${path}.json`;
}

// =============================================
// OFFSCREEN DOCUMENT MANAGEMENT
// =============================================

let creatingOffscreen = false;

async function hasOffscreenDocument() {
    try {
        const contexts = await chrome.runtime.getContexts({
            contextTypes: ['OFFSCREEN_DOCUMENT']
        });
        return contexts.length > 0;
    } catch (e) {
        return false;
    }
}

async function setupOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        return true;
    }

    if (creatingOffscreen) {
        await new Promise(r => setTimeout(r, 200));
        return await hasOffscreenDocument();
    }

    creatingOffscreen = true;
    try {
        await chrome.offscreen.createDocument({
            url: 'offscreen.html',
            reasons: ['DOM_SCRAPING'],
            justification: 'Silent token extraction using browser Google session'
        });
        console.log('✅ TEXA: Offscreen document created');
        return true;
    } catch (e) {
        console.log('⚠️ TEXA: Offscreen creation:', e.message);
        return false;
    } finally {
        creatingOffscreen = false;
    }
}

async function closeOffscreenDocument() {
    if (await hasOffscreenDocument()) {
        try {
            await chrome.offscreen.closeDocument();
        } catch (e) { }
    }
}

// =============================================
// MAIN SILENT SCRAPE FUNCTION
// =============================================

async function scrapeToken() {
    console.log('🔄 TEXA: Starting token scrape...');

    try {
        // Quick check: Do we have a valid cached token?
        const cachedResult = await getToken();
        if (cachedResult.success) {
            // Check if token is fresh (less than 20 minutes old)
            const updatedAt = new Date(cachedResult.updatedAt);
            const ageMinutes = (Date.now() - updatedAt.getTime()) / 60000;
            if (ageMinutes < 20) {
                console.log('✅ TEXA: Using fresh cached token');
                return cachedResult;
            }
        }

        // Method 1: Check existing Google Labs tabs first (fastest if user has it open)
        const existingResult = await scrapeFromExistingTabs();
        if (existingResult.success) {
            console.log('✅ TEXA: Token found from existing tab!');
            return existingResult;
        }

        // Method 2: Try offscreen document
        const offscreenResult = await scrapeViaOffscreen();
        if (offscreenResult.success) {
            console.log('✅ TEXA: Token found via offscreen document!');
            return offscreenResult;
        }

        // Method 3: Background tab scraping - MOST RELIABLE (IMPROVED)
        // Opens a background tab (not focused), extracts token, auto-closes tab
        console.log('🔄 TEXA: Starting SILENT background tab scraping...');
        const backgroundResult = await scrapeViaBackgroundTab();
        if (backgroundResult.success) {
            console.log('✅ TEXA: Token obtained via background tab!');
            return backgroundResult;
        }

        // Method 4: Return stale cache if available
        if (cachedResult.success) {
            console.log('⚠️ TEXA: Using stale cached token');
            return cachedResult;
        }

        console.log('⚠️ TEXA: No token found');
        return { success: false, error: 'Could not obtain token' };

    } catch (error) {
        console.error('🔄 TEXA Error:', error);
        return { success: false, error: error.message };
    }
}

// =============================================
// BACKGROUND TAB SCRAPING - IMPROVED VERSION
// Most Reliable Method with GUARANTEED auto-close
// =============================================

async function scrapeViaBackgroundTab() {
    let tabId = null;

    try {
        console.log('🔄 TEXA: Creating SILENT background tab...');

        // Get current window
        const currentWindow = await chrome.windows.getCurrent();

        // Create tab in background (NOT focused, at end of tab bar)
        const tab = await chrome.tabs.create({
            url: GOOGLE_LABS_URL,
            active: false,      // NOT focused/visible
            pinned: false,
            windowId: currentWindow.id,
            index: 99999        // Place at end (least visible)
        });

        tabId = tab.id;
        console.log('✅ TEXA: Silent tab created:', tabId);

        // GUARANTEED cleanup - will ALWAYS close tab
        const guaranteedCleanup = async () => {
            if (tabId) {
                try {
                    await chrome.tabs.remove(tabId);
                    console.log('✅ TEXA: Tab auto-closed:', tabId);
                    tabId = null;
                } catch (e) {
                    console.log('⚠️ TEXA: Tab already closed');
                }
            }
        };

        // Extract token with auto-close (max 40 seconds)
        const result = await Promise.race([
            extractTokenWithAutoClose(tabId, guaranteedCleanup),
            timeoutPromise(40000, 'Extraction timeout')
        ]);

        // Ensure cleanup even if extraction succeeded
        await guaranteedCleanup();

        return result;

    } catch (e) {
        console.log('⚠️ TEXA: Background tab error:', e.message);

        // Emergency cleanup
        if (tabId) {
            try { await chrome.tabs.remove(tabId); } catch { }
        }

        return { success: false, error: e.message };
    }
}

// Helper: Create timeout promise
function timeoutPromise(ms, errorMsg) {
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMsg)), ms);
    });
}

// Extract token with auto-close on ALL paths
async function extractTokenWithAutoClose(tabId, cleanupFn) {
    return new Promise((resolve) => {
        let attempts = 0;
        const maxAttempts = 12;  // 12 attempts * 2s = 24 seconds max
        let resolved = false;

        const safeResolve = async (result) => {
            if (!resolved) {
                resolved = true;
                console.log('🔒 TEXA: Resolving and triggering auto-close...');
                await cleanupFn();
                resolve(result);
            }
        };

        const checkAndExtract = async () => {
            if (resolved) return;
            attempts++;

            try {
                const currentTab = await chrome.tabs.get(tabId);
                const shortUrl = currentTab.url?.substring(0, 40) || 'unknown';
                console.log(`🔍 ${attempts}/${maxAttempts} | ${currentTab.status} | ${shortUrl}...`);

                // CASE 1: Redirected to login (user not signed in to Google)
                if (currentTab.url && currentTab.url.includes('accounts.google.com')) {
                    console.log('🔐 TEXA: Login required - making tab visible');

                    // Make tab visible for user to login
                    await chrome.tabs.update(tabId, { active: true });

                    // Wait for login (max 60 seconds)
                    const loginResult = await waitForLoginCompletion(tabId, 60000);

                    if (loginResult.success) {
                        // Login successful - extract token
                        const extractResult = await extractTokenFromTab(tabId);
                        await safeResolve(extractResult);
                    } else {
                        await safeResolve({ success: false, error: 'Login timeout or cancelled' });
                    }
                    return;
                }

                // CASE 2: On Labs page and fully loaded
                if (currentTab.url &&
                    currentTab.url.includes('labs.google') &&
                    !currentTab.url.includes('accounts.google') &&
                    currentTab.status === 'complete') {

                    // Page loaded - extract token (reduced delay for speed)
                    await new Promise(r => setTimeout(r, 1200)); // Faster: 1.2s instead of 2s

                    const extractResult = await extractTokenFromTab(tabId);

                    if (extractResult.success) {
                        console.log('✅ TEXA: Token extracted! Auto-closing tab NOW...');
                        await safeResolve(extractResult);
                        return;
                    } else {
                        console.log('⚠️  Token not found yet, retrying...');
                    }
                }

                // CASE 3: Continue retrying
                if (attempts < maxAttempts) {
                    setTimeout(checkAndExtract, 2000);
                } else {
                    console.log('⏱️ TEXA: Max attempts - auto-closing tab');
                    await safeResolve({ success: false, error: 'Token not found' });
                }

            } catch (e) {
                console.log('❌ TEXA: Error:', e.message);

                // Tab closed or error
                if (!e.message.includes('No tab with id')) {
                    if (attempts < maxAttempts) {
                        setTimeout(checkAndExtract, 2000);
                    } else {
                        await safeResolve({ success: false, error: e.message });
                    }
                } else {
                    await safeResolve({ success: false, error: 'Tab was closed' });
                }
            }
        };

        // Start extraction after brief initial delay
        setTimeout(checkAndExtract, 2000); // Start after 2s
    });
}

// Wait for user login with timeout
async function waitForLoginCompletion(tabId, timeoutMs) {
    const startTime = Date.now();

    return new Promise((resolve) => {
        const checkLogin = async () => {
            // Timeout check
            if (Date.now() - startTime > timeoutMs) {
                console.log('⏱️ TEXA: Login timeout');
                resolve({ success: false, error: 'Login timeout' });
                return;
            }

            try {
                const tab = await chrome.tabs.get(tabId);

                // Check if back on Labs page (login successful)
                if (tab.url &&
                    tab.url.includes('labs.google') &&
                    !tab.url.includes('accounts.google') &&
                    tab.status === 'complete') {

                    console.log('✅ TEXA: Login successful!');
                    resolve({ success: true });
                    return;
                }

                // Still on login page
                setTimeout(checkLogin, 1000);

            } catch (e) {
                resolve({ success: false, error: e.message });
            }
        };

        checkLogin();
    });
}

// =============================================
// AUTO-LOGIN FLOW - Silent using Chrome Identity
// =============================================

async function autoLoginAndScrape() {
    try {
        console.log('🔐 TEXA: Starting SILENT auto-login flow (no tabs)...');

        // Method A: Try interactive OAuth (shows small popup, not full tab)
        const interactiveResult = await getTokenViaInteractiveAuth();
        if (interactiveResult.success) {
            console.log('✅ TEXA: Got token via interactive OAuth!');
            return interactiveResult;
        }

        // Method B: Try Web Auth Flow (popup window, not tab)
        const webAuthResult = await getTokenViaWebAuthFlow();
        if (webAuthResult.success) {
            console.log('✅ TEXA: Got token via Web Auth Flow!');
            return webAuthResult;
        }

        // Method C: As last resort, try opening Labs in background window (minimized)
        const backgroundResult = await scrapeViaHiddenWindow();
        if (backgroundResult.success) {
            console.log('✅ TEXA: Got token via hidden window!');
            return backgroundResult;
        }

        return { success: false, error: 'Silent auth failed - user needs to login' };

    } catch (e) {
        console.log('⚠️ TEXA: Auto-login failed:', e.message);
        return { success: false, error: e.message };
    }
}

// Interactive OAuth - shows small account selector popup
async function getTokenViaInteractiveAuth() {
    try {
        console.log('🔐 TEXA: Trying interactive OAuth...');

        const token = await new Promise((resolve) => {
            chrome.identity.getAuthToken({
                interactive: true  // Will show account selector popup
            }, (authToken) => {
                if (chrome.runtime.lastError) {
                    console.log('⚠️ TEXA: Interactive auth error:', chrome.runtime.lastError.message);
                    resolve(null);
                } else {
                    resolve(authToken);
                }
            });
        });

        if (token) {
            console.log('✅ TEXA: Got OAuth token via interactive auth');
            await saveToken(token, 'Interactive OAuth');
            return { success: true, token, method: 'interactive_oauth' };
        }

        return { success: false, error: 'Interactive auth declined or failed' };
    } catch (e) {
        console.log('⚠️ TEXA: Interactive auth failed:', e.message);
        return { success: false, error: e.message };
    }
}

// Web Auth Flow - opens popup window for Google login
async function getTokenViaWebAuthFlow() {
    try {
        console.log('🔐 TEXA: Trying Web Auth Flow...');

        // Get Extension ID for redirect
        const redirectUrl = chrome.identity.getRedirectURL();
        console.log('🔐 TEXA: Redirect URL:', redirectUrl);

        // Google OAuth URL
        const authUrl = new URL('https://accounts.google.com/o/oauth2/auth');
        authUrl.searchParams.set('client_id', chrome.runtime.id + '.apps.googleusercontent.com');
        authUrl.searchParams.set('redirect_uri', redirectUrl);
        authUrl.searchParams.set('response_type', 'token');
        authUrl.searchParams.set('scope', 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email');

        const responseUrl = await new Promise((resolve) => {
            chrome.identity.launchWebAuthFlow({
                url: authUrl.toString(),
                interactive: true
            }, (response) => {
                if (chrome.runtime.lastError) {
                    console.log('⚠️ TEXA: Web auth flow error:', chrome.runtime.lastError.message);
                    resolve(null);
                } else {
                    resolve(response);
                }
            });
        });

        if (responseUrl) {
            // Extract access token from URL
            const urlParams = new URLSearchParams(new URL(responseUrl).hash.substring(1));
            const accessToken = urlParams.get('access_token');

            if (accessToken) {
                console.log('✅ TEXA: Got token via Web Auth Flow');
                await saveToken(accessToken, 'Web Auth Flow');
                return { success: true, token: accessToken, method: 'web_auth_flow' };
            }
        }

        return { success: false, error: 'Web auth flow failed' };
    } catch (e) {
        console.log('⚠️ TEXA: Web auth flow failed:', e.message);
        return { success: false, error: e.message };
    }
}

// Hidden window approach - creates minimized window
async function scrapeViaHiddenWindow() {
    try {
        console.log('🔐 TEXA: Trying hidden window approach...');

        // Create a minimized window with Labs
        const win = await chrome.windows.create({
            url: GOOGLE_LABS_URL,
            type: 'popup',
            width: 1,
            height: 1,
            left: -1000,
            top: -1000,
            focused: false,
            state: 'minimized'
        });

        if (!win.tabs || win.tabs.length === 0) {
            return { success: false, error: 'Could not create hidden window' };
        }

        const tabId = win.tabs[0].id;

        // Wait for page to load and try to extract token
        const result = await new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 10;

            const checkForToken = async () => {
                attempts++;
                console.log(`🔐 TEXA: Hidden window check attempt ${attempts}/${maxAttempts}`);

                try {
                    const tab = await chrome.tabs.get(tabId);

                    // If on Labs page, extract token
                    if (tab.url && tab.url.includes('labs.google') && !tab.url.includes('accounts.google.com')) {
                        // Wait for page to fully load
                        if (tab.status === 'complete') {
                            setTimeout(async () => {
                                const extractResult = await extractTokenFromTab(tabId);
                                // Close window after extraction
                                try { await chrome.windows.remove(win.id); } catch (e) { }

                                if (extractResult.success) {
                                    resolve(extractResult);
                                } else if (attempts < maxAttempts) {
                                    setTimeout(checkForToken, 2000);
                                } else {
                                    resolve({ success: false, error: 'Could not extract token' });
                                }
                            }, 2000);
                            return;
                        }
                    }

                    // If redirected to login, close window and fail
                    if (tab.url && tab.url.includes('accounts.google.com')) {
                        console.log('🔐 TEXA: Hidden window redirected to login - closing');
                        try { await chrome.windows.remove(win.id); } catch (e) { }
                        resolve({ success: false, error: 'User not logged in to Google' });
                        return;
                    }

                    if (attempts < maxAttempts) {
                        setTimeout(checkForToken, 2000);
                    } else {
                        try { await chrome.windows.remove(win.id); } catch (e) { }
                        resolve({ success: false, error: 'Hidden window timeout' });
                    }

                } catch (e) {
                    console.log('⚠️ TEXA: Hidden window error:', e.message);
                    if (attempts < maxAttempts) {
                        setTimeout(checkForToken, 2000);
                    } else {
                        try { await chrome.windows.remove(win.id); } catch (e2) { }
                        resolve({ success: false, error: e.message });
                    }
                }
            };

            // Start checking after initial delay
            setTimeout(checkForToken, 3000);
        });

        return result;

    } catch (e) {
        console.log('⚠️ TEXA: Hidden window failed:', e.message);
        return { success: false, error: e.message };
    }
}

// Export for testing
if (typeof module !== 'undefined' && module.exports) {
    module.exports = {
        scrapeToken,
        scrapeViaBackgroundTab,
        scrapeViaOffscreen,
        scrapeFromExistingTabs
    };
}
