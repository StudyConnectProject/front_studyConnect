import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';
import { UserMapper } from '../mappers/userMapper.js';

export const UserService = {
  async getMe() {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/me`);
    if (!res.ok) throw new Error('Error al obtener perfil');
    return UserMapper.toView(await res.json());
  },

  async updateMe(profileData) {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/me`, {
      method: 'PUT',
      body: JSON.stringify(profileData),
    });
    if (!res.ok) throw new Error('Error al actualizar perfil');
    return await res.json();
  },

  async search(filters) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v) params.set(k, v); });
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/search?${params}`);
    if (!res.ok) throw new Error('Error en búsqueda');
    const data = await res.json();
    return data.map(UserMapper.toView);
  },

  async getById(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/${id}`);
    if (!res.ok) throw new Error('Usuario no encontrado');
    return UserMapper.toView(await res.json());
  },

  async createProfile(profileData) {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}`, {
      method: 'POST',
      body: JSON.stringify(profileData),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.message || 'Error al crear perfil');
    }
    return await res.json();
  },

  // ── Operaciones de administrador ──────────────────────────
  async listAll() {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}`);
    if (!res.ok) throw new Error('Error al cargar usuarios');
    return (await res.json()).map(UserMapper.toView);
  },

  async setRole(id, role) {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/${id}/role`, {
      method: 'PATCH',
      body: JSON.stringify({ role }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al cambiar el rol');
    }
    return await res.json();
  },

  async setStatus(id, isActive) {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ isActive }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al cambiar el estado');
    }
    return await res.json();
  },

  async deleteUser(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.USERS}/${id}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al eliminar el usuario');
    }
    return await res.json();
  },
};
