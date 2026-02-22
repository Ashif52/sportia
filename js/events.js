/**
 * EventBus — Central Pub/Sub Event Dispatcher
 * Provides decoupled communication between modules.
 * All inter-module events flow through this bus.
 */
const EventBus = (() => {
    'use strict';

    const _listeners = new Map();

    /**
     * Subscribe to an event
     * @param {string} event - Event name
     * @param {Function} callback - Handler function
     * @returns {Function} Unsubscribe function
     */
    function subscribe(event, callback) {
        if (!_listeners.has(event)) {
            _listeners.set(event, new Set());
        }
        _listeners.get(event).add(callback);

        // Return unsubscribe function
        return () => _listeners.get(event)?.delete(callback);
    }

    /**
     * Emit an event with optional payload
     * @param {string} event - Event name
     * @param {*} payload - Data to pass to subscribers
     */
    function emit(event, payload) {
        if (_listeners.has(event)) {
            _listeners.get(event).forEach(cb => {
                try {
                    cb(payload);
                } catch (err) {
                    console.error(`[EventBus] Error in handler for "${event}":`, err);
                }
            });
        }
    }

    /**
     * Subscribe to an event — fires once then auto-unsubscribes
     */
    function once(event, callback) {
        const unsub = subscribe(event, (payload) => {
            callback(payload);
            unsub();
        });
        return unsub;
    }

    /**
     * Remove all listeners for a specific event
     */
    function clear(event) {
        if (event) {
            _listeners.delete(event);
        } else {
            _listeners.clear();
        }
    }

    /**
     * Debug: list all registered events and listener counts
     */
    function debug() {
        const map = {};
        _listeners.forEach((set, key) => {
            map[key] = set.size;
        });
        console.table(map);
    }

    return { subscribe, emit, once, clear, debug };
})();

/**
 * Events — Central Event Name Registry
 * Single source of truth for all event names in the application.
 */
const Events = Object.freeze({
    // State
    STATE_CHANGED: 'state:changed',
    STATE_RESET: 'state:reset',

    // Auth
    AUTH_LOGIN: 'auth:login',
    AUTH_LOGOUT: 'auth:logout',
    ROLE_CHANGED: 'role:changed',

    // Navigation
    NAV_CHANGE: 'nav:change',

    // Auction
    AUCTION_START: 'auction:start',
    AUCTION_PAUSE: 'auction:pause',
    AUCTION_RESUME: 'auction:resume',
    AUCTION_END: 'auction:end',
    AUCTION_SOLD: 'auction:sold',
    AUCTION_UNSOLD: 'auction:unsold',
    AUCTION_BID: 'auction:bid',
    AUCTION_TIMER_TICK: 'auction:timer:tick',
    AUCTION_TIMER_EXPIRED: 'auction:timer:expired',
    AUCTION_UNDO: 'auction:undo',

    // Data mutations
    TEAM_UPDATED: 'team:updated',
    PLAYER_UPDATED: 'player:updated',
    LOG_ADDED: 'log:added',

    // UI
    TOAST_SHOW: 'toast:show',
    MODAL_OPEN: 'modal:open',
    MODAL_CLOSE: 'modal:close',
});
