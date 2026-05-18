// ─── Módulo base de comunicación con el API Gateway ──────────────────────────
// Todas las peticiones HTTP del frontend pasan por este módulo.

export const BASE_URL = 'https://apigateway-jvgb.onrender.com';

export function getToken() {
  return localStorage.getItem('accessToken');
}

export function setTokens(access, refresh) {
  localStorage.setItem('accessToken', access);
  if (refresh) localStorage.setItem('refreshToken', refresh);
}

export function clearTokens() {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
}

export async function refreshAccessToken() {
  const refreshToken = localStorage.getItem('refreshToken');
  const response = await fetch(`${BASE_URL}/api/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });
  if (!response.ok) {
    clearTokens();
    window.location.hash = '#/login';
    throw new Error('Sesión expirada');
  }
  const data = await response.json();
  const newAccess = data.accessToken || data.access_token;
  const newRefresh = data.refreshToken || data.refresh_token;
  setTokens(newAccess, newRefresh);
  return newAccess;
}

/**
 * Realiza una petición autenticada al API Gateway.
 * Maneja automáticamente la renovación del token ante una respuesta 401.
 *
 * @param {string} endpoint - Ruta relativa, ej: '/api/users/me'
 * @param {RequestInit} options - Opciones de fetch (method, body, headers…)
 * @param {boolean} retry - Intentar renovar token si 401 (sólo una vez)
 * @returns {Promise<any>} JSON de la respuesta
 */
export async function apiFetch(endpoint, options = {}, retry = true) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  let response;
  try {
    response = await fetch(`${BASE_URL}${endpoint}`, { ...options, headers });
  } catch (_) {
    throw new Error('NETWORK_ERROR');
  }

  if (response.status === 401 && retry) {
    const newToken = await refreshAccessToken();
    return apiFetch(
      endpoint,
      { ...options, headers: { ...options.headers, Authorization: `Bearer ${newToken}` } },
      false,
    );
  }

  if (!response.ok) {
    const error = await response.json().catch(() => ({}));
    throw new Error(error.message || `Error ${response.status}`);
  }

  return response.json();
}
