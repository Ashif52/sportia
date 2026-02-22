/**
 * Auction Module — Live Auction Engine
 * Manages the bidding lifecycle: player selection, timer, bid increments,
 * sold/unsold declarations, and real-time team bidding.
 *
 * Control Authority: SuperAdmin & Auctioneer only
 * Timer: 30s default, auto-reset on bid, auto-unsold on expiry
 * Bid Validation: Purse limit, max player limit per team
 */
const AuctionModule = (() => {
    'use strict';

    let _container = null;
    let _timerInterval = null;
    let _selectedTeam = null;
    let _bidThrottle = false;
    const BID_THROTTLE_MS = 500;
    const BID_INCREMENTS = [500, 1000, 2000, 5000, 10000];

    function init(container) {
        _container = container;
        EventBus.subscribe(Events.STATE_CHANGED, _onStateChange);
        EventBus.subscribe(Events.STATE_RESET, () => { _stopTimer(); render(); });
    }

    function render() {
        if (!_container) return;
        const state = AppState.getState();
        const auction = state.auction;
        const isControl = Auth.isControlRole();

        if (auction.status === 'idle' || auction.status === 'completed') {
            _renderIdleState(state, isControl);
        } else {
            _renderActiveAuction(state, isControl);
        }
    }

    /* ═══════════════════════════════════════════════════════
       IDLE / SELECT PLAYER STATE
       ═══════════════════════════════════════════════════════ */
    function _renderIdleState(state, isControl) {
        const available = state.players.filter(p => p.status === 'available');
        const completed = state.auction.status === 'completed';

        _container.innerHTML = `
            <div class="auction-idle">
                <div class="auction-idle__icon">${completed ? '🏆' : '⚡'}</div>
                <h2 class="auction-idle__title">${completed ? 'Auction Completed!' : 'Ready to Auction'}</h2>
                <p class="auction-idle__desc">
                    ${completed
                ? `All players have been processed. View the Reports for detailed results.`
                : `Select a player to begin the auction. ${available.length} player${available.length !== 1 ? 's' : ''} available.`
            }
                </p>
                ${isControl && available.length > 0 ? `
                    <div class="auction-idle__player-select">
                        <select class="form-select" id="auction-player-select">
                            <option value="">— Select Player —</option>
                            ${available.map(p => `<option value="${p.id}">${p.name} (${p.category}) — ${App.formatCurrency(p.basePrice)}</option>`).join('')}
                        </select>
                    </div>
                    <button class="btn btn--primary btn--lg control-only" id="btn-start-auction" disabled>
                        ⚡ Start Auction
                    </button>
                ` : !isControl ? `
                    <p class="text-muted" style="font-size:0.85rem;">Waiting for the auctioneer to start...</p>
                ` : available.length === 0 ? `
                    <button class="btn btn--primary" onclick="App.navigateTo('reports')">📋 View Reports</button>
                ` : ''}

                ${_renderRecentResults(state)}
            </div>
        `;

        _bindIdleEvents();
    }

    function _renderRecentResults(state) {
        const recent = state.players.filter(p => p.status === 'sold' || p.status === 'unsold')
            .sort((a, b) => (b.soldPrice || 0) - (a.soldPrice || 0))
            .slice(0, 5);

        if (recent.length === 0) return '';

        return `
            <div class="auction-recent glass-card" style="margin-top:var(--sp-xl);width:100%;max-width:500px;">
                <div class="auction-sidebar__title">🏷️ Recent Results</div>
                <div style="padding:var(--sp-sm) var(--sp-md);">
                    ${recent.map(p => {
            const team = p.soldTo ? state.teams.find(t => t.id === p.soldTo) : null;
            return `
                            <div class="bid-history-item">
                                <span class="badge badge--${p.status}">${p.status}</span>
                                <span class="bid-history-item__team">${p.name}</span>
                                <span class="bid-history-item__amount">${p.soldPrice > 0 ? App.formatCurrency(p.soldPrice) : '—'}</span>
                                ${team ? `<span style="color:${team.color};font-size:0.75rem;font-weight:600;">${team.short}</span>` : ''}
                            </div>
                        `;
        }).join('')}
                </div>
            </div>
        `;
    }

    function _bindIdleEvents() {
        const select = document.getElementById('auction-player-select');
        const startBtn = document.getElementById('btn-start-auction');

        if (select && startBtn) {
            select.addEventListener('change', () => {
                startBtn.disabled = !select.value;
            });

            startBtn.addEventListener('click', () => {
                if (!select.value) return;
                _startAuction(select.value);
            });
        }
    }

    /* ═══════════════════════════════════════════════════════
       ACTIVE AUCTION STATE
       ═══════════════════════════════════════════════════════ */
    function _renderActiveAuction(state, isControl) {
        const auction = state.auction;
        const player = state.players.find(p => p.id === auction.currentPlayer);
        if (!player) return;

        const currentTeam = auction.highestBidder ? state.teams.find(t => t.id === auction.highestBidder) : null;
        const timerPercent = (auction.timer / AppState.CONSTANTS.DEFAULT_TIMER) * 100;
        const timerClass = auction.timer <= 5 ? 'danger' : auction.timer <= 10 ? 'warning' : '';
        const circumference = 2 * Math.PI * 52;
        const dashOffset = circumference * (1 - auction.timer / AppState.CONSTANTS.DEFAULT_TIMER);
        const isPaused = auction.status === 'paused';

        _container.innerHTML = `
            <div class="auction-layout">
                <!-- Main Column -->
                <div class="auction-main">
                    <!-- Player Spotlight -->
                    <div class="player-spotlight">
                        <div class="player-spotlight__content">
                            <div class="player-spotlight__avatar" style="background:${currentTeam ? currentTeam.color : 'var(--c-primary)'};">
                                ${player.name.charAt(0)}
                            </div>
                            <div class="player-spotlight__info">
                                <div class="player-spotlight__name">${player.name}</div>
                                <div class="player-spotlight__meta">
                                    <span>🏏 ${player.category}</span>
                                    <span>👕 ${player.jersey || 'N/A'}</span>
                                </div>
                                <div class="player-spotlight__base">
                                    Base Price: <strong>${App.formatCurrency(player.basePrice)}</strong>
                                </div>
                            </div>
                        </div>
                    </div>

                    <!-- Current Bid Display -->
                    <div class="bid-display glass-card">
                        <div class="bid-display__label">Current Bid</div>
                        <div class="bid-display__amount" id="current-bid-amount">${App.formatCurrency(auction.currentBid)}</div>
                        ${currentTeam ? `
                            <div class="bid-display__bidder">
                                <span class="bid-display__bidder-team" style="background:${currentTeam.color}15;color:${currentTeam.color};">
                                    <span style="width:10px;height:10px;border-radius:50%;background:${currentTeam.color};display:inline-block;"></span>
                                    ${currentTeam.name}
                                </span>
                            </div>
                        ` : `<div class="bid-display__bidder text-muted">No bids yet — starts at base price</div>`}
                    </div>

                    ${isControl ? `
                    <!-- Team Bid Selector (Admin picks which team bids) -->
                    <div class="glass-card" style="padding:var(--sp-md);">
                        <div style="font-size:0.78rem;font-weight:700;text-transform:uppercase;letter-spacing:0.06em;color:var(--c-text-muted);margin-bottom:var(--sp-sm);">
                            Select Bidding Team
                        </div>
                        <div class="team-bid-selector" id="team-bid-selector">
                            ${state.teams.map(t => {
            const canBid = AppState.canTeamBid(t.id, auction.currentBid + BID_INCREMENTS[0]);
            const isSelected = _selectedTeam === t.id;
            return `
                                    <div class="team-bid-card ${isSelected ? 'selected' : ''} ${!canBid.allowed ? 'disabled' : ''}" 
                                         data-bid-team="${t.id}" title="${!canBid.allowed ? canBid.reason : t.name}">
                                        <div style="width:16px;height:16px;border-radius:50%;background:${t.color};margin:0 auto 4px;"></div>
                                        <div>${t.short}</div>
                                        <div style="font-size:0.68rem;color:var(--c-text-muted);">${App.formatCurrencyShort(AppState.getTeamRemainingPurse(t.id))}</div>
                                    </div>
                                `;
        }).join('')}
                        </div>

                        <!-- Bid Increment Buttons -->
                        <div class="bid-actions" id="bid-actions">
                            ${BID_INCREMENTS.map(inc => `
                                <button class="bid-increment-btn bid-action control-only" data-bid-inc="${inc}" 
                                        ${!_selectedTeam ? 'disabled' : ''}>
                                    +${App.formatCurrencyShort(inc)}
                                </button>
                            `).join('')}
                        </div>
                    </div>

                    <!-- Auction Controls -->
                    <div class="auction-controls control-only">
                        <button class="btn btn--sm ${isPaused ? 'btn--primary' : 'btn--warning'}" id="btn-pause-resume">
                            ${isPaused ? '▶️ Resume' : '⏸️ Pause'}
                        </button>
                        <button class="btn btn--sm btn--ghost" id="btn-reset-timer">🔄 Reset Timer</button>
                        <button class="btn btn--sm btn--success" id="btn-declare-sold" ${!auction.highestBidder ? 'disabled' : ''}>
                            ✅ Sold
                        </button>
                        <button class="btn btn--sm btn--danger" id="btn-declare-unsold">
                            ❌ Unsold
                        </button>
                        <button class="btn btn--sm btn--ghost" id="btn-undo-bid" ${auction.bidHistory.length === 0 ? 'disabled' : ''}>
                            ↩️ Undo Last Bid
                        </button>
                    </div>
                    ` : `
                    <!-- View-only message -->
                    <div class="text-center text-muted" style="padding:var(--sp-md);">
                        👁️ Watching auction as ${Auth.getCurrentRole()}
                    </div>
                    `}
                </div>

                <!-- Auction Sidebar -->
                <div class="auction-sidebar">
                    <!-- Timer -->
                    <div class="auction-sidebar__section">
                        <div class="auction-sidebar__title">⏱️ Timer</div>
                        <div style="padding:var(--sp-md);display:flex;justify-content:center;">
                            <div class="timer-container">
                                <div class="timer-ring">
                                    <svg class="timer-ring__svg" viewBox="0 0 120 120">
                                        <circle class="timer-ring__bg" cx="60" cy="60" r="52" />
                                        <circle class="timer-ring__fill ${timerClass}" cx="60" cy="60" r="52"
                                            stroke-dasharray="${circumference}" 
                                            stroke-dashoffset="${dashOffset}" />
                                    </svg>
                                    <div class="timer-ring__value" id="timer-value">${auction.timer}s</div>
                                </div>
                                ${isPaused ? '<div class="badge badge--unsold" style="margin-top:var(--sp-sm);">PAUSED</div>' : ''}
                            </div>
                        </div>
                    </div>

                    <!-- Bid History -->
                    <div class="auction-sidebar__section">
                        <div class="auction-sidebar__title">📊 Bid History</div>
                        <div class="auction-sidebar__body" id="bid-history-list">
                            ${auction.bidHistory.length > 0 ? auction.bidHistory.map((bid, i) => {
            const bidTeam = state.teams.find(t => t.id === bid.teamId);
            return `
                                    <div class="bid-history-item">
                                        <span class="bid-history-item__rank">${i + 1}</span>
                                        <span class="bid-history-item__team" style="color:${bidTeam?.color || 'inherit'};">${bidTeam?.short || '??'}</span>
                                        <span class="bid-history-item__amount">${App.formatCurrency(bid.amount)}</span>
                                    </div>
                                `;
        }).join('') : '<div class="text-center text-muted" style="padding:var(--sp-md);font-size:0.82rem;">No bids yet</div>'}
                        </div>
                    </div>

                    <!-- Queue -->
                    <div class="auction-sidebar__section">
                        <div class="auction-sidebar__title">📋 Up Next</div>
                        <div class="auction-sidebar__body">
                            ${state.players.filter(p => p.status === 'available' && p.id !== auction.currentPlayer)
                .slice(0, 5).map(p => `
                                    <div class="bid-history-item">
                                        <span style="font-size:0.75rem;">🏏</span>
                                        <span class="bid-history-item__team">${p.name}</span>
                                        <span class="bid-history-item__amount">${App.formatCurrency(p.basePrice)}</span>
                                    </div>
                                `).join('') || '<div class="text-center text-muted" style="padding:var(--sp-md);font-size:0.82rem;">No more players</div>'}
                        </div>
                    </div>
                </div>
            </div>
        `;

        _bindActiveEvents();
    }

    /* ═══════════════════════════════════════════════════════
       AUCTION ACTIONS
       ═══════════════════════════════════════════════════════ */
    function _startAuction(playerId) {
        const player = AppState.getPlayerById(playerId);
        if (!player) return;

        AppState.update({
            auction: {
                currentPlayer: playerId,
                currentBid: player.basePrice,
                highestBidder: null,
                timer: AppState.CONSTANTS.DEFAULT_TIMER,
                status: 'running',
                bidHistory: [],
            },
            tournament: { ...AppState.getState().tournament, status: 'live' },
        });

        AppState.addLog({ type: 'auction', message: `Auction started for ${player.name} at ${App.formatCurrency(player.basePrice)}`, icon: '⚡' });
        App.showToast(`Auction started: ${player.name}`, 'bid');
        _selectedTeam = null;
        _startTimer();
        render();
    }

    function _placeBid(teamId, increment) {
        if (_bidThrottle) return;
        _bidThrottle = true;
        setTimeout(() => _bidThrottle = false, BID_THROTTLE_MS);

        const state = AppState.getState();
        const auction = state.auction;
        const newBid = auction.currentBid + increment;

        // Validate
        const canBid = AppState.canTeamBid(teamId, newBid);
        if (!canBid.allowed) {
            App.showToast(canBid.reason, 'error');
            return;
        }

        const team = state.teams.find(t => t.id === teamId);
        const bidEntry = {
            teamId,
            amount: newBid,
            increment,
            timestamp: Date.now(),
        };

        AppState.update({
            auction: {
                ...auction,
                currentBid: newBid,
                highestBidder: teamId,
                timer: AppState.CONSTANTS.DEFAULT_TIMER, // Auto-reset timer on bid
                bidHistory: [bidEntry, ...auction.bidHistory],
            },
        });

        AppState.addLog({
            type: 'bid',
            message: `${team?.name} bid ${App.formatCurrency(newBid)} (+${App.formatCurrency(increment)})`,
            icon: '💰',
        });

        App.showToast(`${team?.short}: ${App.formatCurrency(newBid)}`, 'bid');

        // Re-render with fresh timer
        _startTimer();
        render();
    }

    function _declareSold() {
        const state = AppState.getState();
        const auction = state.auction;
        if (!auction.highestBidder || !auction.currentPlayer) return;

        const player = state.players.find(p => p.id === auction.currentPlayer);
        const team = state.teams.find(t => t.id === auction.highestBidder);

        // Update player status
        const players = state.players.map(p => {
            if (p.id === auction.currentPlayer) {
                return { ...p, status: 'sold', soldTo: auction.highestBidder, soldPrice: auction.currentBid };
            }
            return p;
        });

        // Reset auction
        AppState.update({
            players,
            auction: {
                currentPlayer: null,
                currentBid: 0,
                highestBidder: null,
                timer: AppState.CONSTANTS.DEFAULT_TIMER,
                status: 'idle',
                bidHistory: [],
            },
        });

        _stopTimer();

        AppState.addLog({
            type: 'sold',
            message: `🎉 ${player?.name} SOLD to ${team?.name} for ${App.formatCurrency(auction.currentBid)}`,
            icon: '✅',
        });

        App.showToast(`${player?.name} sold to ${team?.name} for ${App.formatCurrency(auction.currentBid)}!`, 'success', 5000);

        // Check if all players are done
        const remaining = players.filter(p => p.status === 'available');
        if (remaining.length === 0) {
            AppState.update({
                auction: { ...AppState.getState().auction, status: 'completed' },
                tournament: { ...AppState.getState().tournament, status: 'completed' },
            });
            AppState.addLog({ type: 'tournament', message: 'All players auctioned! Tournament completed.', icon: '🏆' });
        }

        render();
    }

    function _declareUnsold() {
        const state = AppState.getState();
        const auction = state.auction;
        if (!auction.currentPlayer) return;

        const player = state.players.find(p => p.id === auction.currentPlayer);

        const players = state.players.map(p => {
            if (p.id === auction.currentPlayer) {
                return { ...p, status: 'unsold', soldTo: null, soldPrice: 0 };
            }
            return p;
        });

        AppState.update({
            players,
            auction: {
                currentPlayer: null,
                currentBid: 0,
                highestBidder: null,
                timer: AppState.CONSTANTS.DEFAULT_TIMER,
                status: 'idle',
                bidHistory: [],
            },
        });

        _stopTimer();

        AppState.addLog({
            type: 'unsold',
            message: `${player?.name} declared UNSOLD`,
            icon: '❌',
        });

        App.showToast(`${player?.name} went unsold`, 'warning');
        render();
    }

    function _undoLastBid() {
        const state = AppState.getState();
        const auction = state.auction;
        if (auction.bidHistory.length === 0) return;

        const newHistory = [...auction.bidHistory];
        newHistory.shift(); // Remove latest bid

        const prevBid = newHistory.length > 0 ? newHistory[0] : null;
        const player = state.players.find(p => p.id === auction.currentPlayer);

        AppState.update({
            auction: {
                ...auction,
                currentBid: prevBid ? prevBid.amount : player?.basePrice || 0,
                highestBidder: prevBid ? prevBid.teamId : null,
                bidHistory: newHistory,
            },
        });

        AppState.addLog({ type: 'auction', message: 'Last bid undone', icon: '↩️' });
        App.showToast('Last bid undone', 'info');
        render();
    }

    /* ═══════════════════════════════════════════════════════
       TIMER
       ═══════════════════════════════════════════════════════ */
    function _startTimer() {
        _stopTimer();

        _timerInterval = setInterval(() => {
            const state = AppState.getRawState();
            if (state.auction.status !== 'running') {
                _stopTimer();
                return;
            }

            state.auction.timer--;

            // Update timer display without full re-render
            const timerEl = document.getElementById('timer-value');
            if (timerEl) timerEl.textContent = `${state.auction.timer}s`;

            // Update SVG ring
            const circumference = 2 * Math.PI * 52;
            const dashOffset = circumference * (1 - state.auction.timer / AppState.CONSTANTS.DEFAULT_TIMER);
            const fillEl = _container?.querySelector('.timer-ring__fill');
            if (fillEl) {
                fillEl.setAttribute('stroke-dashoffset', dashOffset);
                fillEl.classList.remove('warning', 'danger');
                if (state.auction.timer <= 5) fillEl.classList.add('danger');
                else if (state.auction.timer <= 10) fillEl.classList.add('warning');
            }

            EventBus.emit(Events.AUCTION_TIMER_TICK, { timer: state.auction.timer });

            if (state.auction.timer <= 0) {
                _stopTimer();
                EventBus.emit(Events.AUCTION_TIMER_EXPIRED);
                // Auto-unsold on timeout
                _declareUnsold();
            }
        }, 1000);
    }

    function _stopTimer() {
        if (_timerInterval) {
            clearInterval(_timerInterval);
            _timerInterval = null;
        }
    }

    function _pauseAuction() {
        _stopTimer();
        const auction = AppState.getState().auction;
        AppState.update({ auction: { ...auction, status: 'paused' } });
        AppState.addLog({ type: 'auction', message: 'Auction paused', icon: '⏸️' });
        render();
    }

    function _resumeAuction() {
        const auction = AppState.getState().auction;
        AppState.update({ auction: { ...auction, status: 'running' } });
        AppState.addLog({ type: 'auction', message: 'Auction resumed', icon: '▶️' });
        _startTimer();
        render();
    }

    function _resetTimer() {
        const auction = AppState.getState().auction;
        AppState.update({ auction: { ...auction, timer: AppState.CONSTANTS.DEFAULT_TIMER } });
        if (auction.status === 'running') _startTimer();
        render();
    }

    /* ═══════════════════════════════════════════════════════
       EVENT BINDING
       ═══════════════════════════════════════════════════════ */
    function _bindActiveEvents() {
        if (!_container) return;

        // Team selection
        _container.querySelectorAll('[data-bid-team]').forEach(card => {
            card.addEventListener('click', () => {
                if (card.classList.contains('disabled')) return;
                _selectedTeam = card.dataset.bidTeam;
                _container.querySelectorAll('.team-bid-card').forEach(c => c.classList.remove('selected'));
                card.classList.add('selected');
                // Enable bid buttons
                _container.querySelectorAll('.bid-increment-btn').forEach(btn => btn.disabled = false);
            });
        });

        // Bid increment buttons (throttled)
        _container.querySelectorAll('[data-bid-inc]').forEach(btn => {
            btn.addEventListener('click', () => {
                if (!_selectedTeam) {
                    App.showToast('Select a team first', 'warning');
                    return;
                }
                _placeBid(_selectedTeam, parseInt(btn.dataset.bidInc));
            });
        });

        // Pause/Resume
        document.getElementById('btn-pause-resume')?.addEventListener('click', () => {
            const status = AppState.getState().auction.status;
            if (status === 'running') _pauseAuction();
            else if (status === 'paused') _resumeAuction();
        });

        // Reset timer
        document.getElementById('btn-reset-timer')?.addEventListener('click', _resetTimer);

        // Declare sold
        document.getElementById('btn-declare-sold')?.addEventListener('click', async () => {
            const state = AppState.getState();
            const player = state.players.find(p => p.id === state.auction.currentPlayer);
            const team = state.teams.find(t => t.id === state.auction.highestBidder);
            const confirmed = await App.showConfirm(
                `Sell ${player?.name} to ${team?.name} for ${App.formatCurrency(state.auction.currentBid)}?`,
                '✅'
            );
            if (confirmed) _declareSold();
        });

        // Declare unsold
        document.getElementById('btn-declare-unsold')?.addEventListener('click', async () => {
            const confirmed = await App.showConfirm('Declare this player as UNSOLD?', '❌');
            if (confirmed) _declareUnsold();
        });

        // Undo last bid
        document.getElementById('btn-undo-bid')?.addEventListener('click', _undoLastBid);
    }

    function _onStateChange(data) {
        // Minimal update — only re-render if we're on the auction tab
        const activeSection = document.querySelector('.module-section.active');
        if (activeSection && activeSection.id === 'module-auction') {
            // Don't re-render on every tick, only on significant changes
            if (data?.keys && data.keys.length === 1 && data.keys[0] === 'auction') {
                // Let timer handle its own updates
                return;
            }
        }
    }

    return { init, render };
})();
