// ─── Módulo base de comunicación con el API Gateway ──────────────────────────
// Wrapper de compatibilidad: delega toda la gestión de tokens en Auth (utils/auth.js)
// para garantizar que el almacenamiento en localStorage sea consistente en toda la app.
//
// Correcciones aplicadas respecto a la versión anterior:
//   1. Las claves de localStorage ya no son 'accessToken'/'refreshToken' (legacy);
//      se usan las mismas que gestiona Auth ('sc_access_token'/'sc_refresh_token').
//   2. El body del refresh se envía en snake_case { refresh_token } tal como
//      espera RefreshTokenRequestDto en el backend.
//   3. Se incluye credentials:'include' para enviar la cookie HttpOnly refresh_token.

import { Auth } from './utils/auth.js';
import { Config } from './config.js';

export const BASE_URL = Config.BASE_URL;

export function getToken() {
  return Auth.getToken();
}

export function setTokens(access, refresh) {
  Auth.setToken(access);
  if (refresh) Auth.setRefreshToken(refresh);
}

export function clearTokens() {
  Auth.clear();
}

export async function refreshAccessToken() {
  const refreshed = await Auth.refreshSession();
  if (!refreshed) {
    window.location.hash = '#/login';
    throw new Error('Sesión expirada');
  }
  return Auth.getToken();
}

/**
 * Realiza una petición autenticada al API Gateway.
 * Delega en Auth.fetchWithAuth, que maneja automáticamente:
 *   - Inyección del Bearer token en el header Authorization.
 *   - Renovación del access token ante una respuesta 401 (single-flight).
 *   - Cierre de sesión y redirección a login si el refresh también falla.
 *
 * @param {string} endpoint - Ruta relativa, ej: '/api/users/me'
 * @param {RequestInit} options - Opciones de fetch (method, body, headers…)
 * @returns {Promise<any>} JSON de la respuesta
 */
export async function apiFetch(endpoint, options = {}) {
  const response = await Auth.fetchWithAuth(endpoint, options);
  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Error ${response.status}`);
  }
  return response.json();
}
