// =============================================
// TEXA Auto-Login Content Script
// Automatically clicks Google account for login
// Injected into accounts.google.com pages
// =============================================

(function () {
    'use strict';

    console.log('🔐 TEXA Auto-Login: Script loaded on', window.location.href);

    // Only run on relevant pages
    if (!window.location.href.includes('accounts.google.com')) {
        return;
    }

    // Mark that we're running
    if (window.__TEXA_AUTO_LOGIN_ACTIVE__) {
        console.log('🔐 TEXA Auto-Login: Already running, skipping');
        return;
    }
    window.__TEXA_AUTO_LOGIN_ACTIVE__ = true;

    let clickAttempts = 0;
    const MAX_ATTEMPTS = 20;

    // Function to find and click account
    function tryClickAccount() {
        clickAttempts++;
        console.log(`🔐 TEXA Auto-Login: Attempt ${clickAttempts}/${MAX_ATTEMPTS}`);

        // Method 1: Find account by data-identifier attribute (most reliable)
        const accountsById = document.querySelectorAll('[data-identifier]');
        if (accountsById.length > 0) {
            console.log('🔐 TEXA: Found', accountsById.length, 'account(s) by data-identifier');
            const firstAccount = accountsById[0];
            console.log('🔐 TEXA: Clicking account:', firstAccount.getAttribute('data-identifier'));
            firstAccount.click();
            notifyBackground('clicked_account');
            return true;
        }

        // Method 2: Find by email text pattern in the page
        const allDivs = document.querySelectorAll('div[role="link"], div[data-email], li[data-value]');
        for (const div of allDivs) {
            const text = div.textContent || '';
            if (text.includes('@gmail.com') || text.includes('@googlemail.com')) {
                console.log('🔐 TEXA: Found account by email pattern:', text.substring(0, 30));
                div.click();
                notifyBackground('clicked_email');
                return true;
            }
        }

        // Method 3: Find the main account container (JDAKTe is Google's class for account items)
        const accountContainers = document.querySelectorAll('.JDAKTe, .d2CFce, .rFrNMe');
        if (accountContainers.length > 0) {
            console.log('🔐 TEXA: Found', accountContainers.length, 'account container(s)');
            accountContainers[0].click();
            notifyBackground('clicked_container');
            return true;
        }

        // Method 4: Look for clickable elements with user profile info
        const profileDivs = document.querySelectorAll('[data-profile-identifier], .lCoei, .Xb9hP');
        if (profileDivs.length > 0) {
            console.log('🔐 TEXA: Found profile div');
            profileDivs[0].click();
            notifyBackground('clicked_profile');
            return true;
        }

        // Method 5: Find any ul li that looks like an account list
        const listItems = document.querySelectorAll('ul li[role="button"], ul li[tabindex="0"]');
        for (const li of listItems) {
            if (li.textContent && li.textContent.includes('@')) {
                console.log('🔐 TEXA: Found account in list');
                li.click();
                notifyBackground('clicked_list');
                return true;
            }
        }

        return false;
    }

    // Function to click Continue/Next/Allow buttons
    function tryClickContinue() {
        // Common button patterns for Google
        const buttonPatterns = [
            { selector: 'button[type="submit"]', check: null },
            {
                selector: 'button.VfPpkd-LgbsSe', check: (el) => {
                    const text = el.textContent.toLowerCase();
                    return text.includes('next') || text.includes('continue') || text.includes('lanjutkan') ||
                        text.includes('berikutnya') || text.includes('allow') || text.includes('izinkan');
                }
            },
            { selector: '#continue', check: null },
            { selector: '#submit_approve_access', check: null },
            { selector: 'input[type="submit"]', check: null },
            { selector: '[data-idom-class="nCP5yc"]', check: null }
        ];

        for (const pattern of buttonPatterns) {
            const elements = document.querySelectorAll(pattern.selector);
            for (const el of elements) {
                if (!pattern.check || pattern.check(el)) {
                    console.log('🔐 TEXA: Clicking button:', el.textContent?.substring(0, 20));
                    el.click();
                    return true;
                }
            }
        }
        return false;
    }

    // Notify background script
    function notifyBackground(action) {
        try {
            chrome.runtime.sendMessage({
                type: 'TEXA_AUTO_LOGIN_CLICKED',
                action: action,
                url: window.location.href
            });
        } catch (e) {
            console.log('🔐 TEXA: Could not notify background:', e.message);
        }
    }

    // Main polling loop
    function startPolling() {
        const interval = setInterval(() => {
            if (clickAttempts >= MAX_ATTEMPTS) {
                console.log('🔐 TEXA Auto-Login: Max attempts reached');
                clearInterval(interval);
                return;
            }

            // First try to click account
            if (tryClickAccount()) {
                console.log('🔐 TEXA: Account clicked successfully!');
                // Don't clear interval yet - might need to click continue buttons too
            }

            // Also try continue buttons
            tryClickContinue();

        }, 1000);

        // Cleanup after 30 seconds
        setTimeout(() => {
            clearInterval(interval);
            console.log('🔐 TEXA Auto-Login: Timeout, stopping');
        }, 30000);
    }

    // Start immediately if page is ready
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        console.log('🔐 TEXA Auto-Login: Page ready, starting...');
        setTimeout(startPolling, 500);
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('🔐 TEXA Auto-Login: DOM loaded, starting...');
            setTimeout(startPolling, 500);
        });
    }

    // Also observe for dynamic content
    const observer = new MutationObserver((mutations) => {
        // If new content is added, try clicking again
        for (const mutation of mutations) {
            if (mutation.addedNodes.length > 0) {
                setTimeout(() => {
                    tryClickAccount() || tryClickContinue();
                }, 300);
                break;
            }
        }
    });

    observer.observe(document.body || document.documentElement, {
        childList: true,
        subtree: true
    });

    console.log('🔐 TEXA Auto-Login: Initialized and waiting...');

})();
