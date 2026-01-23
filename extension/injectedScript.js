
(function () {
  window.TEXAExtension = {
    ready: true,
    version: '1.0.0',

    /**
     * Opens a tool by fetching cookies from apiUrl and injecting them before navigation.
     * @param {string} toolId 
     * @param {string} targetUrl 
     * @param {string} apiUrl 
     */
    openTool: function (toolId, targetUrl, apiUrl) {
      console.log('TEXA Extension: Opening tool', toolId, targetUrl, apiUrl);

      window.postMessage({
        source: 'TEXA_DASHBOARD',
        type: 'TEXA_OPEN_TOOL',
        toolId: toolId,
        targetUrl: targetUrl,
        apiUrl: apiUrl
      }, window.location.origin);
    },

    /**
     * Syncs session data from web app to extension storage
     * @param {Object} sessionData - { origin, token, user }
     */
    syncSession: function (sessionData) {
      console.log('TEXA Extension: Syncing session');
      window.postMessage({
        source: 'TEXA_DASHBOARD',
        type: 'TEXA_SYNC_SESSION',
        data: sessionData
      }, window.location.origin);
    },

    /**
     * Logout from extension
     */
    logout: function () {
      console.log('TEXA Extension: Logging out');
      window.postMessage({
        source: 'TEXA_DASHBOARD',
        type: 'TEXA_LOGOUT'
      }, window.location.origin);
    },

    getStatus: function () {
      return {
        ready: true,
        version: '1.0.0',
        connected: true
      };
    }
  };

  // Dispatch event to notify React app that extension is ready
  window.dispatchEvent(new CustomEvent('TEXA_EXTENSION_READY'));
  console.log('TEXA Extension: API ready');
})();
