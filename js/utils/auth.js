import { Config } from '../config.js';

const TOKEN_KEY = 'sc_access_token';
const USER_KEY = 'sc_user';
const LEGACY_REFRESH_KEY = 'sc_refresh_token';

export const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    localStorage.setItem(TOKEN_KEY, token);
  },
  getUser() {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  setUser(user) {
    localStorage.setItem(USER_KEY, JSON.stringify(user));
  },
  isAuthenticated() {
    return !!this.getToken();
  },
  isAdmin() {
    const u = this.getUser();
    if (!u) return false;
    const roles = (u.roles || []).map((r) => String(r).toLowerCase());
    return roles.includes('admin') || String(u.role || '').toLowerCase() === 'admin';
  },
  clear() {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    localStorage.removeItem(LEGACY_REFRESH_KEY);
  },

  _refreshPromise: null,

  // Renueva el access token usando la cookie httpOnly refresh_token.
  // Single-flight: si varias peticiones fallan a la vez, comparten una sola renovación.
  refreshSession() {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = (async () => {
      try {
        const res = await fetch(`${Config.API.AUTH}/refresh`, { method: 'POST' });
        if (!res.ok) return false;
        const data = await res.json();
        if (!data.access_token) return false;
        this.setToken(data.access_token);
        if (data.user) this.setUser(data.user);
        return true;
      } catch (_) {
        return false;
      } finally {
        this._refreshPromise = null;
      }
    })();
    return this._refreshPromise;
  },

  async fetchWithAuth(url, options = {}) {
    const doFetch = () => {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(url, { ...options, headers });
    };

    let response;
    try {
      response = await doFetch();
    } catch (_) {
      throw new Error('NETWORK_ERROR');
    }

    if (response.status === 401) {
      const refreshed = await this.refreshSession();
      if (refreshed) {
        try {
          response = await doFetch();
        } catch (_) {
          throw new Error('NETWORK_ERROR');
        }
        if (response.status !== 401) return response;
      }
      this.clear();
      try {
        const { ChatService } = await import('../services/chatService.js');
        ChatService.disconnect();
      } catch (_) { /* ignore */ }
      const { Toast } = await import('../components/toast.js');
      Toast.info('Tu sesión ha expirado. Inicia sesión nuevamente.');
      window.location.hash = '#/login';
      throw new Error('SESSION_EXPIRED');
    }
    return response;
  },
};
