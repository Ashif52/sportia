/**
 * AppState â€” Centralized State Management
 * Single source of truth for the entire application.
 * Auto-persists to localStorage on every state change.
 * Rehydrates on page load.
 */
const AppState = (() => {
    'use strict';

    const STORAGE_KEY = 'AYN_AUCTION_STATE_V2';
    const DEFAULT_PURSE = 300000;
    const MAX_PLAYERS_PER_TEAM = 15;
    const DEFAULT_TIMER = 30;

    /* â”€â”€â”€ Default State Shape â”€â”€â”€ */
    const _defaultState = {
        currentUser: {
            role: null,
            isAuthenticated: false,
        },
        currentRole: 'SuperAdmin',
        tournament: {
            name: 'Sportia League 2026',
            status: 'draft', // draft | live | completed
        },
        teams: [
            { id: 't1', name: 'Royal Strikers', short: 'RST', color: '#6366f1', purse: DEFAULT_PURSE, maxPlayers: MAX_PLAYERS_PER_TEAM, players: [] },
            { id: 't2', name: 'Thunder Kings', short: 'THK', color: '#f59e0b', purse: DEFAULT_PURSE, maxPlayers: MAX_PLAYERS_PER_TEAM, players: [] },
            { id: 't3', name: 'Storm Warriors', short: 'STW', color: '#16a34a', purse: DEFAULT_PURSE, maxPlayers: MAX_PLAYERS_PER_TEAM, players: [] },
            { id: 't4', name: 'Phoenix Flames', short: 'PHF', color: '#dc2626', purse: DEFAULT_PURSE, maxPlayers: MAX_PLAYERS_PER_TEAM, players: [] },
            { id: 't5', name: 'Shadow Panthers', short: 'SHP', color: '#8b5cf6', purse: DEFAULT_PURSE, maxPlayers: MAX_PLAYERS_PER_TEAM, players: [] },
            { id: 't6', name: 'Arctic Wolves', short: 'ARW', color: '#0ea5e9', purse: DEFAULT_PURSE, maxPlayers: MAX_PLAYERS_PER_TEAM, players: [] },
        ],
        players: [
            // Batsmen
            { id: 'p1', name: 'Arjun Mehta', category: 'Batsman', basePrice: 5000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#7' },
            { id: 'p2', name: 'Rahul Verma', category: 'Batsman', basePrice: 8000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#18' },
            { id: 'p3', name: 'Vikram Singh', category: 'Batsman', basePrice: 10000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#45' },
            { id: 'p4', name: 'Karan Patel', category: 'Batsman', basePrice: 6000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#3' },
            { id: 'p5', name: 'Yash Kulkarni', category: 'Batsman', basePrice: 12000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#11' },
            { id: 'p6', name: 'Deep Chauhan', category: 'Batsman', basePrice: 7000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#21' },

            // Bowlers
            { id: 'p7', name: 'Siddharth Iyer', category: 'Bowler', basePrice: 7000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#99' },
            { id: 'p8', name: 'Aarav Bhatt', category: 'Bowler', basePrice: 9000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#32' },
            { id: 'p9', name: 'Rohan Desai', category: 'Bowler', basePrice: 6000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#8' },
            { id: 'p10', name: 'Nikhil Joshi', category: 'Bowler', basePrice: 5000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#14' },
            { id: 'p11', name: 'Pranav Rao', category: 'Bowler', basePrice: 11000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#55' },
            { id: 'p12', name: 'Tarun Nair', category: 'Bowler', basePrice: 8000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#67' },

            // All-Rounders
            { id: 'p13', name: 'Aditya Sharma', category: 'All-Rounder', basePrice: 15000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#10' },
            { id: 'p14', name: 'Manish Pandey', category: 'All-Rounder', basePrice: 12000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#23' },
            { id: 'p15', name: 'Ravi Kumar', category: 'All-Rounder', basePrice: 10000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#6' },
            { id: 'p16', name: 'Jay Thakur', category: 'All-Rounder', basePrice: 9000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#33' },
            { id: 'p17', name: 'Harsh Reddy', category: 'All-Rounder', basePrice: 8000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#42' },

            // Wicketkeepers
            { id: 'p18', name: 'Dhruv Malhotra', category: 'Wicketkeeper', basePrice: 8000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#1' },
            { id: 'p19', name: 'Ankit Saxena', category: 'Wicketkeeper', basePrice: 6000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#77' },
            { id: 'p20', name: 'Sahil Gupta', category: 'Wicketkeeper', basePrice: 10000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#28' },

            // Extra Players
            { id: 'p21', name: 'Kunal Mishra', category: 'Batsman', basePrice: 5000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#9' },
            { id: 'p22', name: 'Omkar Shinde', category: 'Bowler', basePrice: 7000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#16' },
            { id: 'p23', name: 'Prakash Jain', category: 'All-Rounder', basePrice: 11000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#50' },
            { id: 'p24', name: 'Vishal Tiwari', category: 'Batsman', basePrice: 9000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#63' },
            { id: 'p25', name: 'Gaurav Yadav', category: 'Bowler', basePrice: 6000, status: 'available', soldTo: null, soldPrice: 0, jersey: '#72' },
        ],
        auction: {
            currentPlayer: null,
            currentBid: 0,
            highestBidder: null,
            timer: DEFAULT_TIMER,
            status: 'idle', // idle | running | paused | completed
            bidHistory: [],
        },
        pastLeagues: [
            {
                id: 'lg1', season: 'AYN Premier League 2025', year: 2025,
                startDate: '2025-03-10', endDate: '2025-04-28',
                totalMatches: 32, totalPurse: 1800000,
                champion: { name: 'Thunder Kings', short: 'THK', color: '#f59e0b' },
                runnerUp: { name: 'Royal Strikers', short: 'RST', color: '#6366f1' },
                mvp: 'Rahul Verma', mvpStats: '485 runs, 12 wickets',
                orangeCap: { player: 'Rahul Verma', runs: 485 },
                purpleCap: { player: 'Pranav Rao', wickets: 22 },
                bestBuy: { player: 'Vikram Singh', price: 45000, team: 'Thunder Kings' },
                standings: [
                    { name: 'Thunder Kings', short: 'THK', color: '#f59e0b', played: 10, won: 8, lost: 2, points: 16 },
                    { name: 'Royal Strikers', short: 'RST', color: '#6366f1', played: 10, won: 7, lost: 3, points: 14 },
                    { name: 'Shadow Panthers', short: 'SHP', color: '#8b5cf6', played: 10, won: 6, lost: 4, points: 12 },
                    { name: 'Storm Warriors', short: 'STW', color: '#16a34a', played: 10, won: 5, lost: 5, points: 10 },
                    { name: 'Arctic Wolves', short: 'ARW', color: '#0ea5e9', played: 10, won: 3, lost: 7, points: 6 },
                    { name: 'Phoenix Flames', short: 'PHF', color: '#dc2626', played: 10, won: 1, lost: 9, points: 2 },
                ],
                status: 'completed',
            },
            {
                id: 'lg2', season: 'AYN Champions Trophy 2024', year: 2024,
                startDate: '2024-09-05', endDate: '2024-10-20',
                totalMatches: 28, totalPurse: 1500000,
                champion: { name: 'Storm Warriors', short: 'STW', color: '#16a34a' },
                runnerUp: { name: 'Shadow Panthers', short: 'SHP', color: '#8b5cf6' },
                mvp: 'Aditya Sharma', mvpStats: '380 runs, 15 wickets',
                orangeCap: { player: 'Arjun Mehta', runs: 412 },
                purpleCap: { player: 'Siddharth Iyer', wickets: 19 },
                bestBuy: { player: 'Aditya Sharma', price: 52000, team: 'Storm Warriors' },
                standings: [
                    { name: 'Storm Warriors', short: 'STW', color: '#16a34a', played: 10, won: 8, lost: 2, points: 16 },
                    { name: 'Shadow Panthers', short: 'SHP', color: '#8b5cf6', played: 10, won: 7, lost: 3, points: 14 },
                    { name: 'Thunder Kings', short: 'THK', color: '#f59e0b', played: 10, won: 5, lost: 5, points: 10 },
                    { name: 'Royal Strikers', short: 'RST', color: '#6366f1', played: 10, won: 5, lost: 5, points: 10 },
                    { name: 'Phoenix Flames', short: 'PHF', color: '#dc2626', played: 10, won: 3, lost: 7, points: 6 },
                    { name: 'Arctic Wolves', short: 'ARW', color: '#0ea5e9', played: 10, won: 2, lost: 8, points: 4 },
                ],
                status: 'completed',
            },
            {
                id: 'lg3', season: 'AYN Super League 2024', year: 2024,
                startDate: '2024-03-15', endDate: '2024-05-02',
                totalMatches: 24, totalPurse: 1200000,
                champion: { name: 'Royal Strikers', short: 'RST', color: '#6366f1' },
                runnerUp: { name: 'Arctic Wolves', short: 'ARW', color: '#0ea5e9' },
                mvp: 'Yash Kulkarni', mvpStats: '520 runs',
                orangeCap: { player: 'Yash Kulkarni', runs: 520 },
                purpleCap: { player: 'Aarav Bhatt', wickets: 17 },
                bestBuy: { player: 'Manish Pandey', price: 38000, team: 'Royal Strikers' },
                standings: [
                    { name: 'Royal Strikers', short: 'RST', color: '#6366f1', played: 8, won: 7, lost: 1, points: 14 },
                    { name: 'Arctic Wolves', short: 'ARW', color: '#0ea5e9', played: 8, won: 6, lost: 2, points: 12 },
                    { name: 'Thunder Kings', short: 'THK', color: '#f59e0b', played: 8, won: 4, lost: 4, points: 8 },
                    { name: 'Storm Warriors', short: 'STW', color: '#16a34a', played: 8, won: 4, lost: 4, points: 8 },
                    { name: 'Shadow Panthers', short: 'SHP', color: '#8b5cf6', played: 8, won: 2, lost: 6, points: 4 },
                    { name: 'Phoenix Flames', short: 'PHF', color: '#dc2626', played: 8, won: 1, lost: 7, points: 2 },
                ],
                status: 'completed',
            },
        ],
        activityLogs: [],
    };

    let _state = {};
    let _batchMode = false;
    const _subscribers = new Set();

    /* â”€â”€â”€ Deep Clone Utility â”€â”€â”€ */
    function _clone(obj) {
        return JSON.parse(JSON.stringify(obj));
    }

    /* â”€â”€â”€ Deep Merge (shallow at first level, replaces arrays) â”€â”€â”€ */
    function _merge(target, source) {
        const result = { ...target };
        for (const key of Object.keys(source)) {
            if (
                source[key] !== null &&
                typeof source[key] === 'object' &&
                !Array.isArray(source[key]) &&
                typeof target[key] === 'object' &&
                !Array.isArray(target[key])
            ) {
                result[key] = _merge(target[key], source[key]);
            } else {
                result[key] = source[key];
            }
        }
        return result;
    }

    /* â”€â”€â”€ Persistence â”€â”€â”€ */
    function _persist() {
        try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(_state));
        } catch (e) {
            console.warn('[AppState] Failed to persist state:', e);
        }
    }

    function _rehydrate() {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                // Merge with defaults to handle schema additions
                _state = _merge(_clone(_defaultState), parsed);
                return true;
            }
        } catch (e) {
            console.warn('[AppState] Failed to rehydrate state:', e);
        }
        return false;
    }

    /* â”€â”€â”€ Notification â”€â”€â”€ */
    function _notify(changedKeys) {
        if (_batchMode) return;
        _subscribers.forEach(fn => {
            try { fn(_state, changedKeys); } catch (e) { console.error('[AppState] Subscriber error:', e); }
        });
        EventBus.emit(Events.STATE_CHANGED, { keys: changedKeys });
    }

    /* â”€â”€â”€ Public API â”€â”€â”€ */

    /**
     * Initialize state â€” rehydrate or use defaults
     */
    function init() {
        const didRehydrate = _rehydrate();
        if (!didRehydrate) {
            _state = _clone(_defaultState);
            _persist();
        }
        return _state;
    }

    /**
     * Get a snapshot of the current state (deep clone)
     */
    function getState() {
        return _clone(_state);
    }

    /**
     * Get a live reference (for read-only internal use â€” do NOT mutate)
     */
    function getRawState() {
        return _state;
    }

    /**
     * Update state with partial changes
     */
    function update(partial) {
        const changedKeys = Object.keys(partial);
        _state = _merge(_state, partial);
        _persist();
        _notify(changedKeys);
    }

    /**
     * Batch multiple updates â€” only notifies once at the end
     */
    function batch(fn) {
        _batchMode = true;
        try {
            fn();
        } finally {
            _batchMode = false;
            _persist();
            _notify(['batch']);
        }
    }

    /**
     * Subscribe to state changes
     * @returns {Function} unsubscribe
     */
    function subscribe(fn) {
        _subscribers.add(fn);
        return () => _subscribers.delete(fn);
    }

    /**
     * Hard reset state to defaults
     */
    function resetAll() {
        _state = _clone(_defaultState);
        _persist();
        _subscribers.forEach(fn => { try { fn(_state, ['reset']); } catch (e) { } });
        EventBus.emit(Events.STATE_RESET);
    }

    /**
     * Add an activity log entry
     */
    function addLog(logEntry) {
        const entry = {
            id: 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5),
            timestamp: new Date().toISOString(),
            ...logEntry,
        };
        _state.activityLogs = [entry, ..._state.activityLogs].slice(0, 100);
        _persist();
        EventBus.emit(Events.LOG_ADDED, entry);
    }

    /**
     * Utility getters derived from state
     */
    function getTeamById(id) {
        return _clone(_state.teams.find(t => t.id === id) || null);
    }

    function getPlayerById(id) {
        return _clone(_state.players.find(p => p.id === id) || null);
    }

    function getAvailablePlayers() {
        return _clone(_state.players.filter(p => p.status === 'available'));
    }

    function getSoldPlayers() {
        return _clone(_state.players.filter(p => p.status === 'sold'));
    }

    function getUnsoldPlayers() {
        return _clone(_state.players.filter(p => p.status === 'unsold'));
    }

    function getTeamPlayers(teamId) {
        return _clone(_state.players.filter(p => p.soldTo === teamId));
    }

    function getTeamRemainingPurse(teamId) {
        const team = _state.teams.find(t => t.id === teamId);
        if (!team) return 0;
        const spent = _state.players
            .filter(p => p.soldTo === teamId)
            .reduce((sum, p) => sum + p.soldPrice, 0);
        return team.purse - spent;
    }

    function getTeamPlayerCount(teamId) {
        return _state.players.filter(p => p.soldTo === teamId).length;
    }

    function canTeamBid(teamId, amount) {
        const remaining = getTeamRemainingPurse(teamId);
        const count = getTeamPlayerCount(teamId);
        const team = _state.teams.find(t => t.id === teamId);
        if (!team) return { allowed: false, reason: 'Team not found' };
        if (count >= team.maxPlayers) return { allowed: false, reason: `Team is full (${team.maxPlayers}/${team.maxPlayers})` };
        if (amount > remaining) return { allowed: false, reason: `Exceeds purse (â‚¹${remaining.toLocaleString()} remaining)` };
        return { allowed: true };
    }

    /* â”€â”€â”€ Constants â”€â”€â”€ */
    const CONSTANTS = Object.freeze({
        DEFAULT_PURSE,
        MAX_PLAYERS_PER_TEAM,
        DEFAULT_TIMER,
        STORAGE_KEY,
    });

    return {
        init,
        getState,
        getRawState,
        update,
        batch,
        subscribe,
        resetAll,
        addLog,
        getTeamById,
        getPlayerById,
        getAvailablePlayers,
        getSoldPlayers,
        getUnsoldPlayers,
        getTeamPlayers,
        getTeamRemainingPurse,
        getTeamPlayerCount,
        canTeamBid,
        CONSTANTS,
    };
})();
