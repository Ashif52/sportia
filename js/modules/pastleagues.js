/**
 * Past Leagues Module
 * Displays completed league/tournament seasons with standings,
 * champions, individual awards, and season highlights.
 * Available to Auctioneer and SuperAdmin only.
 */
const PastLeaguesModule = (() => {
    'use strict';

    let _container = null;
    let _expandedLeague = null;

    function init(container) {
        _container = container;
        EventBus.subscribe(Events.STATE_CHANGED, render);
        EventBus.subscribe(Events.STATE_RESET, render);
    }

    function render() {
        if (!_container) return;
        const state = AppState.getState();
        const leagues = state.pastLeagues || [];
        const isControl = Auth.isControlRole();

        _container.innerHTML = `
            <!-- Toolbar -->
            <div class="pl-toolbar">
                <div class="pl-toolbar__left">
                    <h2 class="pl-page-title">🏆 Past Leagues</h2>
                    <span class="text-muted" style="font-size:0.82rem;">${leagues.length} season${leagues.length !== 1 ? 's' : ''} completed</span>
                </div>
                <div class="pl-toolbar__right">
                    ${isControl ? `
                    <button class="btn btn--sm btn--primary control-only" id="btn-add-league">
                        <span class="btn__icon">＋</span> Add League
                    </button>
                    ` : ''}
                </div>
            </div>

            ${leagues.length === 0 ? _renderEmpty() : _renderLeagueList(leagues, isControl)}
        `;

        _bindEvents();
    }

    /* ═══════════════════════════════════════════════════════
       EMPTY STATE
       ═══════════════════════════════════════════════════════ */
    function _renderEmpty() {
        return `
            <div class="empty-state" style="padding:var(--sp-2xl);">
                <span class="empty-state__icon">🏆</span>
                <span class="empty-state__title">No Past Leagues</span>
                <span class="empty-state__text">Completed league seasons will appear here.</span>
            </div>
        `;
    }

    /* ═══════════════════════════════════════════════════════
       LEAGUE LIST
       ═══════════════════════════════════════════════════════ */
    function _renderLeagueList(leagues, isControl) {
        return `<div class="pl-league-list">${leagues.map(lg => _renderLeagueCard(lg, isControl)).join('')}</div>`;
    }

    function _renderLeagueCard(league, isControl) {
        const isExpanded = _expandedLeague === league.id;
        const dateRange = `${_formatDate(league.startDate)} — ${_formatDate(league.endDate)}`;

        return `
            <div class="pl-league-card glass-card ${isExpanded ? 'pl-league-card--expanded' : ''}">
                <!-- League Header — always visible -->
                <div class="pl-league-card__header" data-toggle-league="${league.id}">
                    <div class="pl-league-card__header-left">
                        <div class="pl-league-card__trophy">🏆</div>
                        <div class="pl-league-card__title-area">
                            <div class="pl-league-card__season">${league.season}</div>
                            <div class="pl-league-card__dates">${dateRange}</div>
                        </div>
                    </div>
                    <div class="pl-league-card__header-right">
                        <div class="pl-champion-mini">
                            <span class="pl-champion-mini__badge" style="background:${league.champion.color};">${league.champion.short}</span>
                            <span class="pl-champion-mini__label">Champion</span>
                        </div>
                        <span class="pl-league-card__chevron">${isExpanded ? '▲' : '▼'}</span>
                        ${isControl ? `<button class="btn btn--sm btn--ghost control-only pl-delete-btn" data-delete-league="${league.id}" title="Delete">🗑️</button>` : ''}
                    </div>
                </div>

                ${isExpanded ? _renderLeagueDetails(league) : ''}
            </div>
        `;
    }

    /* ═══════════════════════════════════════════════════════
       LEAGUE DETAILS (expanded view)
       ═══════════════════════════════════════════════════════ */
    function _renderLeagueDetails(league) {
        return `
            <div class="pl-league-details">
                <!-- Summary Stats -->
                <div class="pl-summary-grid">
                    <div class="pl-summary-stat">
                        <div class="pl-summary-stat__icon" style="background:linear-gradient(135deg,#fbbf24,#f59e0b);">🏏</div>
                        <div class="pl-summary-stat__info">
                            <div class="pl-summary-stat__value">${league.totalMatches}</div>
                            <div class="pl-summary-stat__label">Matches</div>
                        </div>
                    </div>
                    <div class="pl-summary-stat">
                        <div class="pl-summary-stat__icon" style="background:linear-gradient(135deg,#6366f1,#818cf8);">💰</div>
                        <div class="pl-summary-stat__info">
                            <div class="pl-summary-stat__value">${App.formatCurrencyShort(league.totalPurse)}</div>
                            <div class="pl-summary-stat__label">Total Purse</div>
                        </div>
                    </div>
                    <div class="pl-summary-stat">
                        <div class="pl-summary-stat__icon" style="background:linear-gradient(135deg,#16a34a,#22c55e);">⭐</div>
                        <div class="pl-summary-stat__info">
                            <div class="pl-summary-stat__value">${league.mvp}</div>
                            <div class="pl-summary-stat__label">MVP — ${league.mvpStats}</div>
                        </div>
                    </div>
                </div>

                <!-- Champion & Runner-Up -->
                <div class="pl-final-result">
                    <div class="pl-final-team pl-final-team--champion">
                        <div class="pl-final-team__crown">👑</div>
                        <div class="pl-final-team__badge" style="background:${league.champion.color};">${league.champion.short}</div>
                        <div class="pl-final-team__name">${league.champion.name}</div>
                        <div class="pl-final-team__label">🏆 Champion</div>
                    </div>
                    <div class="pl-vs-badge">VS</div>
                    <div class="pl-final-team pl-final-team--runner">
                        <div class="pl-final-team__badge" style="background:${league.runnerUp.color};">${league.runnerUp.short}</div>
                        <div class="pl-final-team__name">${league.runnerUp.name}</div>
                        <div class="pl-final-team__label">🥈 Runner-Up</div>
                    </div>
                </div>

                <!-- Individual Awards -->
                <div class="pl-awards-row">
                    <div class="pl-award-card pl-award-card--orange">
                        <div class="pl-award-card__icon">🧡</div>
                        <div class="pl-award-card__title">Orange Cap</div>
                        <div class="pl-award-card__player">${league.orangeCap.player}</div>
                        <div class="pl-award-card__stat">${league.orangeCap.runs} runs</div>
                    </div>
                    <div class="pl-award-card pl-award-card--purple">
                        <div class="pl-award-card__icon">💜</div>
                        <div class="pl-award-card__title">Purple Cap</div>
                        <div class="pl-award-card__player">${league.purpleCap.player}</div>
                        <div class="pl-award-card__stat">${league.purpleCap.wickets} wickets</div>
                    </div>
                    <div class="pl-award-card pl-award-card--best">
                        <div class="pl-award-card__icon">💎</div>
                        <div class="pl-award-card__title">Best Buy</div>
                        <div class="pl-award-card__player">${league.bestBuy.player}</div>
                        <div class="pl-award-card__stat">${App.formatCurrency(league.bestBuy.price)} → ${league.bestBuy.team}</div>
                    </div>
                </div>

                <!-- Standings Table -->
                <div class="pl-standings-section">
                    <h4 class="pl-standings-section__title">📊 Final Standings</h4>
                    <table class="pm-standings-table">
                        <thead>
                            <tr>
                                <th>#</th>
                                <th>Team</th>
                                <th>P</th>
                                <th>W</th>
                                <th>L</th>
                                <th>Pts</th>
                            </tr>
                        </thead>
                        <tbody>
                            ${(league.standings || []).map((team, i) => `
                                <tr class="pm-standings-row ${i === 0 ? 'pm-standings-row--top' : i < 4 ? 'pm-standings-row--qualify' : ''}">
                                    <td>
                                        <span class="pm-rank-badge ${i === 0 ? 'pm-rank-badge--gold' : i === 1 ? 'pm-rank-badge--silver' : i === 2 ? 'pm-rank-badge--bronze' : ''}">${i + 1}</span>
                                    </td>
                                    <td>
                                        <div class="pm-standings-team">
                                            <div class="pm-standings-team__badge" style="background:${team.color};">${team.short}</div>
                                            <span class="pm-standings-team__name">${team.name}</span>
                                        </div>
                                    </td>
                                    <td class="font-mono">${team.played}</td>
                                    <td class="font-mono text-success">${team.won}</td>
                                    <td class="font-mono text-danger">${team.lost}</td>
                                    <td><span class="pm-points-badge">${team.points}</span></td>
                                </tr>
                            `).join('')}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    /* ═══════════════════════════════════════════════════════
       ADD LEAGUE MODAL
       ═══════════════════════════════════════════════════════ */
    function _openAddLeagueModal() {
        const body = `
            <div class="form-group">
                <label class="form-label">Season Name</label>
                <input class="form-input" id="add-lg-name" placeholder="e.g. AYN Premier League 2026" />
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-md);">
                <div class="form-group">
                    <label class="form-label">Start Date</label>
                    <input type="date" class="form-input" id="add-lg-start" />
                </div>
                <div class="form-group">
                    <label class="form-label">End Date</label>
                    <input type="date" class="form-input" id="add-lg-end" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-md);">
                <div class="form-group">
                    <label class="form-label">Total Matches</label>
                    <input type="number" class="form-input" id="add-lg-matches" placeholder="24" />
                </div>
                <div class="form-group">
                    <label class="form-label">Total Purse (₹)</label>
                    <input type="number" class="form-input" id="add-lg-purse" placeholder="1200000" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-md);">
                <div class="form-group">
                    <label class="form-label">Champion Team</label>
                    <input class="form-input" id="add-lg-champ" placeholder="Team name" />
                </div>
                <div class="form-group">
                    <label class="form-label">Runner-Up Team</label>
                    <input class="form-input" id="add-lg-runner" placeholder="Team name" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-md);">
                <div class="form-group">
                    <label class="form-label">MVP Name</label>
                    <input class="form-input" id="add-lg-mvp" placeholder="Player name" />
                </div>
                <div class="form-group">
                    <label class="form-label">MVP Stats</label>
                    <input class="form-input" id="add-lg-mvp-stats" placeholder="485 runs, 12 wickets" />
                </div>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:var(--sp-md);">
                <div class="form-group">
                    <label class="form-label">Orange Cap — Player (Runs)</label>
                    <input class="form-input" id="add-lg-orange" placeholder="Player Name, 485" />
                </div>
                <div class="form-group">
                    <label class="form-label">Purple Cap — Player (Wickets)</label>
                    <input class="form-input" id="add-lg-purple" placeholder="Player Name, 22" />
                </div>
            </div>
        `;

        const footer = `
            <button class="btn btn--sm btn--ghost" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn--sm btn--primary" id="save-league-add">Save League</button>
        `;

        App.openModal('Add Past League', body, footer);

        setTimeout(() => {
            document.getElementById('save-league-add')?.addEventListener('click', () => {
                const name = document.getElementById('add-lg-name').value.trim();
                if (!name) { App.showToast('Season name is required', 'error'); return; }

                const champName = document.getElementById('add-lg-champ').value.trim() || 'TBD';
                const runnerName = document.getElementById('add-lg-runner').value.trim() || 'TBD';

                const orangeRaw = document.getElementById('add-lg-orange').value.split(',');
                const purpleRaw = document.getElementById('add-lg-purple').value.split(',');

                const newLeague = {
                    id: 'lg' + Date.now(),
                    season: name,
                    year: new Date().getFullYear(),
                    startDate: document.getElementById('add-lg-start').value || '',
                    endDate: document.getElementById('add-lg-end').value || '',
                    totalMatches: parseInt(document.getElementById('add-lg-matches').value) || 0,
                    totalPurse: parseInt(document.getElementById('add-lg-purse').value) || 0,
                    champion: { name: champName, short: champName.substring(0, 3).toUpperCase(), color: '#6366f1' },
                    runnerUp: { name: runnerName, short: runnerName.substring(0, 3).toUpperCase(), color: '#f59e0b' },
                    mvp: document.getElementById('add-lg-mvp').value.trim() || 'N/A',
                    mvpStats: document.getElementById('add-lg-mvp-stats').value.trim() || '',
                    orangeCap: { player: (orangeRaw[0] || '').trim() || 'N/A', runs: parseInt(orangeRaw[1]) || 0 },
                    purpleCap: { player: (purpleRaw[0] || '').trim() || 'N/A', wickets: parseInt(purpleRaw[1]) || 0 },
                    bestBuy: { player: 'N/A', price: 0, team: 'N/A' },
                    standings: [],
                    status: 'completed',
                };

                const state = AppState.getState();
                AppState.update({ pastLeagues: [newLeague, ...(state.pastLeagues || [])] });
                AppState.addLog({ type: 'league', message: `League added: ${name}`, icon: '🏆' });
                App.closeModal();
                App.showToast('League season added!', 'success');
            });
        }, 100);
    }

    /* ═══════════════════════════════════════════════════════
       UTILITIES
       ═══════════════════════════════════════════════════════ */
    function _formatDate(dateStr) {
        if (!dateStr) return 'N/A';
        const d = new Date(dateStr);
        return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    }

    /* ═══════════════════════════════════════════════════════
       EVENT BINDING
       ═══════════════════════════════════════════════════════ */
    function _bindEvents() {
        // Toggle expand/collapse
        _container?.querySelectorAll('[data-toggle-league]').forEach(el => {
            el.addEventListener('click', (e) => {
                // Don't toggle if clicking the delete button
                if (e.target.closest('.pl-delete-btn')) return;
                const id = el.dataset.toggleLeague;
                _expandedLeague = (_expandedLeague === id) ? null : id;
                render();
            });
        });

        // Add league
        document.getElementById('btn-add-league')?.addEventListener('click', _openAddLeagueModal);

        // Delete league
        _container?.querySelectorAll('[data-delete-league]').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                e.stopPropagation();
                const confirmed = await App.showConfirm('Delete this league record?');
                if (confirmed) {
                    const leagueId = btn.dataset.deleteLeague;
                    const state = AppState.getState();
                    const pastLeagues = (state.pastLeagues || []).filter(l => l.id !== leagueId);
                    AppState.update({ pastLeagues });
                    if (_expandedLeague === leagueId) _expandedLeague = null;
                    AppState.addLog({ type: 'league', message: 'League record deleted', icon: '🗑️' });
                    App.showToast('League deleted', 'success');
                }
            });
        });
    }

    return { init, render };
})();
