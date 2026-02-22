/**
 * Dashboard Module
 * Unified Command Center: summary counters, team overview cards with live purse,
 * category breakdown, and activity feed.
 * All values are derived live from AppState — zero stale data.
 */
const DashboardModule = (() => {
    'use strict';

    let _container = null;

    function init(container) {
        _container = container;
        EventBus.subscribe(Events.STATE_CHANGED, _softRefresh);
        EventBus.subscribe(Events.STATE_RESET, render);
        EventBus.subscribe(Events.LOG_ADDED, _renderActivityFeed);
    }

    function render() {
        if (!_container) return;
        const state = AppState.getState();
        const players = state.players;
        const teams = state.teams;
        const isControl = Auth.isControlRole();

        const sold = players.filter(p => p.status === 'sold');
        const unsold = players.filter(p => p.status === 'unsold');
        const available = players.filter(p => p.status === 'available');
        const totalSpent = sold.reduce((s, p) => s + p.soldPrice, 0);

        const categories = {};
        players.forEach(p => {
            if (!categories[p.category]) categories[p.category] = { total: 0, sold: 0, unsold: 0, available: 0 };
            categories[p.category].total++;
            categories[p.category][p.status]++;
        });

        _container.innerHTML = `
            <!-- Hero Banner -->
            <div class="dash-hero">
                <div class="dash-hero__content">
                    <h2 class="dash-hero__title">${state.tournament.name}</h2>
                    <p class="dash-hero__subtitle">Live Auction Command Center</p>
                    <div class="dash-hero__meta">
                        <span class="badge badge--${state.tournament.status === 'live' ? 'sold' : 'available'}">${state.tournament.status.toUpperCase()}</span>
                        <span class="text-muted" style="font-size:0.82rem;">${teams.length} Teams · ${players.length} Players</span>
                    </div>
                </div>
                ${isControl ? `
                <div class="dash-hero__actions control-only">
                    <button class="btn btn--sm btn--primary" id="dash-start-tournament" ${state.tournament.status === 'live' ? 'disabled' : ''}>
                        ${state.tournament.status === 'draft' ? '🚀 Start Tournament' : '✅ Tournament Active'}
                    </button>
                </div>
                ` : ''}
            </div>

            <!-- Stats Row -->
            <div class="dash-stats">
                <div class="dash-stat-card">
                    <div class="dash-stat-card__icon" style="background:var(--c-primary-light);color:var(--c-primary);">🏏</div>
                    <div class="dash-stat-card__info">
                        <div class="dash-stat-card__value">${players.length}</div>
                        <div class="dash-stat-card__label">Total Players</div>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-card__icon" style="background:var(--c-success-light);color:var(--c-success);">✅</div>
                    <div class="dash-stat-card__info">
                        <div class="dash-stat-card__value">${sold.length}</div>
                        <div class="dash-stat-card__label">Sold</div>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-card__icon" style="background:var(--c-danger-light);color:var(--c-danger);">❌</div>
                    <div class="dash-stat-card__info">
                        <div class="dash-stat-card__value">${unsold.length}</div>
                        <div class="dash-stat-card__label">Unsold</div>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-card__icon" style="background:var(--c-warning-light);color:var(--c-warning);">⏳</div>
                    <div class="dash-stat-card__info">
                        <div class="dash-stat-card__value">${available.length}</div>
                        <div class="dash-stat-card__label">Remaining</div>
                    </div>
                </div>
                <div class="dash-stat-card">
                    <div class="dash-stat-card__icon" style="background:rgba(99,102,241,0.1);color:#6366f1;">💰</div>
                    <div class="dash-stat-card__info">
                        <div class="dash-stat-card__value">${App.formatCurrencyShort(totalSpent)}</div>
                        <div class="dash-stat-card__label">Total Spent</div>
                    </div>
                </div>
            </div>

            <!-- Dashboard Grid -->
            <div class="dash-grid">
                <!-- Teams Overview -->
                <div class="dash-section">
                    <div class="dash-section__header">
                        <h3 class="dash-section__title">👥 Teams Overview</h3>
                    </div>
                    <div class="dash-teams-grid" id="dash-teams-grid">
                        ${teams.map(team => _renderTeamMiniCard(team, state)).join('')}
                    </div>
                </div>

                <!-- Right Column -->
                <div class="dash-section">
                    <!-- Category Breakdown -->
                    <div class="dash-section__header">
                        <h3 class="dash-section__title">📊 Category Breakdown</h3>
                    </div>
                    <div class="dash-categories" id="dash-categories">
                        ${Object.entries(categories).map(([cat, data]) => `
                            <div class="dash-category-row">
                                <span class="badge badge--cat-${cat.toLowerCase().replace('-', '')}">${cat}</span>
                                <div class="dash-category-bar-wrap">
                                    <div class="dash-category-bar">
                                        <div class="dash-category-bar__sold" style="width:${(data.sold / data.total) * 100}%"></div>
                                        <div class="dash-category-bar__unsold" style="width:${(data.unsold / data.total) * 100}%"></div>
                                    </div>
                                </div>
                                <span class="dash-category-count">${data.sold}/${data.total}</span>
                            </div>
                        `).join('')}
                    </div>

                    <!-- Activity Feed -->
                    <div class="dash-section__header" style="margin-top: var(--sp-lg);">
                        <h3 class="dash-section__title">📜 Activity Feed</h3>
                    </div>
                    <div class="dash-activity-feed" id="dash-activity-feed">
                        ${_renderActivityLogs(state.activityLogs)}
                    </div>
                </div>
            </div>
        `;

        _bindEvents();
    }

    function _renderTeamMiniCard(team, state) {
        const players = state.players.filter(p => p.soldTo === team.id);
        const spent = players.reduce((s, p) => s + p.soldPrice, 0);
        const remaining = team.purse - spent;
        const pursePercent = ((team.purse - remaining) / team.purse) * 100;

        return `
            <div class="dash-team-card glass-card" style="border-top: 3px solid ${team.color};">
                <div class="dash-team-card__header">
                    <div class="dash-team-card__avatar" style="background:${team.color};">${team.short}</div>
                    <div class="dash-team-card__info">
                        <div class="dash-team-card__name">${team.name}</div>
                        <div class="dash-team-card__players">${players.length}/${team.maxPlayers} players</div>
                    </div>
                </div>
                <div class="dash-team-card__purse">
                    <div class="dash-team-card__purse-label">
                        <span>Remaining Purse</span>
                        <span class="font-mono" style="color:${remaining < team.purse * 0.2 ? 'var(--c-danger)' : 'var(--c-success)'};">${App.formatCurrency(remaining)}</span>
                    </div>
                    <div class="progress-bar">
                        <div class="progress-bar__fill${pursePercent > 80 ? ' progress-bar__fill--danger' : pursePercent > 50 ? ' progress-bar__fill--warning' : ''}" style="width:${pursePercent}%;background:${team.color};"></div>
                    </div>
                    <div class="dash-team-card__spent text-muted">Spent: ${App.formatCurrency(spent)}</div>
                </div>
            </div>
        `;
    }

    function _renderActivityLogs(logs) {
        if (!logs || logs.length === 0) {
            return '<div class="empty-state" style="padding:var(--sp-lg);"><span class="empty-state__icon">📜</span><span class="empty-state__title">No activity yet</span></div>';
        }
        return logs.slice(0, 20).map(log => `
            <div class="dash-activity-item">
                <span class="dash-activity-item__icon">${log.icon || '📋'}</span>
                <div class="dash-activity-item__content">
                    <span class="dash-activity-item__message">${log.message}</span>
                    <span class="dash-activity-item__time">${_timeAgo(log.timestamp)}</span>
                </div>
            </div>
        `).join('');
    }

    function _bindEvents() {
        const startBtn = document.getElementById('dash-start-tournament');
        if (startBtn) {
            startBtn.addEventListener('click', () => {
                AppState.update({ tournament: { ...AppState.getState().tournament, status: 'live' } });
                AppState.addLog({ type: 'tournament', message: 'Tournament started!', icon: '🚀' });
                App.showToast('Tournament is now LIVE!', 'success');
                render();
            });
        }
    }

    function _softRefresh() {
        // Only re-render the dynamic parts
        if (!_container) return;
        const state = AppState.getState();

        // Update stats
        const sold = state.players.filter(p => p.status === 'sold');
        const unsold = state.players.filter(p => p.status === 'unsold');
        const available = state.players.filter(p => p.status === 'available');

        const statValues = _container.querySelectorAll('.dash-stat-card__value');
        if (statValues.length >= 5) {
            statValues[0].textContent = state.players.length;
            statValues[1].textContent = sold.length;
            statValues[2].textContent = unsold.length;
            statValues[3].textContent = available.length;
            statValues[4].textContent = App.formatCurrencyShort(sold.reduce((s, p) => s + p.soldPrice, 0));
        }

        // Update team cards
        const teamsGrid = document.getElementById('dash-teams-grid');
        if (teamsGrid) {
            teamsGrid.innerHTML = state.teams.map(t => _renderTeamMiniCard(t, state)).join('');
        }
    }

    function _renderActivityFeed() {
        const feedEl = document.getElementById('dash-activity-feed');
        if (feedEl) {
            feedEl.innerHTML = _renderActivityLogs(AppState.getState().activityLogs);
        }
    }

    function _timeAgo(isoString) {
        if (!isoString) return '';
        const diff = Date.now() - new Date(isoString).getTime();
        const secs = Math.floor(diff / 1000);
        if (secs < 60) return 'just now';
        const mins = Math.floor(secs / 60);
        if (mins < 60) return `${mins}m ago`;
        const hrs = Math.floor(mins / 60);
        if (hrs < 24) return `${hrs}h ago`;
        return `${Math.floor(hrs / 24)}d ago`;
    }

    return { init, render };
})();
