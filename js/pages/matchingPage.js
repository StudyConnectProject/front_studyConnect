import { MatchingService } from '../services/matchingService.js';
import { ChatService } from '../services/chatService.js';
import { UserService } from '../services/userService.js';
import { Auth } from '../utils/auth.js';
import { Toast } from '../components/toast.js';

const LEVELS = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' };
const REQ_STATUS = {
  pending: { label: 'Pendiente', cls: 'badge--secondary' },
  processing: { label: 'En proceso', cls: 'badge--primary' },
  completed: { label: 'Completada', cls: 'badge--success' },
  rejected: { label: 'Rechazada', cls: 'badge--error' },
  cancelled: { label: 'Cancelada', cls: 'badge--secondary' },
};
const MATCH_STATUS = {
  suggested: { label: 'Sugerido', cls: 'badge--primary' },
  accepted: { label: 'Aceptado', cls: 'badge--success' },
  rejected: { label: 'Rechazado', cls: 'badge--error' },
};

// Guarda en localStorage los matches sugeridos que el estudiante ya vio.
const SEEN_KEY = 'sc_matching_seen_matches';

export const MatchingPage = {
  _tab: '',
  _isTutor: false,

  async render() {
    const user = Auth.getUser();
    const role = user?.role?.toLowerCase() || (user?.roles?.[0] || '').toLowerCase();
    this._isTutor = role === 'tutor' || role === 'admin';

    const main = document.getElementById('main-content');
    const tabs = this._isTutor
      ? `<button class="tab-btn tab-btn--active" data-tab="open">Solicitudes de Estudiantes</button>
         <button class="tab-btn" data-tab="mymatches">Mis Tutorías</button>`
      : `<button class="tab-btn tab-btn--active" data-tab="requests">Mis Solicitudes</button>
         <button class="tab-btn" data-tab="create">+ Solicitar Tutoría</button>
         <button class="tab-btn" data-tab="mymatches">Tutores Interesados</button>`;

    main.innerHTML = `
      <div class="page">
        <div class="courses-header">
          <h1 class="courses-title">${this._isTutor ? 'Tutorías Disponibles' : 'Tutorías'}</h1>
          <div class="courses-tabs">${tabs}</div>
        </div>
        <div id="matching-content"></div>
      </div>`;

    main.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
        btn.classList.add('tab-btn--active');
        this._tab = btn.dataset.tab;
        this.renderTab();
      });
    });

    this._tab = this._isTutor ? 'open' : 'requests';
    await this.renderTab();

    // El estudiante ve una burbuja con los tutores interesados sin revisar.
    if (!this._isTutor) this.updateMatchesBadge();
  },

  async renderTab() {
    const content = document.getElementById('matching-content');
    if (!content) return;
    content.innerHTML = '<div class="loader" style="padding:30px;text-align:center">Cargando...</div>';

    if (this._tab === 'create') this.renderCreateForm(content);
    else if (this._tab === 'open') await this.renderOpenRequests(content);
    else if (this._tab === 'mymatches') await this.renderMyMatches(content);
    else await this.renderMyRequests(content);
  },

  /* ── Burbuja de tutores interesados sin leer ─────────────── */
  getSeen() {
    try { return JSON.parse(localStorage.getItem(SEEN_KEY) || '[]'); }
    catch { return []; }
  },

  markSeen(ids) {
    const seen = new Set(this.getSeen());
    ids.forEach(id => seen.add(id));
    localStorage.setItem(SEEN_KEY, JSON.stringify([...seen]));
  },

  async updateMatchesBadge() {
    try {
      const matches = await MatchingService.getUserMatches();
      const suggested = matches.filter(m => m.status === 'suggested');
      const seen = this.getSeen();
      const unseen = suggested.filter(m => !seen.includes(m.id));
      const tabBtn = document.querySelector('.tab-btn[data-tab="mymatches"]');
      if (!tabBtn) return;
      tabBtn.querySelector('.tab-badge')?.remove();
      if (unseen.length > 0) {
        const badge = document.createElement('span');
        badge.className = 'tab-badge';
        badge.textContent = unseen.length;
        badge.title = `${unseen.length} tutor(es) interesado(s) sin revisar`;
        tabBtn.appendChild(badge);
      }
    } catch { /* silencioso: la burbuja es informativa */ }
  },

  /* ── TUTOR: solicitudes abiertas de estudiantes ──────────── */
  async renderOpenRequests(container) {
    try {
      const [pending, processing] = await Promise.all([
        MatchingService.list({ status: 'pending' }),
        MatchingService.list({ status: 'processing' }),
      ]);
      const requests = [...pending, ...processing];
      if (!requests.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>No hay solicitudes de tutoría abiertas en este momento.</p>
        </div>`;
        return;
      }
      container.innerHTML = `<div class="courses-grid">${requests.map(r => this.openRequestCard(r)).join('')}</div>`;
      container.querySelectorAll('.offer-btn').forEach(btn => {
        btn.addEventListener('click', (e) => { e.stopPropagation(); this.offer(btn.dataset.id, btn); });
      });
      // El tutor abre el detalle completo al pulsar la tarjeta.
      container.querySelectorAll('.course-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          this.showMatchDetail(card.dataset.id, card.dataset.student);
        });
      });
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') {
        container.innerHTML = `<p class="empty-state" style="padding:20px;color:var(--danger)">${err.message}</p>`;
      }
    }
  },

  openRequestCard(r) {
    const st = REQ_STATUS[r.status] || { label: r.status, cls: 'badge--secondary' };
    const desc = r.description || '';
    const shortDesc = desc.length > 140 ? desc.substring(0, 140) + '…' : desc;
    return `
      <div class="course-card" data-id="${r.id}" data-student="${r.student_id || ''}">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(r.subject)}</h3>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        ${shortDesc ? `<p class="course-card__desc">${this.esc(shortDesc)}</p>` : ''}
        <div class="course-card__meta">
          <span class="tag tag--level">${LEVELS[r.level] || r.level}</span>
        </div>
        <p class="course-card__hint" style="font-size:0.75rem;color:var(--text-secondary);margin-top:6px">Haz clic para ver los detalles</p>
        <div class="course-card__actions">
          <button class="btn btn--small btn--primary offer-btn" data-id="${r.id}">Ofrecerme como tutor</button>
        </div>
      </div>`;
  },

  async offer(requestId, btn) {
    btn.disabled = true;
    try {
      await MatchingService.offer(requestId);
      Toast.success('Te ofreciste para esta solicitud. El estudiante la verá en sus tutores interesados.');
      await this.renderTab();
    } catch (err) {
      Toast.error(err.message);
      btn.disabled = false;
    }
  },

  /* ── ESTUDIANTE: mis solicitudes ─────────────────────────── */
  async renderMyRequests(container) {
    try {
      const requests = await MatchingService.myRequests();
      if (!requests.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>Aún no has solicitado ninguna tutoría.</p>
          <button class="btn btn--primary" style="margin-top:16px" id="go-create">Solicitar mi primera tutoría</button>
        </div>`;
        container.querySelector('#go-create')?.addEventListener('click', () => {
          document.querySelector('[data-tab="create"]')?.click();
        });
        return;
      }
      container.innerHTML = `<div class="courses-grid">${requests.map(r => this.requestCard(r)).join('')}</div>`;
      container.querySelectorAll('.cancel-req-btn').forEach(btn => {
        btn.addEventListener('click', () => this.cancelRequest(btn.dataset.id));
      });
      container.querySelectorAll('.edit-req-btn').forEach(btn => {
        btn.addEventListener('click', () => this.showEditModal(btn.dataset.id));
      });
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') {
        container.innerHTML = `<p class="empty-state" style="padding:20px;color:var(--danger)">${err.message}</p>`;
      }
    }
  },

  requestCard(r) {
    const st = REQ_STATUS[r.status] || { label: r.status, cls: 'badge--secondary' };
    const desc = r.description || '';
    const shortDesc = desc.length > 120 ? desc.substring(0, 120) + '…' : desc;
    const active = r.status === 'pending' || r.status === 'processing';
    return `
      <div class="course-card" data-id="${r.id}">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(r.subject)}</h3>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        ${shortDesc ? `<p class="course-card__desc">${this.esc(shortDesc)}</p>` : ''}
        <div class="course-card__meta">
          <span class="tag tag--level">${LEVELS[r.level] || r.level}</span>
        </div>
        ${active ? `<div class="course-card__actions">
          <button class="btn btn--small btn--secondary edit-req-btn" data-id="${r.id}">Editar</button>
          <button class="btn btn--small btn--danger cancel-req-btn" data-id="${r.id}">Cancelar solicitud</button>
        </div>` : ''}
      </div>`;
  },

  async cancelRequest(id) {
    if (!confirm('¿Cancelar esta solicitud de tutoría?')) return;
    try {
      await MatchingService.cancel(id);
      Toast.success('Solicitud cancelada');
      await this.renderTab();
    } catch (err) { Toast.error(err.message); }
  },

  /* ── Editar solicitud (estudiante) ───────────────────────── */
  async showEditModal(requestId) {
    this.openModal('Editar solicitud', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    try {
      const req = await MatchingService.getById(requestId);
      document.getElementById('matching-modal-body').innerHTML = `
        <form id="edit-match-form" class="form">
          <label class="form__label">Materia *</label>
          <input type="text" id="ef-subject" class="form__input" required maxlength="255" value="${this.esc(req.subject)}">
          <label class="form__label">Nivel *</label>
          <select id="ef-level" class="form__input">
            <option value="beginner" ${req.level === 'beginner' ? 'selected' : ''}>Principiante</option>
            <option value="intermediate" ${req.level === 'intermediate' ? 'selected' : ''}>Intermedio</option>
            <option value="advanced" ${req.level === 'advanced' ? 'selected' : ''}>Avanzado</option>
          </select>
          <label class="form__label">Descripción</label>
          <textarea id="ef-desc" class="form__input" rows="3" style="resize:vertical">${this.esc(req.description || '')}</textarea>
          <div style="display:flex;gap:12px;margin-top:16px">
            <button type="submit" class="btn btn--primary">Guardar cambios</button>
            <button type="button" id="ef-cancel" class="btn btn--secondary">Cancelar</button>
          </div>
        </form>`;

      document.getElementById('ef-cancel').addEventListener('click', () => {
        document.getElementById('matching-modal')?.remove();
      });

      document.getElementById('edit-match-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
          await MatchingService.update(requestId, {
            subject: document.getElementById('ef-subject').value.trim(),
            level: document.getElementById('ef-level').value,
            description: document.getElementById('ef-desc').value.trim(),
          });
          Toast.success('Solicitud actualizada');
          document.getElementById('matching-modal')?.remove();
          await this.renderTab();
        } catch (err) {
          Toast.error(err.message);
          btn.disabled = false;
        }
      });
    } catch (err) {
      document.getElementById('matching-modal-body').innerHTML =
        `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ── Solicitar tutoría (estudiante) ──────────────────────── */
  renderCreateForm(container) {
    container.innerHTML = `
      <div class="card" style="max-width:600px;margin:0 auto">
        <h2 class="card__title">Nueva Solicitud de Tutoría</h2>
        <form id="create-match-form" class="form">
          <label class="form__label">Materia *</label>
          <input type="text" id="mf-subject" class="form__input" required maxlength="255" placeholder="Ej. Matemáticas, Física...">
          <label class="form__label">Nivel *</label>
          <select id="mf-level" class="form__input">
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
          <label class="form__label">Descripción</label>
          <textarea id="mf-desc" class="form__input" rows="3" style="resize:vertical" placeholder="Describe qué necesitas aprender"></textarea>
          <label class="form__label">Horario preferido</label>
          <select id="mf-schedule" class="form__input">
            <option value="">Sin preferencia</option>
            <option value="morning">Mañana</option>
            <option value="afternoon">Tarde</option>
            <option value="evening">Noche</option>
            <option value="weekend">Fin de semana</option>
          </select>
          <label class="form__label">Idioma preferido</label>
          <input type="text" id="mf-language" class="form__input" maxlength="100" placeholder="Ej. Español">
          <label class="form__label">Modalidad</label>
          <select id="mf-modality" class="form__input">
            <option value="">Sin preferencia</option>
            <option value="virtual">Virtual</option>
            <option value="in-person">Presencial</option>
            <option value="hybrid">Híbrida</option>
          </select>
          <label class="form__label">Precio máximo por hora</label>
          <input type="number" id="mf-price" class="form__input" min="0" placeholder="0">
          <div style="display:flex;gap:12px;margin-top:16px">
            <button type="submit" class="btn btn--primary">Crear Solicitud</button>
            <button type="button" id="mf-cancel" class="btn btn--secondary">Cancelar</button>
          </div>
        </form>
      </div>`;

    container.querySelector('#mf-cancel').addEventListener('click', () => {
      document.querySelector('[data-tab="requests"]')?.click();
    });

    container.querySelector('#create-match-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        await MatchingService.createRequest({
          subject: document.getElementById('mf-subject').value.trim(),
          level: document.getElementById('mf-level').value,
          description: document.getElementById('mf-desc').value.trim(),
          preferred_schedule: document.getElementById('mf-schedule').value,
          preferred_language: document.getElementById('mf-language').value.trim(),
          modality: document.getElementById('mf-modality').value,
          max_price: parseInt(document.getElementById('mf-price').value, 10) || 0,
        });
        Toast.success('Solicitud de tutoría creada');
        document.querySelector('[data-tab="requests"]')?.click();
        this.updateMatchesBadge();
      } catch (err) {
        Toast.error(err.message);
        btn.disabled = false;
      }
    });
  },

  /* ── Matches: tutorías del tutor / tutores interesados del alumno ── */
  async renderMyMatches(container) {
    try {
      const matches = await MatchingService.getUserMatches();

      // Al abrir la pestaña, el estudiante marca los matches como vistos.
      if (!this._isTutor) {
        const suggestedIds = matches.filter(m => m.status === 'suggested').map(m => m.id);
        this.markSeen(suggestedIds);
        document.querySelector('.tab-btn[data-tab="mymatches"] .tab-badge')?.remove();
      }

      if (!matches.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>${this._isTutor
            ? 'Todavía no te has ofrecido para ninguna tutoría.'
            : 'Aún ningún tutor se ha ofrecido para tus solicitudes.'}</p>
        </div>`;
        return;
      }
      container.innerHTML = `<div class="courses-grid">${matches.map(m => this.matchCard(m)).join('')}</div>`;

      if (this._isTutor) {
        // El tutor abre el detalle completo al pulsar la tarjeta.
        container.querySelectorAll('.course-card').forEach(card => {
          card.style.cursor = 'pointer';
          card.addEventListener('click', () =>
            this.showMatchDetail(card.dataset.request, card.dataset.student));
        });
      } else {
        container.querySelectorAll('.view-tutor-btn').forEach(btn =>
          btn.addEventListener('click', () => this.showTutorProfile(btn.dataset.tutor)));
        container.querySelectorAll('.accept-match-btn').forEach(btn =>
          btn.addEventListener('click', () => this.respondMatch(btn.dataset.id, 'accept', btn)));
        container.querySelectorAll('.reject-match-btn').forEach(btn =>
          btn.addEventListener('click', () => this.respondMatch(btn.dataset.id, 'reject', btn)));
      }
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') {
        container.innerHTML = `<p class="empty-state" style="padding:20px;color:var(--danger)">${err.message}</p>`;
      }
    }
  },

  matchCard(m) {
    const st = MATCH_STATUS[m.status] || { label: m.status, cls: 'badge--secondary' };
    const canRespond = !this._isTutor && m.status === 'suggested';
    return `
      <div class="course-card" data-id="${m.id}" data-request="${m.request_id}"
           data-student="${m.student_id}" data-tutor="${m.tutor_id}">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(m.subject)}</h3>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        <div class="course-card__meta">
          <span class="tag tag--level">${LEVELS[m.level] || m.level}</span>
          ${m.score != null ? `<span class="tag">Compatibilidad ${Math.round(m.score)}%</span>` : ''}
        </div>
        ${this._isTutor
          ? '<p class="course-card__hint" style="font-size:0.75rem;color:var(--text-secondary);margin-top:6px">Haz clic para ver los detalles</p>'
          : `<div class="course-card__actions">
              <button class="btn btn--small btn--secondary view-tutor-btn" data-tutor="${m.tutor_id}">Ver perfil del tutor</button>
              ${canRespond
                ? `<button class="btn btn--small btn--primary accept-match-btn" data-id="${m.id}" data-tutor="${m.tutor_id}">Aceptar y contactar</button>
                   <button class="btn btn--small btn--danger reject-match-btn" data-id="${m.id}">Rechazar</button>`
                : ''}
            </div>`}
      </div>`;
  },

  async respondMatch(matchId, action, btn) {
    const card = btn.closest('.course-card');
    card?.querySelectorAll('button').forEach(b => (b.disabled = true));
    try {
      if (action === 'accept') {
        await MatchingService.accept(matchId);
        // Al aceptar, abrimos el chat con el tutor (reutilizando el existente
        // si ya hay uno) y dejamos un saludo opcional listo para enviar.
        try {
          const me = Auth.getUser();
          const tutorId = btn.dataset.tutor;
          sessionStorage.setItem('sc_chat_prefill',
            '¡Hola! ¿Cómo estás? Muchas gracias por estar interesado en ayudarme.');
          const conv = await ChatService.createConversation([me.id, tutorId]);
          Toast.success('¡Tutor aceptado! Abriendo chat para contactarlo...');
          window.location.hash = `#/chat/${conv._id}`;
          return;
        } catch (chatErr) {
          sessionStorage.removeItem('sc_chat_prefill');
          Toast.error('Tutor aceptado, pero no se pudo abrir el chat: ' + chatErr.message);
        }
      } else {
        await MatchingService.reject(matchId);
        Toast.success('Oferta rechazada');
      }
      await this.renderTab();
    } catch (err) {
      Toast.error(err.message);
      card?.querySelectorAll('button').forEach(b => (b.disabled = false));
    }
  },

  /* ── Detalle de la tutoría (vista del tutor) ─────────────── */
  async showMatchDetail(requestId, studentId) {
    this.openModal('Detalle de la tutoría', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    try {
      const req = await MatchingService.getById(requestId);
      const student = studentId
        ? await UserService.getById(studentId).catch(() => null)
        : null;
      const st = REQ_STATUS[req.status] || { label: req.status, cls: 'badge--secondary' };
      const created = req.created_at ? new Date(req.created_at).toLocaleString('es') : '';
      document.getElementById('matching-modal-body').innerHTML = `
        <div class="course-detail">
          <div class="course-detail__badges">
            <span class="tag tag--level">${LEVELS[req.level] || req.level}</span>
            <span class="badge ${st.cls}" style="margin-left:auto">${st.label}</span>
          </div>
          <h2 class="course-detail__title">${this.esc(req.subject)}</h2>
          <p class="course-detail__desc">${this.esc(req.description || 'Sin descripción.')}</p>
          ${created ? `<p style="font-size:0.8rem;color:var(--text-secondary)">Solicitada el ${created}</p>` : ''}
          <div class="card" style="margin-top:16px">
            <h3 class="card__title">Estudiante</h3>
            ${student
              ? `<p>${this.esc(student.name)}</p>
                 <p class="card__email">${this.esc(student.email)}</p>
                 ${(student.skills || []).length ? `<div class="tags" style="margin-top:8px">${student.skills.map(s => `<span class="tag">${this.esc(s)}</span>`).join('')}</div>` : ''}
                 <button class="btn btn--small btn--primary" id="md-chat" style="margin-top:12px" data-uid="${student.id}">&#128172; Enviar mensaje</button>`
              : '<p style="color:var(--text-secondary)">Información del estudiante no disponible.</p>'}
          </div>
        </div>`;

      document.getElementById('md-chat')?.addEventListener('click', () =>
        this.openChatWith(student.id));
    } catch (err) {
      document.getElementById('matching-modal-body').innerHTML =
        `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ── Perfil del tutor (vista del estudiante) ─────────────── */
  async showTutorProfile(tutorId) {
    this.openModal('Perfil del tutor', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    try {
      const u = await UserService.getById(tutorId);
      document.getElementById('matching-modal-body').innerHTML = `
        <div class="course-detail">
          <h2 class="course-detail__title">${this.esc(u.name)}</h2>
          <p class="card__email">${this.esc(u.email)}</p>
          ${(u.skills || []).length ? `<div class="tags" style="margin-top:10px">${u.skills.map(s => `<span class="tag">${this.esc(s)}</span>`).join('')}</div>` : ''}
          ${(u.interests || []).length ? `<div class="tags" style="margin-top:8px">${u.interests.map(i => `<span class="tag tag--outline">${this.esc(i)}</span>`).join('')}</div>` : ''}
          <button class="btn btn--primary" id="mt-chat" style="margin-top:16px">&#128172; Enviar mensaje</button>
        </div>`;
      document.getElementById('mt-chat')?.addEventListener('click', () =>
        this.openChatWith(tutorId));
    } catch (err) {
      document.getElementById('matching-modal-body').innerHTML =
        '<p style="color:var(--danger)">Perfil del tutor no disponible.</p>';
    }
  },

  async openChatWith(userId) {
    try {
      const me = Auth.getUser();
      const conv = await ChatService.createConversation([me.id, userId]);
      document.getElementById('matching-modal')?.remove();
      window.location.hash = `#/chat/${conv._id}`;
    } catch (err) {
      Toast.error('No se pudo abrir el chat: ' + err.message);
    }
  },

  /* ── Modal compartido ────────────────────────────────────── */
  openModal(title, bodyHtml) {
    document.getElementById('matching-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'matching-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">${this.esc(title)}</h3>
          <button class="modal__close" id="matching-modal-close">&times;</button>
        </div>
        <div class="modal__body" id="matching-modal-body">${bodyHtml}</div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#matching-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};
