// Content Script khusus untuk Google Labs Flow
// Bertugas mengambil source HTML, mencari token, dan mengirimnya ke background

(function () {
  console.log('TEXA: Google Flow Scraper Active');

  // Regex untuk token ya29... (minimal 100 karakter untuk token lengkap)
  const tokenRegex = /ya29\.[a-zA-Z0-9_-]{100,}/g;

  // Fungsi untuk mencari token dalam text
  function findTokenInText(text) {
    const matches = text.match(tokenRegex);
    if (matches && matches.length > 0) {
      // Ambil token terpanjang (biasanya yang paling lengkap)
      return matches.reduce((a, b) => a.length > b.length ? a : b);
    }
    return null;
  }

  // Scan page content
  function scanForToken() {
    // Try page HTML first
    const htmlContent = document.documentElement.outerHTML;
    let token = findTokenInText(htmlContent);

    if (token) {
      console.log('TEXA: Token found!', token.substring(0, 30) + '...');

      // Send to background.js
      chrome.runtime.sendMessage({
        type: 'TEXA_TOKEN_FOUND',
        token: token,
        source: window.location.href
      });

      return true;
    }

    return false;
  }

  // Initial scan after page load
  if (document.readyState === 'complete') {
    setTimeout(scanForToken, 1500);
  } else {
    window.addEventListener('load', () => {
      setTimeout(scanForToken, 1500);
    });
  }

  // Retry scan with observer for dynamic content
  let scanAttempts = 0;
  const maxAttempts = 10;

  const scanInterval = setInterval(() => {
    scanAttempts++;
    if (scanForToken() || scanAttempts >= maxAttempts) {
      clearInterval(scanInterval);
      if (scanAttempts >= maxAttempts) {
        console.log('TEXA: Max scan attempts reached, no token found');
      }
    }
  }, 2000);

  // Cleanup after 30 seconds
  setTimeout(() => {
    clearInterval(scanInterval);
  }, 30000);

})();
