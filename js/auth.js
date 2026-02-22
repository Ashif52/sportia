/**
 * Auth — Authentication Module
 * Handles role-based login, session persistence, and role switching.
 * Demo-level frontend protection only — no backend validation.
 *
 * Roles:
 *   SuperAdmin  — Full system control, password required
 *   Auctioneer  — Full system control (inherits SuperAdmin), password required
 *   TeamOwner   — View-only dashboard access, no password needed
 */
const Auth = (() => {
    'use strict';

    /* ─── Configuration ─── */
    const ADMIN_PASSWORD = 'ayn2026';
    const CONTROL_ROLES = ['SuperAdmin', 'Auctioneer'];
    const VIEW_ONLY_ROLES = ['TeamOwner'];
    const ALL_ROLES = [...CONTROL_ROLES, ...VIEW_ONLY_ROLES];

    /**
     * Check if a role requires a password
     */
    function requiresPassword(role) {
        return CONTROL_ROLES.includes(role);
    }

    /**
     * Validate login credentials
     * @returns {{ success: boolean, error?: string }}
     */
    function validateLogin(role, password) {
        if (!ALL_ROLES.includes(role)) {
            return { success: false, error: 'Invalid role selected.' };
        }

        if (requiresPassword(role)) {
            if (!password || password.trim() === '') {
                return { success: false, error: 'Password is required for this role.' };
            }
            if (password !== ADMIN_PASSWORD) {
                return { success: false, error: 'Incorrect password. Please try again.' };
            }
        }

        return { success: true };
    }

    /**
     * Perform login — validates and persists session
     */
    function login(role, password) {
        const result = validateLogin(role, password);
        if (!result.success) return result;

        AppState.update({
            currentUser: {
                role: role,
                isAuthenticated: true,
            },
            currentRole: role,
        });

        AppState.addLog({
            type: 'auth',
            message: `${role} logged in`,
            icon: '🔐',
        });

        EventBus.emit(Events.AUTH_LOGIN, { role });
        return { success: true };
    }

    /**
     * Perform logout — clears session but preserves auction data
     */
    function logout() {
        const currentRole = AppState.getState().currentRole;

        AppState.update({
            currentUser: {
                role: null,
                isAuthenticated: false,
            },
            currentRole: 'SuperAdmin', // reset to default
        });

        AppState.addLog({
            type: 'auth',
            message: `${currentRole} logged out`,
            icon: '🚪',
        });

        EventBus.emit(Events.AUTH_LOGOUT);
    }

    /**
     * Check if the current session has control (admin) privileges
     */
    function isControlRole() {
        const role = AppState.getState().currentRole;
        return CONTROL_ROLES.includes(role);
    }

    /**
     * Check if the user is authenticated
     */
    function isAuthenticated() {
        const state = AppState.getState();
        return state.currentUser && state.currentUser.isAuthenticated === true;
    }

    /**
     * Get the current role
     */
    function getCurrentRole() {
        return AppState.getState().currentRole;
    }

    return {
        CONTROL_ROLES,
        VIEW_ONLY_ROLES,
        ALL_ROLES,
        requiresPassword,
        validateLogin,
        login,
        logout,
        isControlRole,
        isAuthenticated,
        getCurrentRole,
    };
})();
