import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';

export const AnalyticsService = {
  // ── Eventos ────────────────────────────────────────────────────────────────
  async trackEvent(eventData) {
    const res = await Auth.fetchWithAuth(`${Config.API.EVENTS}/`, {
      method: 'POST',
      body: JSON.stringify(eventData),
    });
    if (!res.ok) throw new Error('Error al registrar evento');
    return await res.json();
  },

  async getEvents(filters = {}) {
    const params = new URLSearchParams();
    Object.entries(filters).forEach(([k, v]) => { if (v != null) params.set(k, v); });
    const qs = params.toString();
    const res = await Auth.fetchWithAuth(`${Config.API.EVENTS}/${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error('Error al consultar eventos');
    return await res.json();
  },

  async getUserActivity(userId, from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const qs = params.toString();
    const res = await Auth.fetchWithAuth(
      `${Config.API.EVENTS}/user-activity/${userId}${qs ? `?${qs}` : ''}`,
    );
    if (!res.ok) throw new Error('Error al cargar actividad del usuario');
    return await res.json();
  },

  async getEventById(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.EVENTS}/${id}`);
    if (!res.ok) throw new Error('Evento no encontrado');
    return await res.json();
  },

  async deleteEvent(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.EVENTS}/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Error al eliminar evento');
    return await res.json().catch(() => ({}));
  },

  // ── Reportes ───────────────────────────────────────────────────────────────
  async getSystemMetrics() {
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/system-metrics`);
    if (!res.ok) throw new Error('Error al cargar métricas');
    return await res.json();
  },

  async getActiveUsers(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/active-users?${params}`);
    if (!res.ok) throw new Error('Error al cargar usuarios activos');
    return await res.json();
  },

  async getPeakHours(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/peak-hours?${params}`);
    if (!res.ok) throw new Error('Error al cargar horas pico');
    return await res.json();
  },

  async getPopularCourses(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/popular-courses?${params}`);
    if (!res.ok) throw new Error('Error al cargar cursos populares');
    return await res.json();
  },

  async getTopTutors(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/top-tutors?${params}`);
    if (!res.ok) throw new Error('Error al cargar mejores tutores');
    return await res.json();
  },

  async getDateRangeReport(from, to) {
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/date-range?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('Error al cargar reporte por rango de fechas');
    return await res.json();
  },
};
