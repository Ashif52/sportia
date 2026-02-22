/**
 * Purse Management — SuperAdmin Only
 * Allows the Super Admin to allocate and adjust the purse (budget)
 * for each team individually or apply a bulk amount to all teams.
 *
 * Validations:
 *  - Purse cannot be set below the amount already spent by a team
 *  - Minimum purse value is ₹10,000
 *  - Maximum purse value is ₹10,00,00,000 (10 Cr)
 */
const PurseModule = (() => {
    'use strict';

    const MIN_PURSE = 10000;
    const MAX_PURSE = 100000000; // 10 Cr

    /**
     * Opens the Purse Management modal (SuperAdmin only)
     */
    function openPurseManager() {
        const role = AppState.get('currentRole');
        if (role !== 'SuperAdmin') {
            EventBus.publish(Events.TOAST_SHOW, {
                message: 'Only Super Admin can manage team purses',
                type: 'error',
            });
            return;
        }

        const teams = AppState.get('teams') || [];

        const bodyHTML = `
            <div class="purse-manager">
                <!-- Bulk Set Section -->
                <div class="purse-manager__bulk">
                    <div class="purse-manager__bulk-header">
                        <span class="purse-manager__bulk-icon">💰</span>
                        <span class="purse-manager__bulk-title">Set Purse for All Teams</span>
                    </div>
                    <div class="purse-manager__bulk-body">
                        <div class="purse-manager__bulk-input-row">
                            <span class="purse-manager__currency">₹</span>
                            <input
                                type="number"
                                class="form-input purse-manager__bulk-input"
                                id="purse-bulk-amount"
                                value="${AppState.DEFAULT_PURSE}"
                                min="${MIN_PURSE}"
                                max="${MAX_PURSE}"
                                step="10000"
                                placeholder="Enter amount"
                            />
                            <button class="btn btn--sm btn--primary" id="purse-bulk-apply">
                                Apply to All
                            </button>
                        </div>
                        <div class="purse-manager__bulk-presets">
                            ${[100000, 300000, 500000, 1000000, 2000000, 5000000].map(v => `
                                <button class="purse-manager__preset-btn" data-amount="${v}">
                                    ${_formatCurrency(v)}
                                </button>
                            `).join('')}
                        </div>
                    </div>
                </div>

                <!-- Individual Team Purses -->
                <div class="purse-manager__teams-header">
                    <span>Individual Team Purses</span>
                    <span class="purse-manager__teams-count">${teams.length} teams</span>
                </div>
                <div class="purse-manager__teams-list" id="purse-teams-list">
                    ${teams.map(t => _renderTeamPurseRow(t)).join('')}
                </div>
            </div>
        `;

        const footerHTML = `
            <button class="btn btn--sm btn--ghost" onclick="App.closeModal()">Close</button>
            <button class="btn btn--sm btn--primary" id="purse-save-all">
                <span class="btn__icon">💾</span> Save All Changes
            </button>
        `;

        App.openModal('💰 Purse Management', bodyHTML, footerHTML);

        // Bind events after modal renders
        setTimeout(() => {
            _bindPurseEvents(teams);
        }, 50);
    }

    function _renderTeamPurseRow(team) {
        const playerCount = AppState.getTeamPlayerCount(team.id);
        const remaining = team.purse - team.spent;
        const usagePercent = team.purse > 0 ? ((team.spent / team.purse) * 100).toFixed(0) : 0;

        return `
            <div class="purse-team-row" data-team-id="${team.id}">
                <div class="purse-team-row__header">
                    <div class="purse-team-row__logo" style="background: ${team.color}">${team.shortName}</div>
                    <div class="purse-team-row__info">
                        <div class="purse-team-row__name">${team.name}</div>
                        <div class="purse-team-row__meta">
                            ${playerCount} players • Spent ${_formatCurrency(team.spent)}
                        </div>
                    </div>
                </div>
                <div class="purse-team-row__input-row">
                    <label class="purse-team-row__label">Purse</label>
                    <div class="purse-team-row__input-wrap">
                        <span class="purse-manager__currency">₹</span>
                        <input
                            type="number"
                            class="form-input purse-team-input"
                            data-team-id="${team.id}"
                            value="${team.purse}"
                            min="${Math.max(MIN_PURSE, team.spent)}"
                            max="${MAX_PURSE}"
                            step="10000"
                        />
                    </div>
                    <div class="purse-team-row__remaining ${remaining < 50000 ? 'low' : ''}">
                        Remaining: ${_formatCurrency(remaining)}
                    </div>
                </div>
                <div class="purse-team-row__bar">
                    <div class="purse-team-row__bar-fill" style="width: ${usagePercent}%; background: ${team.color}"></div>
                </div>
            </div>
        `;
    }

    function _bindPurseEvents(teams) {
        // Bulk apply button
        const bulkApplyBtn = document.getElementById('purse-bulk-apply');
        if (bulkApplyBtn) {
            bulkApplyBtn.addEventListener('click', () => {
                const bulkInput = document.getElementById('purse-bulk-amount');
                const bulkAmount = parseInt(bulkInput?.value, 10);

                if (isNaN(bulkAmount) || bulkAmount < MIN_PURSE) {
                    EventBus.publish(Events.TOAST_SHOW, {
                        message: `Minimum purse is ${_formatCurrency(MIN_PURSE)}`,
                        type: 'error',
                    });
                    return;
                }

                if (bulkAmount > MAX_PURSE) {
                    EventBus.publish(Events.TOAST_SHOW, {
                        message: `Maximum purse is ${_formatCurrency(MAX_PURSE)}`,
                        type: 'error',
                    });
                    return;
                }

                // Check if any team has spent more than the new purse
                const blockedTeams = teams.filter(t => t.spent > bulkAmount);
                if (blockedTeams.length > 0) {
                    const names = blockedTeams.map(t => t.name).join(', ');
                    EventBus.publish(Events.TOAST_SHOW, {
                        message: `Cannot apply: ${names} already spent more than ${_formatCurrency(bulkAmount)}`,
                        type: 'error',
                    });
                    return;
                }

                // Update all input fields
                document.querySelectorAll('.purse-team-input').forEach(input => {
                    input.value = bulkAmount;
                });

                EventBus.publish(Events.TOAST_SHOW, {
                    message: `Purse set to ${_formatCurrency(bulkAmount)} for all teams`,
                    type: 'info',
                });
            });
        }

        // Preset buttons
        document.querySelectorAll('.purse-manager__preset-btn').forEach(btn => {
            btn.addEventListener('click', () => {
                const amount = parseInt(btn.dataset.amount, 10);
                const bulkInput = document.getElementById('purse-bulk-amount');
                if (bulkInput) bulkInput.value = amount;
            });
        });

        // Save all button
        const saveAllBtn = document.getElementById('purse-save-all');
        if (saveAllBtn) {
            saveAllBtn.addEventListener('click', _saveAllPurses);
        }
    }

    function _saveAllPurses() {
        const inputs = document.querySelectorAll('.purse-team-input');
        const stateTeams = AppState.get('teams') || [];
        let hasError = false;
        let changes = 0;

        inputs.forEach(input => {
            const teamId = parseInt(input.dataset.teamId, 10);
            const newPurse = parseInt(input.value, 10);
            const team = stateTeams.find(t => t.id === teamId);

            if (!team) return;

            if (isNaN(newPurse) || newPurse < MIN_PURSE) {
                hasError = true;
                EventBus.publish(Events.TOAST_SHOW, {
                    message: `${team.name}: Purse must be at least ${_formatCurrency(MIN_PURSE)}`,
                    type: 'error',
                });
                return;
            }

            if (newPurse < team.spent) {
                hasError = true;
                EventBus.publish(Events.TOAST_SHOW, {
                    message: `${team.name}: Purse cannot be less than already spent (${_formatCurrency(team.spent)})`,
                    type: 'error',
                });
                return;
            }

            if (newPurse !== team.purse) {
                changes++;
            }
        });

        if (hasError) return;

        if (changes === 0) {
            App.closeModal();
            return;
        }

        // Apply all changes
        AppState.batch(() => {
            inputs.forEach(input => {
                const teamId = parseInt(input.dataset.teamId, 10);
                const newPurse = parseInt(input.value, 10);
                const teamIdx = stateTeams.findIndex(t => t.id === teamId);

                if (teamIdx !== -1 && !isNaN(newPurse)) {
                    const oldPurse = stateTeams[teamIdx].purse;
                    if (newPurse !== oldPurse) {
                        stateTeams[teamIdx].purse = newPurse;
                    }
                }
            });
            AppState.setState({ teams: stateTeams });
        });

        AppState.addLog(`💰 Purse updated for ${changes} team(s) by Super Admin`, 'success');
        EventBus.publish(Events.PURSE_UPDATED);
        EventBus.publish(Events.TOAST_SHOW, {
            message: `Purse updated for ${changes} team(s) successfully`,
            type: 'success',
        });

        App.closeModal();
    }

    function _formatCurrency(num) {
        if (num >= 10000000) return '₹' + (num / 10000000).toFixed(1) + 'Cr';
        if (num >= 100000) return '₹' + (num / 100000).toFixed(1) + 'L';
        if (num >= 1000) return '₹' + (num / 1000).toFixed(0) + 'K';
        return '₹' + num.toLocaleString('en-IN');
    }

    return Object.freeze({
        openPurseManager,
    });
})();
