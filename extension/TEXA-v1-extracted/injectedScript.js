
(function () {
  window.TEXAExtension = {
    ready: true,
    version: '1.0.0',

    /**
     * Opens a tool by fetching cookies from apiUrl and injecting them before navigation.
     * Returns a Promise that resolves when tool is opened.
     */
    openTool: function (toolId, targetUrl, apiUrl, cookiesData, idToken) {
      console.log('🚀 TEXA Extension: Opening tool', toolId, targetUrl);

      const requestId = `${Date.now()}-${Math.random().toString(16).slice(2)}`;

      return new Promise((resolve) => {
        const timeout = setTimeout(() => {
          console.log('⚠️ TEXA Extension: Timeout, fallback to window.open');
          window.removeEventListener('message', onAck);
          window.open(targetUrl, '_blank');
          resolve(true);
        }, 3000);

        const onAck = (event) => {
          if (event.origin !== window.location.origin) return;
          const data = event.data || {};
          if (data.type !== 'TEXA_OPEN_TOOL_ACK') return;
          if (data.requestId !== requestId) return;

          clearTimeout(timeout);
          window.removeEventListener('message', onAck);
          console.log('✅ TEXA Extension: ACK received', data.ok);

          if (!data.ok && targetUrl) {
            window.open(targetUrl, '_blank');
          }
          resolve(data.ok);
        };

        window.addEventListener('message', onAck);

        window.postMessage({
          source: 'TEXA_DASHBOARD',
          type: 'TEXA_OPEN_TOOL',
          requestId: requestId,
          toolId: toolId,
          targetUrl: targetUrl,
          apiUrl: apiUrl,
          cookiesData: cookiesData || null,
          idToken: idToken || null
        }, window.location.origin);
      });
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
