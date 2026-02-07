// Content Script khusus untuk Google Flow
// Bertugas mengambil source HTML, mencari token, dan mengirimnya ke background

(function() {
  console.log('TEXA: Google Flow Scraper Active');

  // Fungsi untuk mencari token dalam text
  function findTokenInText(text) {
    // Regex: ya29. diikuti karakter valid minimal 50 char
    const tokenRegex = /ya29\.[a-zA-Z0-9_-]{50,}/g;
    const matches = text.match(tokenRegex);
    return matches && matches.length > 0 ? matches[0] : null;
  }

  // Coba cari token di seluruh HTML halaman
  const htmlContent = document.documentElement.outerHTML;
  const token = findTokenInText(htmlContent);

  if (token) {
    console.log('TEXA: Token found in page content!');
    chrome.runtime.sendMessage({
      type: 'TEXA_TOKEN_FOUND',
      token: token
    });
  } else {
    console.log('TEXA: No token found yet. Observing DOM changes...');
    
    // Opsional: Observer jika token dimuat secara dinamis via AJAX/Script
    // Namun biasanya token ya29 ada di initial HTML (bootstrapped data)
  }

})();