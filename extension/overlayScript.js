// =============================================
// TEXA Overlay Header Script
// Injects a transparent overlay header on specific URLs
// =============================================

(function () {
    'use strict';

    console.log('🎨 TEXA Overlay: Script loaded on', window.location.href);

    // Check if overlay already exists
    if (document.getElementById('texa-overlay-header')) {
        console.log('🎨 TEXA Overlay: Already injected, skipping');
        return;
    }

    // Dashboard URL
    const DASHBOARD_URL = 'http://localhost:3000'; // For production: 'https://texa-canvas.vercel.app'

    // Create overlay header HTML
    function createOverlay() {
        // Create container
        const overlay = document.createElement('div');
        overlay.id = 'texa-overlay-header';
        overlay.innerHTML = `
            <div class="texa-overlay-left">
                <div class="texa-logo-glow">
                    <img src="${chrome.runtime.getURL('icon/icon128.png')}" alt="TEXA">
                </div>
                <span class="texa-brand">TEXA</span>
            </div>
            
            <!-- Digital Clock WIB -->
            <div class="texa-clock-container">
                <div class="texa-clock" id="texa-digital-clock">00:00:00</div>
                <div class="texa-clock-label">WIB</div>
            </div>
            
            <div class="texa-overlay-right">
                <button class="texa-btn-home" id="texa-go-home" title="Kembali ke Dashboard TEXA">
                    <svg viewBox="0 0 24 24" width="16" height="16">
                        <path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                    </svg>
                    Dashboard
                </button>
            </div>
        `;

        // Add styles
        const style = document.createElement('style');
        style.id = 'texa-overlay-styles';
        style.textContent = `
            #texa-overlay-header {
                position: fixed !important;
                top: 0 !important;
                left: 0 !important;
                right: 0 !important;
                z-index: 2147483647 !important;
                display: flex !important;
                align-items: center !important;
                justify-content: space-between !important;
                padding: 12px 20px !important;
                background: rgba(0, 0, 0, 0.75) !important;
                backdrop-filter: blur(20px) saturate(180%) !important;
                -webkit-backdrop-filter: blur(20px) saturate(180%) !important;
                border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
                box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4) !important;
                font-family: 'Segoe UI', Roboto, Helvetica, Arial, sans-serif !important;
                height: 60px !important;
                box-sizing: border-box !important;
            }

            #texa-overlay-header * {
                box-sizing: border-box !important;
            }

            .texa-overlay-left {
                display: flex !important;
                align-items: center !important;
                gap: 12px !important;
            }

            .texa-logo-glow {
                width: 40px !important;
                height: 40px !important;
                border-radius: 50% !important;
                overflow: hidden !important;
                box-shadow: 
                    0 0 15px rgba(59, 130, 246, 0.6),
                    0 0 30px rgba(6, 182, 212, 0.4),
                    0 0 45px rgba(139, 92, 246, 0.2) !important;
                border: 2px solid rgba(255, 255, 255, 0.25) !important;
                animation: texa-glow-pulse 2s ease-in-out infinite alternate !important;
            }

            @keyframes texa-glow-pulse {
                0% {
                    box-shadow: 
                        0 0 10px rgba(59, 130, 246, 0.4),
                        0 0 20px rgba(6, 182, 212, 0.2);
                }
                100% {
                    box-shadow: 
                        0 0 20px rgba(59, 130, 246, 0.7),
                        0 0 40px rgba(6, 182, 212, 0.5),
                        0 0 60px rgba(139, 92, 246, 0.3);
                }
            }

            .texa-logo-glow img {
                width: 100% !important;
                height: 100% !important;
                object-fit: cover !important;
                border-radius: 50% !important;
            }

            .texa-brand {
                font-size: 18px !important;
                font-weight: 800 !important;
                background: linear-gradient(135deg, #60a5fa, #22d3ee, #a78bfa) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                text-transform: uppercase !important;
                letter-spacing: 3px !important;
            }

            /* Digital Clock Styles */
            .texa-clock-container {
                display: flex !important;
                flex-direction: column !important;
                align-items: center !important;
                gap: 2px !important;
            }

            .texa-clock {
                font-size: 24px !important;
                font-weight: 700 !important;
                font-family: 'Consolas', 'Monaco', 'Courier New', monospace !important;
                color: #fff !important;
                text-shadow: 
                    0 0 10px rgba(34, 211, 238, 0.8),
                    0 0 20px rgba(34, 211, 238, 0.5),
                    0 0 30px rgba(34, 211, 238, 0.3) !important;
                letter-spacing: 3px !important;
                background: linear-gradient(135deg, #22d3ee, #60a5fa, #a78bfa) !important;
                -webkit-background-clip: text !important;
                -webkit-text-fill-color: transparent !important;
                background-clip: text !important;
                animation: texa-clock-glow 1s ease-in-out infinite alternate !important;
            }

            @keyframes texa-clock-glow {
                0% {
                    filter: brightness(1);
                }
                100% {
                    filter: brightness(1.2);
                }
            }

            .texa-clock-label {
                font-size: 10px !important;
                font-weight: 600 !important;
                color: rgba(255, 255, 255, 0.6) !important;
                text-transform: uppercase !important;
                letter-spacing: 2px !important;
            }

            .texa-overlay-right {
                display: flex !important;
                align-items: center !important;
                gap: 10px !important;
            }

            .texa-btn-home {
                display: flex !important;
                align-items: center !important;
                gap: 6px !important;
                padding: 10px 18px !important;
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.25), rgba(6, 182, 212, 0.25)) !important;
                border: 1px solid rgba(59, 130, 246, 0.5) !important;
                border-radius: 25px !important;
                color: #60a5fa !important;
                font-size: 13px !important;
                font-weight: 700 !important;
                cursor: pointer !important;
                transition: all 0.3s ease !important;
                text-decoration: none !important;
                font-family: inherit !important;
            }

            .texa-btn-home:hover {
                background: linear-gradient(135deg, rgba(59, 130, 246, 0.4), rgba(6, 182, 212, 0.4)) !important;
                border-color: rgba(59, 130, 246, 0.8) !important;
                transform: scale(1.05) !important;
                box-shadow: 0 0 25px rgba(59, 130, 246, 0.5) !important;
                color: #fff !important;
            }

            /* Push page content down to avoid overlap */
            body {
                padding-top: 60px !important;
            }

            /* Fix for some sites that use fixed headers */
            [style*="position: fixed"][style*="top: 0"],
            [style*="position:fixed"][style*="top:0"],
            header[style*="position: fixed"],
            .fixed-top,
            .sticky-top {
                top: 60px !important;
            }
        `;

        // Inject into page
        document.head.appendChild(style);
        document.body.insertBefore(overlay, document.body.firstChild);

        // Handle Home button click
        document.getElementById('texa-go-home').addEventListener('click', function () {
            window.location.href = DASHBOARD_URL + '/#/';
        });

        // Start digital clock
        updateClock();
        setInterval(updateClock, 1000);

        console.log('✅ TEXA Overlay: Header injected successfully with WIB clock');
    }

    // Update digital clock with WIB timezone (UTC+7)
    function updateClock() {
        const clockElement = document.getElementById('texa-digital-clock');
        if (!clockElement) return;

        // Get current time in WIB (Asia/Jakarta - UTC+7)
        const now = new Date();
        const wibTime = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Jakarta' }));

        const hours = String(wibTime.getHours()).padStart(2, '0');
        const minutes = String(wibTime.getMinutes()).padStart(2, '0');
        const seconds = String(wibTime.getSeconds()).padStart(2, '0');

        clockElement.textContent = `${hours}:${minutes}:${seconds}`;
    }

    // Wait for DOM to be ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', createOverlay);
    } else {
        // Small delay to ensure body exists
        setTimeout(createOverlay, 100);
    }

    // Re-inject if body changes (some SPAs rebuild the DOM)
    const observer = new MutationObserver((mutations) => {
        if (!document.getElementById('texa-overlay-header') && document.body) {
            createOverlay();
        }
    });

    observer.observe(document.documentElement, {
        childList: true,
        subtree: false
    });

})();
