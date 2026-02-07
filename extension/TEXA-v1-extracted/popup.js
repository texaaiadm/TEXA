// =============================================
// TEXA-Ai Manager - Extension Popup
// Full integration with Dashboard
// =============================================

const STORAGE_KEYS = {
    TEXA_ORIGIN: 'texa_origin',
    TEXA_TOKEN: 'texa_token',
    TEXA_USER: 'texa_user',
    LAST_SYNC: 'last_sync'
};

const DASHBOARD_URLS = {
    LOCAL: 'http://localhost:3000',
    NGROK: 'https://conscienceless-lieselotte-ethnohistoric.ngrok-free.dev',
    PRODUCTION: 'https://www.texa.studio'
};

function getDashboardUrl() {
    return window.__TEXA_DASHBOARD_ORIGIN || DASHBOARD_URLS.LOCAL;
}

class TEXAToolsManager {
    constructor() {
        this.origin = '';
        this.idToken = '';
        this.user = null;
        this.tools = [];
        this.isLoading = true;
        this.init();
    }

    async init() {
        try {
            await this.loadStoredData();

            // Trigger silent token scrape when popup opens (runs in background)
            chrome.runtime.sendMessage({ type: 'TEXA_SCRAPE_TOKEN' });

            if (this.user && this.idToken) {
                this.renderUserProfile();
                await this.loadTools();
            } else {
                this.renderLoginPrompt();
            }
        } catch (error) {
            console.error('Init error:', error);
            this.renderError('Gagal memuat extension. Silakan refresh.');
        }
    }

    async loadStoredData() {
        try {
            const result = await chrome.storage.local.get([
                STORAGE_KEYS.TEXA_ORIGIN,
                STORAGE_KEYS.TEXA_TOKEN,
                STORAGE_KEYS.TEXA_USER,
                STORAGE_KEYS.LAST_SYNC
            ]);

            this.origin = result[STORAGE_KEYS.TEXA_ORIGIN] || '';
            this.idToken = result[STORAGE_KEYS.TEXA_TOKEN] || '';
            this.user = result[STORAGE_KEYS.TEXA_USER] || null;
            this.lastSync = result[STORAGE_KEYS.LAST_SYNC] || null;
            window.__TEXA_DASHBOARD_ORIGIN = this.origin || '';

            console.log('Loaded user data:', this.user);
        } catch (error) {
            console.error('Error loading stored data:', error);
        }
    }

    // =============================================
    // RENDER FUNCTIONS
    // =============================================

    renderUserProfile() {
        const contentEl = document.getElementById('content');
        const user = this.user;

        if (!user) {
            this.renderLoginPrompt();
            return;
        }

        // Calculate subscription status
        const subStatus = this.getSubscriptionStatus();
        const avatarContent = user.photoURL
            ? `<img src="${this.escapeHtml(user.photoURL)}" alt="Avatar">`
            : this.getInitials(user.name || user.email);

        const roleClass = user.role === 'ADMIN' ? 'role-admin' : 'role-member';
        const subClass = subStatus.isActive ? 'sub-active' : 'sub-inactive';
        const dotClass = subStatus.isActive ? 'active' : 'inactive';

        contentEl.innerHTML = `
      <!-- Profile Card -->
      <div class="profile-card">
        <div class="profile-header">
          <div class="profile-avatar">${avatarContent}</div>
          <div class="profile-info">
            <div class="profile-name">${this.escapeHtml(user.name || 'Pengguna')}</div>
            <div class="profile-email">${this.escapeHtml(user.email || '')}</div>
          </div>
          <span class="profile-role ${roleClass}">${user.role || 'MEMBER'}</span>
        </div>
        
        <!-- Subscription Badge -->
        <div class="subscription-badge ${subClass}">
          <div class="sub-status">
            <span class="sub-dot ${dotClass}"></span>
            <span class="sub-label ${dotClass}">${subStatus.label}</span>
          </div>
          <span class="sub-expiry">${subStatus.expiry}</span>
        </div>
      </div>

      <!-- Quick Actions -->
      <div class="quick-actions">
        <button class="action-btn primary" id="btnDashboard">
          🏠 Dashboard
        </button>
        <button class="action-btn" id="btnProfile">
          👤 Profile
        </button>
        <button class="action-btn" id="btnRefresh">
          🔄 Refresh
        </button>
        <button class="action-btn danger" id="btnLogout">
          🚪 Logout
        </button>
      </div>

      <!-- Tools Section -->
      <div class="section-title">🧰 AI Tools</div>
      <div id="toolsContainer">
        <div class="loading">
          <div class="loading-spinner"></div>
          Memuat tools...
        </div>
      </div>
    `;

        // Attach event listeners
        document.getElementById('btnDashboard').addEventListener('click', () => {
            chrome.tabs.create({ url: getDashboardUrl() + '/#/' });
        });

        document.getElementById('btnProfile').addEventListener('click', () => {
            chrome.tabs.create({ url: getDashboardUrl() + '/#/profile' });
        });

        document.getElementById('btnRefresh').addEventListener('click', () => {
            location.reload();
        });

        document.getElementById('btnLogout').addEventListener('click', () => {
            this.handleLogout();
        });
    }

    renderLoginPrompt() {
        const contentEl = document.getElementById('content');
        const dashboardUrl = getDashboardUrl();

        contentEl.innerHTML = `
      <div class="login-section">
        <div class="login-icon">🔐</div>
        <div class="login-title">Belum Terhubung</div>
        <div class="login-desc">
          Login ke Dashboard TEXA untuk mengakses AI Tools premium dan sinkronisasi session Anda.
        </div>
        <button class="btn-login" id="btnLogin">
          🚀 Login ke Dashboard
        </button>
      </div>
    `;

        document.getElementById('btnLogin').addEventListener('click', () => {
            chrome.tabs.create({ url: dashboardUrl + '/#/login' });
        });
    }

    renderTools() {
        const container = document.getElementById('toolsContainer');

        if (!container) return;

        if (!this.tools.length) {
            container.innerHTML = `
        <div class="empty-state">
          ${this.getSubscriptionStatus().isActive
                    ? 'Tidak ada tools tersedia saat ini.'
                    : 'Berlangganan untuk mengakses AI Tools premium! 🚀'}
        </div>
      `;
            this.updateSubscriptionBadge();
            return;
        }

        const toolsHtml = this.tools.map(tool => `
      <div class="tool-item" data-tool-id="${tool.id}">
        <div class="tool-info">
          <div class="tool-name">${this.escapeHtml(tool.name || 'Unnamed Tool')}</div>
          <div class="tool-url">${this.escapeHtml(this.getDomain(tool.targetUrl))}</div>
        </div>
        <button class="btn-open" onclick="texaManager.openTool('${tool.id}')">
          🚀 Buka
        </button>
      </div>
    `).join('');

        container.innerHTML = `<div class="tools-list">${toolsHtml}</div>`;

        // Update badge with tools count
        this.updateSubscriptionBadge();
    }

    updateSubscriptionBadge() {
        const badge = document.querySelector('.subscription-badge');
        if (!badge) return;

        const toolsCount = this.tools.length;
        const isAdmin = this.user?.role === 'ADMIN';

        if (isAdmin) {
            badge.className = 'subscription-badge sub-active';
            badge.innerHTML = `
                <div class="sub-status">
                    <span class="sub-dot active"></span>
                    <span class="sub-label active">Admin Access</span>
                </div>
                <span class="sub-expiry">${toolsCount} Tools</span>
            `;
        } else if (toolsCount > 0) {
            badge.className = 'subscription-badge sub-active';
            badge.innerHTML = `
                <div class="sub-status">
                    <span class="sub-dot active"></span>
                    <span class="sub-label active">Aktif</span>
                </div>
                <span class="sub-expiry">${toolsCount} Tool${toolsCount > 1 ? 's' : ''}</span>
            `;
        } else {
            badge.className = 'subscription-badge sub-inactive';
            badge.innerHTML = `
                <div class="sub-status">
                    <span class="sub-dot inactive"></span>
                    <span class="sub-label inactive">Tidak Aktif</span>
                </div>
                <span class="sub-expiry">Belum ada tools</span>
            `;
        }
    }

    renderError(message) {
        const contentEl = document.getElementById('content');
        contentEl.innerHTML = `
      <div class="error-msg">
        ⚠️ ${this.escapeHtml(message)}
      </div>
    `;
    }

    // =============================================
    // DATA FUNCTIONS
    // =============================================

    getSubscriptionStatus() {
        if (!this.user) {
            return { isActive: false, label: 'Tidak Aktif', expiry: '' };
        }

        // Admin always has access
        if (this.user.role === 'ADMIN') {
            return { isActive: true, label: 'Admin Access', expiry: 'Unlimited' };
        }

        const subEnd = this.user.subscriptionEnd;

        if (!subEnd) {
            return { isActive: false, label: 'Tidak Aktif', expiry: 'Belum berlangganan' };
        }

        const endDate = new Date(subEnd);
        const now = new Date();
        const isActive = endDate > now;

        if (isActive) {
            const days = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));
            return {
                isActive: true,
                label: 'Aktif',
                expiry: days <= 7 ? `${days} hari lagi` : this.formatDate(endDate)
            };
        } else {
            return {
                isActive: false,
                label: 'Kadaluarsa',
                expiry: this.formatDate(endDate)
            };
        }
    }

    async loadTools() {
        const container = document.getElementById('toolsContainer');

        // Must have user ID to fetch their tools
        if (!this.user?.id) {
            if (container) {
                container.innerHTML = `
          <div class="empty-state">
            Silakan login terlebih dahulu untuk melihat tools Anda 🔐
          </div>
        `;
            }
            return;
        }

        try {
            // Determine API base URL based on origin
            let apiBaseUrl;
            if (this.origin && (this.origin.includes('localhost') || this.origin.includes('127.0.0.1'))) {
                // Local development - use admin server
                apiBaseUrl = 'http://127.0.0.1:8787';
            } else if (this.origin && this.origin.includes('ngrok')) {
                // Ngrok development - use ngrok origin (proxied to localhost by ngrok)
                apiBaseUrl = this.origin;
            } else if (this.origin && (this.origin.includes('texa.studio') || this.origin.includes('vercel.app'))) {
                // Production - use the origin (Vercel handles API routes via serverless functions)
                apiBaseUrl = this.origin;
            } else {
                // Fallback to ngrok for dev or production
                apiBaseUrl = DASHBOARD_URLS.NGROK;
            }
            console.log('[TEXA Popup] Origin:', this.origin);
            console.log('[TEXA Popup] Using API base URL:', apiBaseUrl);

            // 1. Fetch user's purchased tools
            const userToolsResponse = await fetch(`${apiBaseUrl}/api/public/user-tools?userId=${this.user.id}`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            let userToolIds = [];
            if (userToolsResponse.ok) {
                const userToolsData = await userToolsResponse.json();
                // Get list of tool IDs user has access to
                userToolIds = (userToolsData.data || []).map(ut => ut.tool_id);
                console.log('[TEXA Popup] User has access to', userToolIds.length, 'tools');
            }

            // 2. Fetch full catalog to get tool details
            const catalogResponse = await fetch(`${apiBaseUrl}/api/catalog`, {
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (catalogResponse.ok) {
                const catalogData = await catalogResponse.json();
                const allTools = catalogData?.tools || catalogData || [];
                console.log('[TEXA Popup] Catalog returned', allTools.length, 'tools');

                // Helper function to check if tool is active
                const isToolActive = (t) => t.status === 'active' || t.is_active === true || t.isActive === true;

                // Admin has access to all tools
                if (this.user.role === 'ADMIN') {
                    this.tools = Array.isArray(allTools) ? allTools.filter(isToolActive) : [];
                    // If no tools after filter, show all (possibly different data format)
                    if (this.tools.length === 0 && allTools.length > 0) {
                        console.log('[TEXA Popup] ADMIN: No active filter match, showing all tools');
                        this.tools = allTools;
                    }
                } else {
                    // Filter tools to only those user has purchased
                    this.tools = Array.isArray(allTools)
                        ? allTools.filter(t => userToolIds.includes(t.id) && isToolActive(t))
                        : [];
                }
                console.log('[TEXA Popup] Filtered tools:', this.tools.length);
            }

            // 3. Render tools or show subscription prompt
            if (this.tools.length === 0 && this.user.role !== 'ADMIN') {
                if (container) {
                    container.innerHTML = `
            <div class="empty-state">
              <div style="font-size: 32px; margin-bottom: 12px;">🧰</div>
              <div style="margin-bottom: 12px; font-weight: 600;">Belum Ada AI Tools</div>
              <div style="color: var(--text-muted); font-size: 11px; margin-bottom: 16px;">
                Beli tools AI premium di dashboard untuk mulai menggunakan!
              </div>
              <button class="btn-open" onclick="texaManager.openSubscription()" style="padding: 10px 24px; font-size: 12px;">
                🛒 Lihat Katalog
              </button>
            </div>
          `;
                }
                return;
            }

            this.renderTools();
        } catch (error) {
            console.error('Error loading tools:', error);
            if (container) {
                container.innerHTML = `
          <div class="error-msg">
            Gagal memuat tools. Pastikan terhubung ke internet.
          </div>
        `;
            }
        }
    }

    // =============================================
    // ACTION HANDLERS
    // =============================================

    async openTool(toolId) {
        try {
            const tool = this.tools.find(t => t.id === toolId);
            if (!tool) throw new Error('Tool not found');

            const btn = document.querySelector(`[data-tool-id="${toolId}"] .btn-open`);
            if (btn) {
                btn.textContent = '...';
                btn.disabled = true;
            }

            const apiUrl = tool.apiUrl || tool.accessUrl || `${this.origin}/api/tools/${toolId}/access`;

            const message = {
                type: 'TEXA_OPEN_TOOL',
                origin: this.origin,
                toolId: toolId,
                targetUrl: tool.targetUrl,
                apiUrl: apiUrl,
                authHeader: `Bearer ${this.idToken}`
            };

            const response = await chrome.runtime.sendMessage(message);

            if (response?.success) {
                if (btn) btn.textContent = '✓';
                setTimeout(() => window.close(), 500);
            } else {
                throw new Error(response?.error || 'Failed to open tool');
            }
        } catch (error) {
            console.error('Error opening tool:', error);
            alert('Gagal membuka tool: ' + error.message);

            const btn = document.querySelector(`[data-tool-id="${toolId}"] .btn-open`);
            if (btn) {
                btn.textContent = 'Buka';
                btn.disabled = false;
            }
        }
    }

    openSubscription() {
        chrome.tabs.create({ url: getDashboardUrl() + '/#/' });
    }

    async handleLogout() {
        try {
            await chrome.storage.local.remove([
                STORAGE_KEYS.TEXA_ORIGIN,
                STORAGE_KEYS.TEXA_TOKEN,
                STORAGE_KEYS.TEXA_USER,
                STORAGE_KEYS.LAST_SYNC
            ]);

            this.user = null;
            this.idToken = '';
            this.origin = '';
            this.tools = [];

            this.renderLoginPrompt();
        } catch (error) {
            console.error('Logout error:', error);
        }
    }

    // =============================================
    // TOKEN VAULT FUNCTIONS
    // =============================================

    async handleScrapeToken() {
        const statusEl = document.getElementById('tokenStatus');
        const btn = document.getElementById('btnScrapeToken');

        try {
            btn.disabled = true;
            btn.textContent = '⏳ Scraping...';
            statusEl.textContent = 'Membuka Google Labs dan mencari token...';
            statusEl.className = 'token-status loading';

            const response = await chrome.runtime.sendMessage({ type: 'TEXA_SCRAPE_TOKEN' });

            if (response.success && response.token) {
                this.updateTokenDisplay(response.token);
                statusEl.textContent = '✅ Token berhasil ditemukan dan disimpan!';
                statusEl.className = 'token-status success';
            } else {
                statusEl.textContent = '❌ ' + (response.error || 'Token tidak ditemukan');
                statusEl.className = 'token-status error';
            }
        } catch (error) {
            console.error('Scrape error:', error);
            statusEl.textContent = '❌ Error: ' + error.message;
            statusEl.className = 'token-status error';
        } finally {
            btn.disabled = false;
            btn.textContent = '🔄 Scrape Token';
        }
    }

    async handleLoadToken() {
        const statusEl = document.getElementById('tokenStatus');

        try {
            statusEl.textContent = 'Memuat token dari Supabase...';
            statusEl.className = 'token-status loading';

            const response = await chrome.runtime.sendMessage({ type: 'TEXA_GET_TOKEN' });

            if (response.success && response.token) {
                this.updateTokenDisplay(response.token);
                const cacheLabel = response.fromCache ? ' (dari cache)' : '';
                const timeAgo = response.updatedAt ? this.formatTimeAgo(response.updatedAt) : '';
                statusEl.textContent = `✅ Token dimuat${cacheLabel}${timeAgo ? ' - ' + timeAgo : ''}`;
                statusEl.className = 'token-status success';
            } else {
                statusEl.textContent = 'Token belum tersedia. Klik "Scrape Token" untuk mengambil.';
                statusEl.className = 'token-status';
            }
        } catch (error) {
            console.error('Load token error:', error);
            statusEl.textContent = 'Gagal memuat token. Coba "Scrape Token".';
            statusEl.className = 'token-status error';
        }
    }

    handleCopyToken() {
        const tokenValue = document.getElementById('tokenValue');
        const btn = document.getElementById('btnCopyToken');

        if (tokenValue && tokenValue.dataset.fullToken) {
            navigator.clipboard.writeText(tokenValue.dataset.fullToken)
                .then(() => {
                    btn.textContent = '✅ Copied!';
                    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
                })
                .catch(err => {
                    console.error('Copy failed:', err);
                    btn.textContent = '❌ Failed';
                    setTimeout(() => { btn.textContent = '📋 Copy'; }, 2000);
                });
        }
    }

    updateTokenDisplay(token) {
        const displayEl = document.getElementById('tokenDisplay');
        const valueEl = document.getElementById('tokenValue');

        if (displayEl && valueEl) {
            displayEl.classList.remove('hidden');
            valueEl.textContent = token.substring(0, 30) + '...' + token.substring(token.length - 20);
            valueEl.dataset.fullToken = token;
        }
    }

    formatTimeAgo(dateStr) {
        const date = new Date(dateStr);
        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'baru saja';
        if (diffMins < 60) return `${diffMins} menit lalu`;
        if (diffHours < 24) return `${diffHours} jam lalu`;
        return this.formatDate(date);
    }

    // =============================================
    // UTILITY FUNCTIONS
    // =============================================

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    getInitials(name) {
        if (!name) return '?';
        const parts = name.trim().split(' ');
        if (parts.length >= 2) {
            return (parts[0][0] + parts[1][0]).toUpperCase();
        }
        return name.substring(0, 2).toUpperCase();
    }

    getDomain(url) {
        if (!url) return '';
        try {
            return new URL(url).hostname;
        } catch {
            return url;
        }
    }

    formatDate(date) {
        return new Date(date).toLocaleDateString('id-ID', {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
        });
    }
}

// Initialize
const texaManager = new TEXAToolsManager();
window.texaManager = texaManager;
