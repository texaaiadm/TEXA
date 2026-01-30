
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { supabase } from './services/supabaseService';

// Handle OAuth hash fragments from Supabase auth redirect
// When using HashRouter (#/), Supabase redirects to /#access_token=... which confuses the router
// This cleanup runs BEFORE React mounts to fix the URL
(async function cleanupOAuthHash() {
  const hash = window.location.hash;

  // Check if hash contains OAuth tokens (access_token, refresh_token, etc.)
  if (hash && hash.includes('access_token=')) {
    console.log('🔐 OAuth redirect detected, processing tokens...');

    try {
      // Parse the hash fragment to extract tokens
      // The hash format is: #access_token=xxx&refresh_token=yyy&...
      const hashParams = new URLSearchParams(hash.substring(1)); // Remove # and parse
      const accessToken = hashParams.get('access_token');
      const refreshToken = hashParams.get('refresh_token');

      if (accessToken && refreshToken) {
        // Set the session in Supabase
        const { error } = await supabase.auth.setSession({
          access_token: accessToken,
          refresh_token: refreshToken
        });

        if (error) {
          console.error('❌ Failed to set session:', error.message);
        } else {
          console.log('✅ OAuth session established successfully');
        }
      }
    } catch (e) {
      console.error('❌ Error processing OAuth tokens:', e);
    }

    // Clean the URL to prevent HashRouter from treating it as a route
    const cleanHash = '#/';
    window.history.replaceState(null, '', window.location.pathname + cleanHash);
    console.log('✅ URL cleaned');
  }
})();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

const root = ReactDOM.createRoot(rootElement);
root.render(
  <App />
);
