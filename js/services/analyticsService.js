import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';

export const AnalyticsService = {
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
    if (!res.ok) throw new Error('Error');
    return await res.json();
  },

  async getPopularCourses(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/popular-courses?${params}`);
    if (!res.ok) throw new Error('Error');
    return await res.json();
  },

  async getTopTutors(from, to) {
    const params = new URLSearchParams();
    if (from) params.set('from', from);
    if (to) params.set('to', to);
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/top-tutors?${params}`);
    if (!res.ok) throw new Error('Error');
    return await res.json();
  },

  async getDateRangeReport(from, to) {
    const res = await Auth.fetchWithAuth(`${Config.API.REPORTS}/date-range?from=${from}&to=${to}`);
    if (!res.ok) throw new Error('Error');
    return await res.json();
  },
};
