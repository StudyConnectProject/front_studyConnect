import { AnalyticsService } from '../services/analyticsService.js';
import { UserService } from '../services/userService.js';
import { Toast } from '../components/toast.js';

const ROLE_LABELS = { student: 'Estudiante', tutor: 'Tutor', admin: 'Administrador' };

export const DashboardPage = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="page"><div class="loader">Cargando dashboard...</div></div>';

    try {
      const [metricsResult, peakHoursResult, topTutorsResult] = await Promise.allSettled([
        AnalyticsService.getSystemMetrics(),
        AnalyticsService.getPeakHours(),
        AnalyticsService.getTopTutors(),
      ]);

      const analyticsDown = [metricsResult, peakHoursResult, topTutorsResult].every(r => r.status === 'rejected');
      if (analyticsDown) Toast.show('Servicio de analíticas no disponible', 'warning');

      const metrics   = metricsResult.status   === 'fulfilled' ? metricsResult.value   : { totalEvents: 0, last24h: 0, last7d: 0, last30d: 0, byType: [], bySource: [] };
      const peakHours = peakHoursResult.status === 'fulfilled' ? peakHoursResult.value : { peakHours: [] };
      const topTutors = topTutorsResult.status === 'fulfilled' ? topTutorsResult.value : { tutors: [] };

      const total = metrics.totalEvents || 1;

      main.innerHTML = `
        <div class="page">
          <h1 class="page__title">Dashboard</h1>

          <div class="metrics-grid">
            <div class="metric-card">
              <span class="metric-card__value">${metrics.totalEvents}</span>
              <span class="metric-card__label">Eventos Totales</span>
            </div>
            <div class="metric-card">
              <span class="metric-card__value">${metrics.last24h}</span>
              <span class="metric-card__label">Últimas 24h</span>
            </div>
            <div class="metric-card">
              <span class="metric-card__value">${metrics.last7d}</span>
              <span class="metric-card__label">Últimos 7 días</span>
            </div>
            <div class="metric-card">
              <span class="metric-card__value">${metrics.last30d}</span>
              <span class="metric-card__label">Últimos 30 días</span>
            </div>
          </div>

          <div class="dashboard-grid">
            <div class="card">
              <h2 class="card__title">Eventos por Tipo</h2>
              <div class="stat-list">
                ${(metrics.byType || []).map(t => `
                  <div class="stat-item">
                    <span class="stat-item__label">${t._id}</span>
                    <span class="stat-item__value">${t.count}</span>
                    <div class="stat-item__bar" style="width: ${Math.min(100, (t.count / total) * 100)}%"></div>
                  </div>`).join('') || '<p class="empty-state">Sin datos</p>'}
              </div>
            </div>

            <div class="card">
              <h2 class="card__title">Eventos por Servicio</h2>
              <div class="stat-list">
                ${(metrics.bySource || []).map(s => `
                  <div class="stat-item">
                    <span class="stat-item__label">${s._id}</span>
                    <span class="stat-item__value">${s.count}</span>
                    <div class="stat-item__bar" style="width: ${Math.min(100, (s.count / total) * 100)}%"></div>
                  </div>`).join('') || '<p class="empty-state">Sin datos</p>'}
              </div>
            </div>

            <div class="card">
              <h2 class="card__title">Horas Pico</h2>
              <div class="peak-chart">
                ${(peakHours.peakHours || []).slice(0, 12).map(h => `
                  <div class="peak-bar">
                    <div class="peak-bar__fill" style="height: ${Math.min(100, (h.count / ((peakHours.peakHours[0]?.count) || 1)) * 100)}%"></div>
                    <span class="peak-bar__label">${String(h.hour).padStart(2, '0')}h</span>
                  </div>`).join('') || '<p class="empty-state">Sin datos</p>'}
              </div>
            </div>

            <div class="card">
              <h2 class="card__title">Tutores Destacados</h2>
              <div class="stat-list">
                ${(topTutors.tutors || []).length
                  ? topTutors.tutors.map((t, i) => `
                    <div class="stat-item">
                      <span class="stat-item__rank">#${i + 1}</span>
                      <span class="stat-item__label">${t.tutorName || t._id}</span>
                      <span class="stat-item__value">${t.interactions} sesiones</span>
                    </div>`).join('')
                  : '<p class="empty-state">Sin datos</p>'}
              </div>
            </div>
          </div>

          <div class="card" style="margin-top:16px">
            <h2 class="card__title">Gestión de Usuarios</h2>
            <div id="users-admin"><div class="loader">Cargando usuarios...</div></div>
          </div>
        </div>`;

      await this.loadUsers();
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') return;
      main.innerHTML = `<div class="page"><div class="card"><p>Error al cargar dashboard: ${err.message}</p></div></div>`;
    }
  },

  async loadUsers() {
    const container = document.getElementById('users-admin');
    if (!container) return;
    try {
      const users = await UserService.listAll();
      this.renderUsersTable(users);
    } catch (err) {
      if (err.message === 'SESSION_EXPIRED') return;
      container.innerHTML = `<p class="empty-state">${err.message}</p>`;
    }
  },

  renderUsersTable(users) {
    const container = document.getElementById('users-admin');
    if (!users.length) {
      container.innerHTML = '<p class="empty-state">Sin usuarios registrados.</p>';
      return;
    }

    container.innerHTML = `
      <div class="table-wrapper">
        <table class="data-table">
          <thead>
            <tr>
              <th>Nombre</th>
              <th>Email</th>
              <th>Rol</th>
              <th>Estado</th>
              <th>Acciones</th>
            </tr>
          </thead>
          <tbody>
            ${users.map(u => this.renderRow(u)).join('')}
          </tbody>
        </table>
      </div>`;

    container.querySelectorAll('.role-select').forEach(sel => {
      sel.addEventListener('change', async (e) => {
        const id = sel.dataset.uid;
        const role = e.target.value;
        try {
          await UserService.setRole(id, role);
          Toast.success('Rol actualizado');
        } catch (err) {
          if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message);
          this.loadUsers();
        }
      });
    });

    container.querySelectorAll('.status-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const id = btn.dataset.uid;
        const next = btn.dataset.active !== 'true';
        try {
          await UserService.setStatus(id, next);
          Toast.success(next ? 'Usuario activado' : 'Usuario desactivado');
          this.loadUsers();
        } catch (err) {
          if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message);
        }
      });
    });
  },

  renderRow(u) {
    const role = String(u.role || 'student').toLowerCase();
    const active = u.isActive !== false;
    const options = ['student', 'tutor', 'admin']
      .map(r => `<option value="${r}" ${r === role ? 'selected' : ''}>${ROLE_LABELS[r]}</option>`)
      .join('');
    return `
      <tr>
        <td>${this.esc(u.name)}</td>
        <td>${this.esc(u.email)}</td>
        <td><select class="form__input role-select" data-uid="${u.id}">${options}</select></td>
        <td>
          <span class="badge ${active ? 'badge--success' : 'badge--error'}">
            ${active ? 'Activo' : 'Inactivo'}
          </span>
        </td>
        <td>
          <button class="btn btn--small ${active ? 'btn--secondary' : 'btn--primary'} status-btn"
                  data-uid="${u.id}" data-active="${active}">
            ${active ? 'Desactivar' : 'Activar'}
          </button>
        </td>
      </tr>`;
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};
