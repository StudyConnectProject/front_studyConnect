import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';
import { ChatService } from './chatService.js';

export const AuthService = {
  async login(email, password) {
    const res = await fetch(`${Config.API.AUTH}/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al iniciar sesión');
    }
    const data = await res.json();
    Auth.setToken(data.access_token);
    Auth.setUser(data.user);
    return data;
  },

  async register(email, password, role) {
    const res = await fetch(`${Config.API.AUTH}/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, role }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al registrar');
    }
    const data = await res.json();
    Auth.setToken(data.access_token);
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
