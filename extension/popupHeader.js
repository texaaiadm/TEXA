// =============================================
// TEXA Popup Header Script
// Handles Home button click in popup
// =============================================

// Home button click handler
document.addEventListener('DOMContentLoaded', function () {
    const btnGoHome = document.getElementById('btnGoHome');

    if (btnGoHome) {
        btnGoHome.addEventListener('click', function () {
            // Use getDashboardUrl if available, otherwise use default
            const dashboardUrl = (typeof getDashboardUrl === 'function')
                ? getDashboardUrl()
                : 'http://localhost:3000';

            chrome.tabs.create({ url: dashboardUrl + '/#/' });
        });
    }
});
