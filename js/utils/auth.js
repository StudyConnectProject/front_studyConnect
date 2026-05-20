import { Config } from '../config.js';

const TOKEN_KEY = 'sc_access_token';
const USER_KEY = 'sc_user';
const REFRESH_KEY = 'sc_refresh_token';

export const Auth = {
  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },
  setToken(token) {
    if (token && token !== 'undefined' && token !== 'null') {
      localStorage.setItem(TOKEN_KEY, token);
    }
  },
  getRefreshToken() {
    return localStorage.getItem(REFRESH_KEY);
  },
  setRefreshToken(token) {
    localStorage.setItem(REFRESH_KEY, token);
  },
  getUser() {
    const data = localStorage.getItem(USER_KEY);
    return data ? JSON.parse(data) : null;
  },
  setUser(user) {
    if (user != null) {
      localStorage.setItem(USER_KEY, JSON.stringify(user));
    }
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
    localStorage.removeItem(REFRESH_KEY);
  },

  _refreshPromise: null,

  // Renueva el access token usando la cookie httpOnly refresh_token.
  // Fallback: si no hay cookie disponible (entorno local HTTP), usa el refresh token de localStorage.
  // Single-flight: si varias peticiones fallan a la vez, comparten una sola renovación.
  refreshSession() {
    if (this._refreshPromise) return this._refreshPromise;
    this._refreshPromise = (async () => {
      try {
        const storedRefreshToken = this.getRefreshToken();
        const body = storedRefreshToken
          ? JSON.stringify({ refresh_token: storedRefreshToken })
          : null;
        const res = await fetch(`${Config.BASE_URL}${Config.API.AUTH}/refresh`, {
          method: 'POST',
          credentials: 'include',  // envía la cookie HttpOnly refresh_token al servidor
          headers: { 'Content-Type': 'application/json' },
          body,
        });
        if (!res.ok) return false;
        let data = {};
        try { data = await res.json(); } catch (_) { return false; }
        const newAccess = data.accessToken || data.access_token;
        const newRefresh = data.refreshToken || data.refresh_token;
        if (!newAccess) return false;
        this.setToken(newAccess);
        if (newRefresh) this.setRefreshToken(newRefresh);
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
    // Prepend BASE_URL when the URL is a relative path (starts with /)
    const fullUrl = url.startsWith('/') ? `${Config.BASE_URL}${url}` : url;
    const doFetch = () => {
      const headers = { 'Content-Type': 'application/json', ...options.headers };
      const token = this.getToken();
      if (token) headers['Authorization'] = `Bearer ${token}`;
      return fetch(fullUrl, { ...options, headers });
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
