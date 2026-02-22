/**
 * Teams Module
 * Responsive card grid with purse tracking, animated progress bars,
 * player counts, and modal-based team editing.
 */
const TeamsModule = (() => {
    'use strict';

    let _container = null;

    function init(container) {
        _container = container;
        EventBus.subscribe(Events.STATE_CHANGED, render);
        EventBus.subscribe(Events.STATE_RESET, render);
    }

    function render() {
        if (!_container) return;
        const state = AppState.getState();
        const isControl = Auth.isControlRole();

        _container.innerHTML = `
            <div class="teams-toolbar">
                <div class="teams-toolbar__info">
                    <span class="text-secondary" style="font-size:0.88rem;">${state.teams.length} Teams Registered</span>
                </div>
                ${isControl ? `
                <div class="teams-toolbar__actions control-only">
                    <button class="btn btn--sm btn--primary" id="btn-add-team">
                        <span class="btn__icon">＋</span> Add Team
                    </button>
                </div>
                ` : ''}
            </div>

            <div class="teams-grid">
                ${state.teams.map(team => _renderTeamCard(team, state)).join('')}
            </div>
        `;

        _bindEvents();
    }

    function _renderTeamCard(team, state) {
        const players = state.players.filter(p => p.soldTo === team.id);
        const spent = players.reduce((s, p) => s + p.soldPrice, 0);
        const remaining = team.purse - spent;
        const pursePercent = ((team.purse - remaining) / team.purse) * 100;
        const isControl = Auth.isControlRole();

        const catBreakdown = {};
        players.forEach(p => {
            catBreakdown[p.category] = (catBreakdown[p.category] || 0) + 1;
        });

        return `
            <div class="team-card glass-card" data-team-id="${team.id}">
                <div class="team-card__header" style="border-color: ${team.color};">
                    <div class="team-card__avatar" style="background: ${team.color};">
                        ${team.short}
                    </div>
                    <div class="team-card__title-area">
                        <h3 class="team-card__name">${team.name}</h3>
                        <span class="team-card__code">${team.short}</span>
                    </div>
                    ${isControl ? `
                    <button class="btn btn--sm btn--ghost team-card__edit control-only" data-edit-team="${team.id}" title="Edit team">
                        ✏️
                    </button>
                    ` : ''}
                </div>

                <div class="team-card__body">
                    <!-- Purse Section -->
                    <div class="team-card__purse-section">
                        <div class="team-card__purse-row">
                            <span class="team-card__purse-label">Remaining</span>
                            <span class="team-card__purse-value font-mono" style="color:${remaining < team.purse * 0.2 ? 'var(--c-danger)' : 'var(--c-text)'};">
                                ${App.formatCurrency(remaining)}
                            </span>
                        </div>
                        <div class="progress-bar" style="margin: 6px 0;">
                            <div class="progress-bar__fill${pursePercent > 80 ? ' progress-bar__fill--danger' : pursePercent > 50 ? ' progress-bar__fill--warning' : ''}" 
                                 style="width:${pursePercent}%;background:${team.color};"></div>
                        </div>
                        <div class="team-card__purse-row" style="font-size: 0.75rem;">
                            <span class="text-muted">Spent: ${App.formatCurrency(spent)}</span>
                            <span class="text-muted">Total: ${App.formatCurrency(team.purse)}</span>
                        </div>
                    </div>

                    <!-- Player Count -->
                    <div class="team-card__players-row">
                        <span>Players: <strong>${players.length}</strong>/${team.maxPlayers}</span>
                        ${Object.entries(catBreakdown).map(([cat, n]) =>
            `<span class="badge badge--cat-${cat.toLowerCase().replace('-', '')}" style="font-size:0.65rem;">${cat}: ${n}</span>`
        ).join('')}
                    </div>

                    <!-- Acquired Players -->
                    ${players.length > 0 ? `
                    <div class="team-card__player-list">
                        ${players.slice(0, 5).map(p => `
                            <div class="team-card__player-item">
                                <span class="team-card__player-name">${p.name}</span>
                                <span class="team-card__player-price font-mono">${App.formatCurrency(p.soldPrice)}</span>
                            </div>
                        `).join('')}
                        ${players.length > 5 ? `<div class="text-muted" style="font-size:0.75rem;text-align:center;padding:4px;">+${players.length - 5} more</div>` : ''}
                    </div>
                    ` : `
                    <div class="team-card__empty text-muted" style="font-size:0.82rem;text-align:center;padding:var(--sp-md) 0;">
                        No players acquired yet
                    </div>
                    `}
                </div>
            </div>
        `;
    }

    function _bindEvents() {
        if (!_container) return;

        // Edit team buttons
        _container.querySelectorAll('[data-edit-team]').forEach(btn => {
            btn.addEventListener('click', () => {
                const teamId = btn.dataset.editTeam;
                _openEditModal(teamId);
            });
        });

        // Add team button
        const addBtn = document.getElementById('btn-add-team');
        if (addBtn) {
            addBtn.addEventListener('click', _openAddModal);
        }
    }

    function _openEditModal(teamId) {
        const team = AppState.getTeamById(teamId);
        if (!team) return;

        const body = `
            <div class="form-group">
                <label class="form-label">Team Name</label>
                <input class="form-input" id="edit-team-name" value="${team.name}" />
            </div>
            <div class="form-group">
                <label class="form-label">Short Code</label>
                <input class="form-input" id="edit-team-short" value="${team.short}" maxlength="4" />
            </div>
            <div class="form-group">
                <label class="form-label">Team Color</label>
                <input type="color" class="form-input" id="edit-team-color" value="${team.color}" style="height:44px;padding:4px;" />
            </div>
            <div class="form-group">
                <label class="form-label">Total Purse (₹)</label>
                <input type="number" class="form-input" id="edit-team-purse" value="${team.purse}" min="0" step="1000" />
            </div>
            <div class="form-group">
                <label class="form-label">Max Players</label>
                <input type="number" class="form-input" id="edit-team-max" value="${team.maxPlayers}" min="1" max="25" />
            </div>
        `;

        const footer = `
            <button class="btn btn--sm btn--ghost" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn--sm btn--primary" id="save-team-edit">Save Changes</button>
        `;

        App.openModal(`Edit: ${team.name}`, body, footer);

        setTimeout(() => {
            document.getElementById('save-team-edit')?.addEventListener('click', () => {
                const state = AppState.getState();
                const teams = state.teams.map(t => {
                    if (t.id === teamId) {
                        return {
                            ...t,
                            name: document.getElementById('edit-team-name').value.trim() || t.name,
                            short: document.getElementById('edit-team-short').value.trim().toUpperCase() || t.short,
                            color: document.getElementById('edit-team-color').value,
                            purse: parseInt(document.getElementById('edit-team-purse').value) || t.purse,
                            maxPlayers: parseInt(document.getElementById('edit-team-max').value) || t.maxPlayers,
                        };
                    }
                    return t;
                });
                AppState.update({ teams });
                AppState.addLog({ type: 'team', message: `Team "${document.getElementById('edit-team-name').value}" updated`, icon: '✏️' });
                App.closeModal();
                App.showToast('Team updated successfully', 'success');
            });
        }, 100);
    }

    function _openAddModal() {
        const body = `
            <div class="form-group">
                <label class="form-label">Team Name</label>
                <input class="form-input" id="add-team-name" placeholder="e.g. Thunder Hawks" />
            </div>
            <div class="form-group">
                <label class="form-label">Short Code</label>
                <input class="form-input" id="add-team-short" placeholder="e.g. THW" maxlength="4" />
            </div>
            <div class="form-group">
                <label class="form-label">Team Color</label>
                <input type="color" class="form-input" id="add-team-color" value="#6366f1" style="height:44px;padding:4px;" />
            </div>
        `;

        const footer = `
            <button class="btn btn--sm btn--ghost" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn--sm btn--primary" id="save-team-add">Add Team</button>
        `;

        App.openModal('Add New Team', body, footer);

        setTimeout(() => {
            document.getElementById('save-team-add')?.addEventListener('click', () => {
                const name = document.getElementById('add-team-name').value.trim();
                const short = document.getElementById('add-team-short').value.trim().toUpperCase();
                const color = document.getElementById('add-team-color').value;

                if (!name || !short) {
                    App.showToast('Name and short code are required', 'error');
                    return;
                }

                const state = AppState.getState();
                const newTeam = {
                    id: 't' + (Date.now()),
                    name,
                    short,
                    color,
                    purse: AppState.CONSTANTS.DEFAULT_PURSE,
                    maxPlayers: AppState.CONSTANTS.MAX_PLAYERS_PER_TEAM,
                    players: [],
                };

                AppState.update({ teams: [...state.teams, newTeam] });
                AppState.addLog({ type: 'team', message: `New team "${name}" added`, icon: '➕' });
                App.closeModal();
                App.showToast(`Team "${name}" created!`, 'success');
            });
        }, 100);
    }

    return { init, render };
})();
