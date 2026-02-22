/**
 * Reports Module
 * Analytics and auction summary: team breakdowns, category stats,
 * sold/unsold lists, and export functionality.
 */
const ReportsModule = (() => {
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
        const players = state.players;
        const teams = state.teams;

        const sold = players.filter(p => p.status === 'sold');
        const unsold = players.filter(p => p.status === 'unsold');
        const available = players.filter(p => p.status === 'available');
        const totalSpent = sold.reduce((s, p) => s + p.soldPrice, 0);
        const avgPrice = sold.length > 0 ? Math.round(totalSpent / sold.length) : 0;
        const highestBid = sold.length > 0 ? Math.max(...sold.map(p => p.soldPrice)) : 0;
        const highestPlayer = sold.find(p => p.soldPrice === highestBid);

        _container.innerHTML = `
            <!-- Toolbar -->
            <div class="reports-toolbar">
                <h2 style="font-size:1.15rem;font-weight:700;">Auction Analytics</h2>
                <div class="reports-toolbar__actions">
                    <button class="btn btn--sm btn--primary" id="btn-export-report">
                        📥 Export Report
                    </button>
                </div>
            </div>

            <!-- Summary Stats -->
            <div class="reports-grid">
                <div class="report-stat-card glass-card">
                    <div class="report-stat-card__title">Total Spent</div>
                    <div class="report-stat-card__value">${App.formatCurrency(totalSpent)}</div>
                    <div class="report-stat-card__detail">Across ${sold.length} players</div>
                </div>
                <div class="report-stat-card glass-card">
                    <div class="report-stat-card__title">Average Price</div>
                    <div class="report-stat-card__value">${App.formatCurrency(avgPrice)}</div>
                    <div class="report-stat-card__detail">Per sold player</div>
                </div>
                <div class="report-stat-card glass-card">
                    <div class="report-stat-card__title">Highest Bid</div>
                    <div class="report-stat-card__value">${App.formatCurrency(highestBid)}</div>
                    <div class="report-stat-card__detail">${highestPlayer ? highestPlayer.name : '—'}</div>
                </div>
                <div class="report-stat-card glass-card">
                    <div class="report-stat-card__title">Completion Rate</div>
                    <div class="report-stat-card__value">${players.length > 0 ? Math.round(((sold.length + unsold.length) / players.length) * 100) : 0}%</div>
                    <div class="report-stat-card__detail">${sold.length + unsold.length}/${players.length} processed</div>
                </div>
            </div>

            <!-- Team Breakdown -->
            <div class="report-section glass-card">
                <div class="report-section__header">
                    <h3 class="report-section__title">👥 Team Spending Breakdown</h3>
                </div>
                <div style="padding: var(--sp-md);">
                    ${teams.map(team => {
            const teamPlayers = players.filter(p => p.soldTo === team.id);
            const teamSpent = teamPlayers.reduce((s, p) => s + p.soldPrice, 0);
            const remaining = team.purse - teamSpent;
            const spentPercent = team.purse > 0 ? Math.round((teamSpent / team.purse) * 100) : 0;

            return `
                            <div class="team-breakdown-item">
                                <div class="team-breakdown-item__color" style="background:${team.color};"></div>
                                <div class="team-breakdown-item__name">${team.name}</div>
                                <div class="team-breakdown-item__bar-wrap">
                                    <div class="team-breakdown-item__bar" style="width:${spentPercent}%;background:${team.color};"></div>
                                </div>
                                <div class="team-breakdown-item__value">${App.formatCurrency(teamSpent)}</div>
                            </div>
                        `;
        }).join('')}
                </div>
            </div>

            <!-- Sold Players Table -->
            <div class="report-section glass-card">
                <div class="report-section__header">
                    <h3 class="report-section__title">✅ Sold Players (${sold.length})</h3>
                </div>
                ${sold.length > 0 ? `
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>Category</th>
                            <th>Base Price</th>
                            <th>Sold Price</th>
                            <th>Team</th>
                            <th>Premium</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${sold.sort((a, b) => b.soldPrice - a.soldPrice).map((p, i) => {
            const team = teams.find(t => t.id === p.soldTo);
            const premium = p.basePrice > 0 ? Math.round(((p.soldPrice - p.basePrice) / p.basePrice) * 100) : 0;
            return `
                                <tr>
                                    <td>${i + 1}</td>
                                    <td><strong>${p.name}</strong></td>
                                    <td><span class="badge badge--cat-${p.category.toLowerCase().replace('-', '')}">${p.category}</span></td>
                                    <td class="font-mono">${App.formatCurrency(p.basePrice)}</td>
                                    <td class="font-mono" style="font-weight:700;color:var(--c-success);">${App.formatCurrency(p.soldPrice)}</td>
                                    <td style="color:${team?.color || 'inherit'};font-weight:600;">${team?.name || '—'}</td>
                                    <td><span style="color:${premium > 0 ? 'var(--c-success)' : 'var(--c-text-muted)'};">+${premium}%</span></td>
                                </tr>
                            `;
        }).join('')}
                    </tbody>
                </table>
                ` : '<div class="empty-state" style="padding:var(--sp-xl);"><span class="empty-state__icon">✅</span><span class="empty-state__title">No players sold yet</span></div>'}
            </div>

            <!-- Unsold Players -->
            ${unsold.length > 0 ? `
            <div class="report-section glass-card">
                <div class="report-section__header">
                    <h3 class="report-section__title">❌ Unsold Players (${unsold.length})</h3>
                </div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>#</th>
                            <th>Player</th>
                            <th>Category</th>
                            <th>Base Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${unsold.map((p, i) => `
                            <tr>
                                <td>${i + 1}</td>
                                <td>${p.name}</td>
                                <td><span class="badge badge--cat-${p.category.toLowerCase().replace('-', '')}">${p.category}</span></td>
                                <td class="font-mono">${App.formatCurrency(p.basePrice)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
            ` : ''}

            <!-- Category Analytics -->
            <div class="report-section glass-card">
                <div class="report-section__header">
                    <h3 class="report-section__title">📊 Category Analytics</h3>
                </div>
                <table class="report-table">
                    <thead>
                        <tr>
                            <th>Category</th>
                            <th>Total</th>
                            <th>Sold</th>
                            <th>Unsold</th>
                            <th>Available</th>
                            <th>Avg Price</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${_getCategoryStats(players).map(cat => `
                            <tr>
                                <td><span class="badge badge--cat-${cat.name.toLowerCase().replace('-', '')}">${cat.name}</span></td>
                                <td>${cat.total}</td>
                                <td class="text-success">${cat.sold}</td>
                                <td class="text-danger">${cat.unsold}</td>
                                <td>${cat.available}</td>
                                <td class="font-mono">${App.formatCurrency(cat.avgPrice)}</td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;

        _bindEvents();
    }

    function _getCategoryStats(players) {
        const categories = {};
        players.forEach(p => {
            if (!categories[p.category]) {
                categories[p.category] = { name: p.category, total: 0, sold: 0, unsold: 0, available: 0, totalPrice: 0 };
            }
            categories[p.category].total++;
            categories[p.category][p.status]++;
            if (p.status === 'sold') categories[p.category].totalPrice += p.soldPrice;
        });

        return Object.values(categories).map(c => ({
            ...c,
            avgPrice: c.sold > 0 ? Math.round(c.totalPrice / c.sold) : 0,
        }));
    }

    function _bindEvents() {
        document.getElementById('btn-export-report')?.addEventListener('click', _exportReport);
    }

    function _exportReport() {
        const state = AppState.getState();
        const players = state.players;
        const teams = state.teams;

        let csv = 'Player,Category,Base Price,Status,Sold To,Sold Price\n';
        players.forEach(p => {
            const team = p.soldTo ? teams.find(t => t.id === p.soldTo)?.name : '';
            csv += `"${p.name}","${p.category}",${p.basePrice},"${p.status}","${team}",${p.soldPrice}\n`;
        });

        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `AYN_Auction_Report_${new Date().toISOString().split('T')[0]}.csv`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);

        App.showToast('Report exported as CSV', 'success');
    }

    return { init, render };
})();
