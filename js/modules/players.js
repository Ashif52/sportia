/**
 * Players Module
 * Filterable, sortable, paginated player list with status badges.
 * Debounced search, category filter, status filter.
 */
const PlayersModule = (() => {
    'use strict';

    let _container = null;
    let _searchTimeout = null;
    let _filters = { search: '', category: '', status: '' };
    let _sort = { key: 'name', asc: true };
    let _page = 1;
    const PAGE_SIZE = 15;
    const SEARCH_DEBOUNCE = 300;

    function init(container) {
        _container = container;
        EventBus.subscribe(Events.STATE_CHANGED, render);
        EventBus.subscribe(Events.STATE_RESET, () => { _resetFilters(); render(); });
    }

    function _resetFilters() {
        _filters = { search: '', category: '', status: '' };
        _sort = { key: 'name', asc: true };
        _page = 1;
    }

    function render() {
        if (!_container) return;
        const state = AppState.getState();
        const isControl = Auth.isControlRole();

        // Get unique categories
        const categories = [...new Set(state.players.map(p => p.category))].sort();

        // Filter
        let filtered = state.players.filter(p => {
            if (_filters.search && !p.name.toLowerCase().includes(_filters.search.toLowerCase())) return false;
            if (_filters.category && p.category !== _filters.category) return false;
            if (_filters.status && p.status !== _filters.status) return false;
            return true;
        });

        // Sort
        filtered.sort((a, b) => {
            let valA = a[_sort.key];
            let valB = b[_sort.key];
            if (typeof valA === 'string') valA = valA.toLowerCase();
            if (typeof valB === 'string') valB = valB.toLowerCase();
            if (valA < valB) return _sort.asc ? -1 : 1;
            if (valA > valB) return _sort.asc ? 1 : -1;
            return 0;
        });

        // Paginate
        const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
        if (_page > totalPages) _page = totalPages;
        const pageStart = (_page - 1) * PAGE_SIZE;
        const pageEnd = pageStart + PAGE_SIZE;
        const paged = filtered.slice(pageStart, pageEnd);

        _container.innerHTML = `
            <!-- Toolbar -->
            <div class="players-toolbar">
                <div class="players-toolbar__filters">
                    <div class="players-search-wrap">
                        <span class="players-search-icon">🔍</span>
                        <input type="text" class="players-search form-input" id="player-search" 
                               placeholder="Search players..." value="${_filters.search}">
                    </div>
                    <select class="form-select players-filter" id="player-cat-filter">
                        <option value="">All Categories</option>
                        ${categories.map(c => `<option value="${c}" ${_filters.category === c ? 'selected' : ''}>${c}</option>`).join('')}
                    </select>
                    <select class="form-select players-filter" id="player-status-filter">
                        <option value="">All Status</option>
                        <option value="available" ${_filters.status === 'available' ? 'selected' : ''}>Available</option>
                        <option value="sold" ${_filters.status === 'sold' ? 'selected' : ''}>Sold</option>
                        <option value="unsold" ${_filters.status === 'unsold' ? 'selected' : ''}>Unsold</option>
                    </select>
                </div>
                <div class="players-toolbar__actions">
                    <span class="text-muted" style="font-size:0.82rem;">${filtered.length} result${filtered.length !== 1 ? 's' : ''}</span>
                    ${isControl ? `
                    <button class="btn btn--sm btn--primary control-only" id="btn-add-player">
                        <span class="btn__icon">＋</span> Add Player
                    </button>` : ''}
                </div>
            </div>

            <!-- Table -->
            <div class="players-table-wrap glass-card">
                <table class="players-table">
                    <thead>
                        <tr>
                            <th class="players-th sortable" data-sort="name">
                                Name ${_sort.key === 'name' ? (_sort.asc ? '↑' : '↓') : ''}
                            </th>
                            <th class="players-th sortable" data-sort="category">
                                Category ${_sort.key === 'category' ? (_sort.asc ? '↑' : '↓') : ''}
                            </th>
                            <th class="players-th sortable" data-sort="basePrice">
                                Base Price ${_sort.key === 'basePrice' ? (_sort.asc ? '↑' : '↓') : ''}
                            </th>
                            <th class="players-th">Status</th>
                            <th class="players-th">Sold To</th>
                            <th class="players-th sortable" data-sort="soldPrice">
                                Sold Price ${_sort.key === 'soldPrice' ? (_sort.asc ? '↑' : '↓') : ''}
                            </th>
                            ${isControl ? '<th class="players-th control-only">Actions</th>' : ''}
                        </tr>
                    </thead>
                    <tbody>
                        ${paged.length ? paged.map(p => _renderPlayerRow(p, state, isControl)).join('') : `
                        <tr><td colspan="${isControl ? 7 : 6}" class="text-center text-muted" style="padding:var(--sp-2xl);">
                            <div class="empty-state__icon">🏏</div>
                            <div>No players found</div>
                        </td></tr>
                        `}
                    </tbody>
                </table>

                <!-- Pagination -->
                ${totalPages > 1 ? `
                <div class="players-pagination">
                    <button class="players-pagination__btn" data-page="prev" ${_page === 1 ? 'disabled' : ''}>‹</button>
                    ${_buildPagination(totalPages)}
                    <button class="players-pagination__btn" data-page="next" ${_page === totalPages ? 'disabled' : ''}>›</button>
                    <span class="players-pagination__info">${pageStart + 1}–${Math.min(pageEnd, filtered.length)} of ${filtered.length}</span>
                </div>` : ''}
            </div>
        `;

        _bindEvents();
    }

    function _renderPlayerRow(player, state, isControl) {
        const team = player.soldTo ? state.teams.find(t => t.id === player.soldTo) : null;
        const statusBadge = {
            available: '<span class="badge badge--available">Available</span>',
            sold: '<span class="badge badge--sold">Sold</span>',
            unsold: '<span class="badge badge--unsold">Unsold</span>',
        };

        const catBadge = `badge--cat-${player.category.toLowerCase().replace('-', '')}`;

        return `
            <tr class="players-row" data-player-id="${player.id}">
                <td>
                    <div class="player-cell">
                        <div class="player-avatar" style="background:${team ? team.color : 'var(--c-primary)'};">
                            ${player.name.charAt(0)}
                        </div>
                        <div>
                            <div class="player-name">${player.name}</div>
                            <div class="player-jersey text-muted">${player.jersey || ''}</div>
                        </div>
                    </div>
                </td>
                <td><span class="badge ${catBadge}">${player.category}</span></td>
                <td class="font-mono">${App.formatCurrency(player.basePrice)}</td>
                <td>${statusBadge[player.status] || ''}</td>
                <td>${team ? `<span style="color:${team.color};font-weight:600;">${team.name}</span>` : '—'}</td>
                <td class="font-mono">${player.soldPrice > 0 ? App.formatCurrency(player.soldPrice) : '—'}</td>
                ${isControl ? `
                <td class="control-only">
                    <div style="display:flex;gap:4px;">
                        <button class="btn btn--sm btn--ghost" data-edit-player="${player.id}" title="Edit">✏️</button>
                        ${player.status !== 'available' ? `<button class="btn btn--sm btn--ghost" data-reset-player="${player.id}" title="Reset to available">↩️</button>` : ''}
                    </div>
                </td>` : ''}
            </tr>
        `;
    }

    function _buildPagination(totalPages) {
        let pages = '';
        const maxShow = 5;
        let start = Math.max(1, _page - Math.floor(maxShow / 2));
        let end = Math.min(totalPages, start + maxShow - 1);
        if (end - start + 1 < maxShow) start = Math.max(1, end - maxShow + 1);

        for (let i = start; i <= end; i++) {
            pages += `<button class="players-pagination__btn ${i === _page ? 'active' : ''}" data-page="${i}">${i}</button>`;
        }
        return pages;
    }

    function _bindEvents() {
        if (!_container) return;

        // Search (debounced)
        const searchInput = document.getElementById('player-search');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                clearTimeout(_searchTimeout);
                _searchTimeout = setTimeout(() => {
                    _filters.search = e.target.value;
                    _page = 1;
                    render();
                }, SEARCH_DEBOUNCE);
            });
        }

        // Category filter
        document.getElementById('player-cat-filter')?.addEventListener('change', (e) => {
            _filters.category = e.target.value;
            _page = 1;
            render();
        });

        // Status filter
        document.getElementById('player-status-filter')?.addEventListener('change', (e) => {
            _filters.status = e.target.value;
            _page = 1;
            render();
        });

        // Sort headers
        _container.querySelectorAll('.sortable').forEach(th => {
            th.addEventListener('click', () => {
                const key = th.dataset.sort;
                if (_sort.key === key) {
                    _sort.asc = !_sort.asc;
                } else {
                    _sort.key = key;
                    _sort.asc = true;
                }
                render();
            });
        });

        // Pagination
        _container.querySelectorAll('[data-page]').forEach(btn => {
            btn.addEventListener('click', () => {
                const val = btn.dataset.page;
                if (val === 'prev') _page = Math.max(1, _page - 1);
                else if (val === 'next') _page++;
                else _page = parseInt(val);
                render();
            });
        });

        // Edit player
        _container.querySelectorAll('[data-edit-player]').forEach(btn => {
            btn.addEventListener('click', () => _openEditPlayerModal(btn.dataset.editPlayer));
        });

        // Reset player
        _container.querySelectorAll('[data-reset-player]').forEach(btn => {
            btn.addEventListener('click', async () => {
                const confirmed = await App.showConfirm('Reset this player to available?');
                if (confirmed) {
                    const playerId = btn.dataset.resetPlayer;
                    const state = AppState.getState();
                    const players = state.players.map(p => {
                        if (p.id === playerId) {
                            return { ...p, status: 'available', soldTo: null, soldPrice: 0 };
                        }
                        return p;
                    });
                    AppState.update({ players });
                    const player = state.players.find(p => p.id === playerId);
                    AppState.addLog({ type: 'player', message: `${player?.name} reset to available`, icon: '↩️' });
                    App.showToast('Player reset to available', 'success');
                }
            });
        });

        // Add player button
        document.getElementById('btn-add-player')?.addEventListener('click', _openAddPlayerModal);
    }

    function _openEditPlayerModal(playerId) {
        const player = AppState.getPlayerById(playerId);
        if (!player) return;

        const body = `
            <div class="form-group">
                <label class="form-label">Player Name</label>
                <input class="form-input" id="edit-player-name" value="${player.name}" />
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-select" id="edit-player-cat">
                    <option value="Batsman" ${player.category === 'Batsman' ? 'selected' : ''}>Batsman</option>
                    <option value="Bowler" ${player.category === 'Bowler' ? 'selected' : ''}>Bowler</option>
                    <option value="All-Rounder" ${player.category === 'All-Rounder' ? 'selected' : ''}>All-Rounder</option>
                    <option value="Wicketkeeper" ${player.category === 'Wicketkeeper' ? 'selected' : ''}>Wicketkeeper</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Base Price (₹)</label>
                <input type="number" class="form-input" id="edit-player-price" value="${player.basePrice}" min="0" step="500" />
            </div>
            <div class="form-group">
                <label class="form-label">Jersey #</label>
                <input class="form-input" id="edit-player-jersey" value="${player.jersey || ''}" />
            </div>
        `;

        const footer = `
            <button class="btn btn--sm btn--ghost" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn--sm btn--primary" id="save-player-edit">Save</button>
        `;

        App.openModal(`Edit: ${player.name}`, body, footer);

        setTimeout(() => {
            document.getElementById('save-player-edit')?.addEventListener('click', () => {
                const state = AppState.getState();
                const players = state.players.map(p => {
                    if (p.id === playerId) {
                        return {
                            ...p,
                            name: document.getElementById('edit-player-name').value.trim() || p.name,
                            category: document.getElementById('edit-player-cat').value,
                            basePrice: parseInt(document.getElementById('edit-player-price').value) || p.basePrice,
                            jersey: document.getElementById('edit-player-jersey').value.trim(),
                        };
                    }
                    return p;
                });
                AppState.update({ players });
                AppState.addLog({ type: 'player', message: `Player "${document.getElementById('edit-player-name').value}" updated`, icon: '✏️' });
                App.closeModal();
                App.showToast('Player updated', 'success');
            });
        }, 100);
    }

    function _openAddPlayerModal() {
        const body = `
            <div class="form-group">
                <label class="form-label">Player Name</label>
                <input class="form-input" id="add-player-name" placeholder="e.g. Virat Kohli" />
            </div>
            <div class="form-group">
                <label class="form-label">Category</label>
                <select class="form-select" id="add-player-cat">
                    <option value="Batsman">Batsman</option>
                    <option value="Bowler">Bowler</option>
                    <option value="All-Rounder">All-Rounder</option>
                    <option value="Wicketkeeper">Wicketkeeper</option>
                </select>
            </div>
            <div class="form-group">
                <label class="form-label">Base Price (₹)</label>
                <input type="number" class="form-input" id="add-player-price" value="5000" min="0" step="500" />
            </div>
            <div class="form-group">
                <label class="form-label">Jersey #</label>
                <input class="form-input" id="add-player-jersey" placeholder="e.g. #7" />
            </div>
        `;

        const footer = `
            <button class="btn btn--sm btn--ghost" onclick="App.closeModal()">Cancel</button>
            <button class="btn btn--sm btn--primary" id="save-player-add">Add Player</button>
        `;

        App.openModal('Add New Player', body, footer);

        setTimeout(() => {
            document.getElementById('save-player-add')?.addEventListener('click', () => {
                const name = document.getElementById('add-player-name').value.trim();
                if (!name) {
                    App.showToast('Player name is required', 'error');
                    return;
                }

                const state = AppState.getState();
                const newPlayer = {
                    id: 'p' + Date.now(),
                    name,
                    category: document.getElementById('add-player-cat').value,
                    basePrice: parseInt(document.getElementById('add-player-price').value) || 5000,
                    status: 'available',
                    soldTo: null,
                    soldPrice: 0,
                    jersey: document.getElementById('add-player-jersey').value.trim(),
                };

                AppState.update({ players: [...state.players, newPlayer] });
                AppState.addLog({ type: 'player', message: `New player "${name}" added`, icon: '➕' });
                App.closeModal();
                App.showToast(`Player "${name}" added!`, 'success');
            });
        }, 100);
    }

    return { init, render };
})();
