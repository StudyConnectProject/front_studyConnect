import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';
import { ChatService } from './chatService.js';

export const AuthService = {
  async login(email, password) {
    const res = await fetch(`${Config.BASE_URL}${Config.API.AUTH}/login`, {
      method: 'POST',
      credentials: 'include',  // necesario para que el browser almacene el Set-Cookie (refresh_token)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch (_) {}
      throw new Error(err.message || `Error ${res.status} al iniciar sesión`);
    }
    let data = {};
    try { data = await res.json(); } catch (_) {}
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    Auth.setToken(accessToken);
    if (refreshToken) Auth.setRefreshToken(refreshToken);
    Auth.setUser(data.user);
    return data;
  },

  async register(email, password, role) {
    const res = await fetch(`${Config.BASE_URL}${Config.API.AUTH}/register`, {
      method: 'POST',
      credentials: 'include',  // necesario para que el browser almacene el Set-Cookie (refresh_token)
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (!res.ok) {
      let err = {};
      try { err = await res.json(); } catch (_) {}
      throw new Error(err.message || `Error ${res.status} al registrar`);
    }
    let data = {};
    try { data = await res.json(); } catch (_) {}
    const accessToken = data.accessToken || data.access_token;
    const refreshToken = data.refreshToken || data.refresh_token;
    Auth.setToken(accessToken);
    if (refreshToken) Auth.setRefreshToken(refreshToken);
    Auth.setUser(data.user);
    return data;
  },

  async logout() {
    const user = Auth.getUser();
    if (user) {
      try {
        await Auth.fetchWithAuth(`${Config.API.AUTH}/logout/${user.id}`, { method: 'POST' });
      } catch (_) { /* ignore */ }
    }
    ChatService.disconnect();
    Auth.clear();
  },
};
