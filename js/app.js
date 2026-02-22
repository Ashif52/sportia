/**
 * App — Main Application Bootstrapper
 * Initializes state, events, modules, and handles navigation.
 * Manages role-based UI visibility, global modals, toasts, and confirms.
 */
const App = (() => {
    'use strict';

    /* ─── Role-based Navigation Map ─── */
    const ROLE_NAV_MAP = {
        SuperAdmin: ['dashboard', 'teams', 'players', 'auction', 'spinwheel', 'pastleagues', 'reports'],
        Auctioneer: ['dashboard', 'teams', 'players', 'auction', 'spinwheel', 'pastleagues', 'reports'],
        TeamOwner: ['dashboard'],
    };

    const NAV_META = {
        dashboard: { icon: '📊', label: 'Dashboard' },
        teams: { icon: '👥', label: 'Teams' },
        players: { icon: '🏏', label: 'Players' },
        auction: { icon: '⚡', label: 'Live Auction' },
        spinwheel: { icon: '🎯', label: 'Spin Wheel' },
        pastleagues: { icon: '🏆', label: 'Past Leagues' },
        reports: { icon: '📋', label: 'Reports' },
    };

    let _modules = {};
    let _confirmResolve = null;
    let _activeModule = 'dashboard';

    /* ═══════════════════════════════════════════════════════
       INITIALIZATION
       ═══════════════════════════════════════════════════════ */
    function init() {
        // 1. Initialize state
        AppState.init();

        // 2. Register modules
        _modules = {
            dashboard: typeof DashboardModule !== 'undefined' ? DashboardModule : null,
            teams: typeof TeamsModule !== 'undefined' ? TeamsModule : null,
            players: typeof PlayersModule !== 'undefined' ? PlayersModule : null,
            auction: typeof AuctionModule !== 'undefined' ? AuctionModule : null,
            spinwheel: typeof SpinWheelModule !== 'undefined' ? SpinWheelModule : null,
            pastleagues: typeof PastLeaguesModule !== 'undefined' ? PastLeaguesModule : null,
            reports: typeof ReportsModule !== 'undefined' ? ReportsModule : null,
        };

        // 3. Bind global events
        _bindGlobalEvents();

        // 4. Check auth
        if (Auth.isAuthenticated()) {
            _showApp();
        } else {
            _showLogin();
        }
    }

    /* ═══════════════════════════════════════════════════════
       AUTH / PAGE SWITCHING
       ═══════════════════════════════════════════════════════ */
    function _showLogin() {
        document.getElementById('login-page').style.display = '';
        document.getElementById('app-layout').style.display = 'none';
        _initLoginPage();
    }

    function _showApp() {
        document.getElementById('login-page').style.display = 'none';
        document.getElementById('app-layout').style.display = 'flex';
        _buildNavigation();
        _initModules();
        _updateRoleUI();
        _updateTournamentStatus();
        _navigateTo('dashboard');
    }

    function _initLoginPage() {
        const form = document.getElementById('login-form');
        const roleGrid = document.getElementById('login-role-grid');
        const passwordGroup = document.getElementById('login-password-group');
        const passwordInput = document.getElementById('login-password');
        const errorEl = document.getElementById('login-error');
        const togglePw = document.getElementById('toggle-password');

        let selectedRole = 'SuperAdmin';

        // Role button click
        roleGrid.addEventListener('click', (e) => {
            const btn = e.target.closest('.login-role-btn');
            if (!btn) return;

            roleGrid.querySelectorAll('.login-role-btn').forEach(b => b.classList.remove('active'));
            btn.classList.add('active');
            selectedRole = btn.dataset.role;
            errorEl.textContent = '';

            // Show/hide password
            if (Auth.requiresPassword(selectedRole)) {
                passwordGroup.style.display = '';
                passwordGroup.classList.add('login-form__group--visible');
            } else {
                passwordGroup.style.display = 'none';
                passwordGroup.classList.remove('login-form__group--visible');
            }
        });

        // Toggle password visibility
        togglePw.addEventListener('click', () => {
            const isPassword = passwordInput.type === 'password';
            passwordInput.type = isPassword ? 'text' : 'password';
            togglePw.textContent = isPassword ? '🙈' : '👁️';
        });

        // Submit
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            errorEl.textContent = '';

            const result = Auth.login(selectedRole, passwordInput.value);
            if (result.success) {
                passwordInput.value = '';
                _showApp();
            } else {
                errorEl.textContent = result.error;
                errorEl.classList.add('shake');
                setTimeout(() => errorEl.classList.remove('shake'), 500);
            }
        });
    }

    /* ═══════════════════════════════════════════════════════
       NAVIGATION
       ═══════════════════════════════════════════════════════ */
    function _buildNavigation() {
        const nav = document.getElementById('sidebar-nav');
        const role = Auth.getCurrentRole();
        const tabs = ROLE_NAV_MAP[role] || ROLE_NAV_MAP.SuperAdmin;

        nav.innerHTML = tabs.map(key => {
            const meta = NAV_META[key];
            const isLive = key === 'auction' ? ' <span class="nav-item__badge" id="nav-live-badge" style="display:none;">LIVE</span>' : '';
            return `
                <div class="nav-item" data-module="${key}" id="nav-item-${key}">
                    <span class="nav-item__icon">${meta.icon}</span>
                    <span class="nav-item__label">${meta.label}</span>
                    ${isLive}
                </div>
            `;
        }).join('');

        // Click handling
        nav.addEventListener('click', (e) => {
            const item = e.target.closest('.nav-item');
            if (!item) return;
            _navigateTo(item.dataset.module);

            // Close mobile sidebar
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');
        });

        // Update user info section
        _updateSidebarUserInfo();
    }

    function _updateSidebarUserInfo() {
        const infoEl = document.getElementById('sidebar-user-info');
        const role = Auth.getCurrentRole();
        const roleBadge = Auth.isControlRole() ? '🛡️ Control' : '👁️ View Only';
        infoEl.innerHTML = `
            <div class="sidebar__role-label">Logged in as</div>
            <div class="sidebar__current-role">
                <span class="sidebar__role-badge">${roleBadge}</span>
                <span class="sidebar__role-name">${role}</span>
            </div>
        `;

        // Team selector for TeamOwner
        const teamWrap = document.getElementById('team-select-wrap');
        if (role === 'TeamOwner') {
            teamWrap.style.display = '';
            const select = document.getElementById('team-selector');
            const teams = AppState.getState().teams;
            select.innerHTML = '<option value="">— Select Team —</option>' +
                teams.map(t => `<option value="${t.id}">${t.name}</option>`).join('');
        } else {
            teamWrap.style.display = 'none';
        }
    }

    function _navigateTo(moduleKey) {
        _activeModule = moduleKey;

        // Update nav active state
        document.querySelectorAll('.nav-item').forEach(el => {
            el.classList.toggle('active', el.dataset.module === moduleKey);
        });

        // Show/hide modules
        document.querySelectorAll('.module-section').forEach(el => {
            el.classList.toggle('active', el.id === `module-${moduleKey}`);
        });

        // Update header title
        const meta = NAV_META[moduleKey];
        document.getElementById('header-title').textContent = `${meta.icon} ${meta.label}`;

        // Trigger render on the module
        if (_modules[moduleKey] && typeof _modules[moduleKey].render === 'function') {
            _modules[moduleKey].render();
        }

        EventBus.emit(Events.NAV_CHANGE, { module: moduleKey });
    }

    /* ═══════════════════════════════════════════════════════
       MODULE INITIALIZATION
       ═══════════════════════════════════════════════════════ */
    function _initModules() {
        Object.entries(_modules).forEach(([key, mod]) => {
            if (mod && typeof mod.init === 'function') {
                const container = document.getElementById(`module-${key}`);
                if (container) {
                    mod.init(container);
                }
            }
        });
    }

    /* ═══════════════════════════════════════════════════════
       ROLE-BASED UI
       ═══════════════════════════════════════════════════════ */
    function _updateRoleUI() {
        const isControl = Auth.isControlRole();

        // Show/hide control-only elements
        document.querySelectorAll('.control-only').forEach(el => {
            el.style.display = isControl ? '' : 'none';
        });

        // Show/hide view-only elements
        document.querySelectorAll('.view-only').forEach(el => {
            el.style.display = isControl ? 'none' : '';
        });

        // Disable bidding buttons for view-only
        document.querySelectorAll('.bid-action').forEach(el => {
            el.disabled = !isControl;
        });

        // Update live badge
        _updateLiveBadge();
    }

    function _updateLiveBadge() {
        const badge = document.getElementById('nav-live-badge');
        if (!badge) return;
        const auctionStatus = AppState.getState().auction?.status;
        badge.style.display = (auctionStatus === 'running' || auctionStatus === 'paused') ? '' : 'none';
    }

    /* ═══════════════════════════════════════════════════════
       TOURNAMENT STATUS
       ═══════════════════════════════════════════════════════ */
    function _updateTournamentStatus() {
        const state = AppState.getState();
        const badge = document.getElementById('tournament-status');
        const status = state.tournament.status;

        badge.className = `header__status-badge ${status}`;
        const labels = { draft: 'DRAFT', live: 'LIVE', completed: 'COMPLETED' };
        badge.innerHTML = `<span class="header__status-dot"></span> ${labels[status] || status.toUpperCase()}`;
    }

    /* ═══════════════════════════════════════════════════════
       GLOBAL EVENTS
       ═══════════════════════════════════════════════════════ */
    function _bindGlobalEvents() {
        // Logout
        document.getElementById('btn-logout')?.addEventListener('click', () => {
            Auth.logout();
            _showLogin();
        });

        // Reset data
        document.getElementById('btn-reset-data')?.addEventListener('click', async () => {
            const confirmed = await showConfirm('This will reset ALL auction data. Continue?');
            if (confirmed) {
                AppState.resetAll();
                _showApp();
                showToast('All data has been reset.', 'success');
            }
        });

        // Mobile sidebar toggle
        document.getElementById('menu-toggle')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.toggle('open');
            document.getElementById('sidebar-overlay').classList.toggle('active');
        });

        document.getElementById('sidebar-overlay')?.addEventListener('click', () => {
            document.getElementById('sidebar').classList.remove('open');
            document.getElementById('sidebar-overlay').classList.remove('active');
        });

        // Modal close
        document.getElementById('modal-close')?.addEventListener('click', closeModal);
        document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
            if (e.target === e.currentTarget) closeModal();
        });

        // Confirm dialog
        document.getElementById('confirm-cancel')?.addEventListener('click', () => _resolveConfirm(false));
        document.getElementById('confirm-ok')?.addEventListener('click', () => _resolveConfirm(true));

        // State change listeners
        EventBus.subscribe(Events.STATE_CHANGED, () => {
            _updateRoleUI();
            _updateTournamentStatus();
            _updateLiveBadge();
        });

        EventBus.subscribe(Events.STATE_RESET, () => {
            _updateRoleUI();
            _updateTournamentStatus();
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeModal();
                _resolveConfirm(false);
            }
        });
    }

    /* ═══════════════════════════════════════════════════════
       MODAL SYSTEM
       ═══════════════════════════════════════════════════════ */
    function openModal(title, bodyHTML, footerHTML) {
        document.getElementById('modal-title').textContent = title;
        document.getElementById('modal-body').innerHTML = bodyHTML || '';
        document.getElementById('modal-footer').innerHTML = footerHTML || '';
        document.getElementById('modal-overlay').classList.add('active');
    }

    function closeModal() {
        document.getElementById('modal-overlay').classList.remove('active');
    }

    /* ═══════════════════════════════════════════════════════
       TOAST SYSTEM
       ═══════════════════════════════════════════════════════ */
    function showToast(message, type = 'info', duration = 3500) {
        const container = document.getElementById('toast-container');
        const icons = {
            success: '✅', error: '❌', warning: '⚠️', info: 'ℹ️', bid: '⚡',
        };

        const toast = document.createElement('div');
        toast.className = `toast toast--${type}`;
        toast.innerHTML = `
            <span class="toast__icon">${icons[type] || 'ℹ️'}</span>
            <span>${message}</span>
        `;

        container.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('removing');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }

    /* ═══════════════════════════════════════════════════════
       CONFIRM DIALOG
       ═══════════════════════════════════════════════════════ */
    function showConfirm(message, icon = '⚠️') {
        document.getElementById('confirm-message').textContent = message;
        document.getElementById('confirm-icon').textContent = icon;
        document.getElementById('confirm-overlay').classList.add('active');

        return new Promise(resolve => {
            _confirmResolve = resolve;
        });
    }

    function _resolveConfirm(result) {
        document.getElementById('confirm-overlay').classList.remove('active');
        if (_confirmResolve) {
            _confirmResolve(result);
            _confirmResolve = null;
        }
    }

    /* ═══════════════════════════════════════════════════════
       UTILITY — Currency Formatting
       ═══════════════════════════════════════════════════════ */
    function formatCurrency(amount) {
        return '₹' + Number(amount).toLocaleString('en-IN');
    }

    function formatCurrencyShort(amount) {
        if (amount >= 100000) return '₹' + (amount / 100000).toFixed(1) + 'L';
        if (amount >= 1000) return '₹' + (amount / 1000).toFixed(1) + 'K';
        return '₹' + amount;
    }

    /* ═══════════════════════════════════════════════════════
       BOOT
       ═══════════════════════════════════════════════════════ */
    document.addEventListener('DOMContentLoaded', init);

    return {
        openModal,
        closeModal,
        showToast,
        showConfirm,
        formatCurrency,
        formatCurrencyShort,
        navigateTo: _navigateTo,
    };
})();
