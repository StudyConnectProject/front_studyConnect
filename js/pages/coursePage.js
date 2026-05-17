import { CourseService } from '../services/courseService.js';
import { UserService } from '../services/userService.js';
import { Auth } from '../utils/auth.js';
import { Toast } from '../components/toast.js';

const LEVELS = { beginner: 'Principiante', intermediate: 'Intermedio', advanced: 'Avanzado' };
const STATUS_LABELS = { active: 'Activo', inactive: 'Inactivo', finished: 'Finalizado' };

export const CoursePage = {
  _tab: 'list',
  _enrolledIds: new Set(),

  async render() {
    const user = Auth.getUser();
    const role = user?.role?.toLowerCase() ||
      (user?.roles?.[0] || '').toLowerCase();
    const isTutor = role === 'tutor' || role === 'admin';

    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page">
        <div class="courses-header">
          <h1 class="courses-title">${isTutor ? 'Gestión de Cursos' : 'Cursos'}</h1>
          <div class="courses-tabs">
            ${isTutor
              ? `<button class="tab-btn tab-btn--active" data-tab="list">Mis Cursos</button>
                 <button class="tab-btn" data-tab="create">+ Crear Curso</button>`
              : `<button class="tab-btn tab-btn--active" data-tab="explore">Explorar</button>
                 <button class="tab-btn" data-tab="enrolled">Mis Inscripciones</button>`
            }
          </div>
        </div>
        <div id="courses-content"></div>
      </div>`;

    main.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
        btn.classList.add('tab-btn--active');
        this._tab = btn.dataset.tab;
        this.renderTab(isTutor);
      });
    });

    if (!isTutor) {
      try {
        const ids = await CourseService.getMyEnrollments();
        this._enrolledIds = new Set(ids);
      } catch { this._enrolledIds = new Set(); }
    }

    this._tab = isTutor ? 'list' : 'explore';
    await this.renderTab(isTutor);
  },

  async renderTab(isTutor) {
    const content = document.getElementById('courses-content');
    if (!content) return;
    content.innerHTML = '<div class="loader" style="padding:30px;text-align:center">Cargando...</div>';

    if (isTutor) {
      if (this._tab === 'list') await this.renderTutorCourses(content);
      else this.renderCreateForm(content);
    } else {
      if (this._tab === 'explore') await this.renderExploreCourses(content);
      else await this.renderEnrolled(content);
    }
  },

  /* ── TUTOR: lista sus cursos ─────────────────────────────── */
  async renderTutorCourses(container) {
    const user = Auth.getUser();
    try {
      const data = await CourseService.list({ tutorId: user.id, pageSize: 50 });
      const courses = data.items || [];
      if (!courses.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>No tienes cursos creados aún.</p>
          <button class="btn btn--primary" style="margin-top:16px" id="go-create">Crear mi primer curso</button>
        </div>`;
        container.querySelector('#go-create')?.addEventListener('click', () => {
          document.querySelector('[data-tab="create"]')?.click();
        });
        return;
      }
      container.innerHTML = `<div class="courses-grid">${courses.map(c => this.tutorCourseCard(c)).join('')}</div>`;
      this.bindTutorCardActions(container);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message);
    }
  },

  tutorCourseCard(c) {
    const statusClass = c.status === 'active' ? 'badge--success' : c.status === 'inactive' ? 'badge--warning' : 'badge--secondary';
    const desc = c.description || '';
    const shortDesc = desc.length > 120 ? desc.substring(0, 120) + '…' : desc;
    return `
      <div class="course-card" data-id="${c.id}">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(c.title)}</h3>
          <span class="badge ${statusClass}">${STATUS_LABELS[c.status] || c.status}</span>
        </div>
        ${shortDesc ? `<p class="course-card__desc">${this.esc(shortDesc)}</p>` : ''}
        <div class="course-card__meta">
          <span class="tag tag--category">${this.esc(c.category)}</span>
          <span class="tag tag--level">${LEVELS[c.level] || c.level}</span>
        </div>
        <p class="course-card__enrolled">&#128100; ${c.enrolled_count ?? 0} estudiantes</p>
        <div class="course-card__actions">
          ${c.status !== 'active'
            ? `<button class="btn btn--small btn--primary publish-btn" data-id="${c.id}">Activar</button>`
            : `<button class="btn btn--small btn--secondary inactive-btn" data-id="${c.id}">Desactivar</button>`
          }
          <button class="btn btn--small btn--secondary edit-btn" data-id="${c.id}">Editar</button>
          <button class="btn btn--small btn--secondary students-btn" data-id="${c.id}">Estudiantes</button>
          <button class="btn btn--small btn--secondary resources-btn" data-id="${c.id}" data-title="${this.esc(c.title)}">Recursos</button>
          <button class="btn btn--small btn--danger delete-btn" data-id="${c.id}">Eliminar</button>
        </div>
      </div>`;
  },

  bindTutorCardActions(container) {
    container.querySelectorAll('.publish-btn').forEach(btn =>
      btn.addEventListener('click', () => this.changeStatus(btn.dataset.id, 'active')));
    container.querySelectorAll('.inactive-btn').forEach(btn =>
      btn.addEventListener('click', () => this.changeStatus(btn.dataset.id, 'inactive')));
    container.querySelectorAll('.delete-btn').forEach(btn =>
      btn.addEventListener('click', () => this.deleteCourse(btn.dataset.id)));
    container.querySelectorAll('.edit-btn').forEach(btn =>
      btn.addEventListener('click', () => this.showEditModal(btn.dataset.id)));
    container.querySelectorAll('.students-btn').forEach(btn =>
      btn.addEventListener('click', () => this.showStudentsModal(btn.dataset.id)));
    container.querySelectorAll('.resources-btn').forEach(btn =>
      btn.addEventListener('click', () => this.showResourcesModal(btn.dataset.id, btn.dataset.title)));
  },

  async changeStatus(courseId, newStatus) {
    try {
      await CourseService.updateStatus(courseId, newStatus);
      Toast.success(`Curso ${newStatus === 'active' ? 'activado' : newStatus === 'inactive' ? 'desactivado' : 'finalizado'}`);
      await this.renderTab(true);
    } catch (err) { Toast.error(err.message); }
  },

  async deleteCourse(courseId) {
    if (!confirm('¿Seguro que quieres eliminar este curso? Esta acción no se puede deshacer.')) return;
    try {
      await CourseService.deleteCourse(courseId);
      Toast.success('Curso eliminado');
      await this.renderTab(true);
    } catch (err) { Toast.error(err.message); }
  },

  /* ── TUTOR: crear curso ───────────────────────────────────── */
  renderCreateForm(container) {
    const user = Auth.getUser();
    container.innerHTML = `
      <div class="card" style="max-width:600px;margin:0 auto">
        <h2 class="card__title">Nuevo Curso</h2>
        <form id="create-course-form" class="form">
          <label class="form__label">Título *</label>
          <input type="text" id="cf-title" class="form__input" required maxlength="255">
          <label class="form__label">Descripción *</label>
          <textarea id="cf-desc" class="form__input" rows="4" required style="resize:vertical"></textarea>
          <label class="form__label">Categoría *</label>
          <input type="text" id="cf-category" class="form__input" required maxlength="100">
          <label class="form__label">Nivel *</label>
          <select id="cf-level" class="form__input">
            <option value="beginner">Principiante</option>
            <option value="intermediate">Intermedio</option>
            <option value="advanced">Avanzado</option>
          </select>
          <div style="display:flex;gap:12px;margin-top:16px">
            <button type="submit" class="btn btn--primary">Crear Curso</button>
            <button type="button" id="cf-cancel" class="btn btn--secondary">Cancelar</button>
          </div>
        </form>
      </div>`;

    container.querySelector('#cf-cancel').addEventListener('click', () => {
      document.querySelector('[data-tab="list"]')?.click();
    });

    container.querySelector('#create-course-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      try {
        await CourseService.create({
          title: document.getElementById('cf-title').value.trim(),
          description: document.getElementById('cf-desc').value.trim(),
          category: document.getElementById('cf-category').value.trim(),
          level: document.getElementById('cf-level').value,
          tutor_id: user.id,
        });
        Toast.success('Curso creado exitosamente');
        document.querySelector('[data-tab="list"]')?.click();
      } catch (err) {
        Toast.error(err.message);
        btn.disabled = false;
      }
    });
  },

  /* ── STUDENT: explorar cursos ────────────────────────────── */
  async renderExploreCourses(container) {
    container.innerHTML = `
      <div class="courses-search-bar">
        <input type="text" id="explore-q" class="form__input" placeholder="Buscar cursos..." style="max-width:340px">
        <select id="explore-level" class="form__input" style="max-width:180px">
          <option value="">Todos los niveles</option>
          <option value="beginner">Principiante</option>
          <option value="intermediate">Intermedio</option>
          <option value="advanced">Avanzado</option>
        </select>
        <button id="explore-search-btn" class="btn btn--primary">Buscar</button>
      </div>
      <div id="explore-results" class="courses-grid"></div>`;

    const doSearch = async () => {
      const q = document.getElementById('explore-q').value.trim();
      const level = document.getElementById('explore-level').value;
      const resultsEl = document.getElementById('explore-results');
      resultsEl.innerHTML = '<div class="loader" style="padding:20px;text-align:center">Buscando...</div>';
      try {
        const data = q
          ? await CourseService.search({ q })
          : await CourseService.list({ status: 'active', level: level || undefined });
        const courses = (data.items || []).filter(c => !level || c.level === level);
        this.renderCourseGrid(resultsEl, courses, false);
      } catch (err) { if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message); }
    };

    container.querySelector('#explore-search-btn').addEventListener('click', doSearch);
    container.querySelector('#explore-q').addEventListener('keydown', (e) => { if (e.key === 'Enter') doSearch(); });
    await doSearch();
  },

  /* ── STUDENT: mis inscripciones ──────────────────────────── */
  async renderEnrolled(container) {
    try {
      const ids = await CourseService.getMyEnrollments();
      this._enrolledIds = new Set(ids);
      if (!ids.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>No estás inscrito en ningún curso.</p>
          <button class="btn btn--primary" style="margin-top:16px" id="go-explore">Explorar cursos</button>
        </div>`;
        container.querySelector('#go-explore')?.addEventListener('click', () => {
          document.querySelector('[data-tab="explore"]')?.click();
        });
        return;
      }
      const courses = await Promise.all(ids.map(id => CourseService.getById(id).catch(() => null)));
      const valid = courses.filter(Boolean);
      const grid = document.createElement('div');
      grid.className = 'courses-grid';
      container.innerHTML = '';
      container.appendChild(grid);
      this.renderCourseGrid(grid, valid, true);
    } catch (err) { if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message); }
  },

  renderCourseGrid(container, courses, enrolled) {
    if (!courses.length) {
      container.innerHTML = '<p class="empty-state" style="padding:20px">Sin resultados.</p>';
      return;
    }
    container.innerHTML = courses.map(c => this.studentCourseCard(c, enrolled || this._enrolledIds.has(c.id))).join('');
    container.querySelectorAll('.enroll-btn').forEach(btn => {
      btn.addEventListener('click', () => this.toggleEnroll(btn.dataset.id, btn));
    });
    container.querySelectorAll('.resources-view-btn').forEach(btn => {
      btn.addEventListener('click', () => this.showResourcesModal(btn.dataset.id, btn.dataset.title, true));
    });
  },

  studentCourseCard(c, isEnrolled) {
    return `
      <div class="course-card" data-id="${c.id}">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(c.title)}</h3>
          ${isEnrolled ? '<span class="badge badge--success">Inscrito</span>' : ''}
        </div>
        <p class="course-card__desc">${this.esc((c.description || '').substring(0, 100))}${(c.description || '').length > 100 ? '…' : ''}</p>
        <div class="course-card__meta">
          <span class="tag tag--category">${this.esc(c.category)}</span>
          <span class="tag tag--level">${LEVELS[c.level] || c.level}</span>
        </div>
        <p class="course-card__enrolled">&#128100; ${c.enrolled_count ?? 0} estudiantes</p>
        <div class="course-card__actions">
          ${isEnrolled
            ? `<button class="btn btn--small btn--secondary resources-view-btn" data-id="${c.id}" data-title="${this.esc(c.title)}">Ver recursos</button>
               <button class="btn btn--small btn--danger enroll-btn" data-id="${c.id}" data-enrolled="true">Cancelar inscripción</button>`
            : `<button class="btn btn--small btn--primary enroll-btn" data-id="${c.id}" data-enrolled="false">Inscribirse</button>`
          }
        </div>
      </div>`;
  },

  async toggleEnroll(courseId, btn) {
    const isEnrolled = btn.dataset.enrolled === 'true';
    btn.disabled = true;
    try {
      if (isEnrolled) {
        await CourseService.cancelEnrollment(courseId);
        this._enrolledIds.delete(courseId);
        Toast.success('Inscripción cancelada');
      } else {
        await CourseService.enroll(courseId);
        this._enrolledIds.add(courseId);
        Toast.success('¡Inscripción exitosa!');
      }
      await this.renderTab(false);
    } catch (err) {
      Toast.error(err.message);
      btn.disabled = false;
    }
  },

  /* ── Editar curso ────────────────────────────────────────── */
  async showEditModal(courseId) {
    this.openModal('Editar Curso', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    try {
      const c = await CourseService.getById(courseId);
      document.getElementById('modal-body').innerHTML = `
        <form id="edit-course-form" class="form">
          <label class="form__label">Título *</label>
          <input type="text" id="ec-title" class="form__input" value="${this.esc(c.title)}" required maxlength="255">
          <label class="form__label">Descripción *</label>
          <textarea id="ec-desc" class="form__input" rows="4" required style="resize:vertical">${this.esc(c.description || '')}</textarea>
          <label class="form__label">Categoría *</label>
          <input type="text" id="ec-category" class="form__input" value="${this.esc(c.category)}" required maxlength="100">
          <label class="form__label">Nivel *</label>
          <select id="ec-level" class="form__input">
            <option value="beginner" ${c.level === 'beginner' ? 'selected' : ''}>Principiante</option>
            <option value="intermediate" ${c.level === 'intermediate' ? 'selected' : ''}>Intermedio</option>
            <option value="advanced" ${c.level === 'advanced' ? 'selected' : ''}>Avanzado</option>
          </select>
          <div style="display:flex;gap:12px;margin-top:16px">
            <button type="submit" class="btn btn--primary">Guardar cambios</button>
            <button type="button" id="ec-cancel" class="btn btn--secondary">Cancelar</button>
          </div>
        </form>`;

      document.getElementById('ec-cancel').addEventListener('click', () => {
        document.getElementById('course-modal')?.remove();
      });

      document.getElementById('edit-course-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        const btn = e.target.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
          await CourseService.update(courseId, {
            title: document.getElementById('ec-title').value.trim(),
            description: document.getElementById('ec-desc').value.trim(),
            category: document.getElementById('ec-category').value.trim(),
            level: document.getElementById('ec-level').value,
          });
          Toast.success('Curso actualizado');
          document.getElementById('course-modal')?.remove();
          await this.renderTab(true);
        } catch (err) {
          Toast.error(err.message);
          btn.disabled = false;
        }
      });
    } catch (err) {
      document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ── Modales compartidos ─────────────────────────────────── */
  async showStudentsModal(courseId) {
    this.openModal('Estudiantes inscritos', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    await this.loadStudentsInModal(courseId);
  },

  async loadStudentsInModal(courseId) {
    const bodyEl = document.getElementById('modal-body');
    try {
      const data = await CourseService.getStudents(courseId);
      const enrollments = data.items || [];

      // Fetch all profiles in parallel
      const profiles = await Promise.all(
        enrollments.map(e => UserService.getById(e.student_id).catch(() => null))
      );

      const listHtml = enrollments.length
        ? enrollments.map((e, i) => {
            const p = profiles[i];
            const name = p?.name || e.student_id;
            const email = p?.email || '';
            return `
              <div class="student-item">
                <div class="student-item__info">
                  <span class="student-item__name">${this.esc(name)}</span>
                  ${email ? `<span class="student-item__email">${this.esc(email)}</span>` : ''}
                </div>
                <button class="btn btn--small btn--danger remove-student-btn"
                  data-course="${courseId}" data-uid="${e.student_id}">Eliminar</button>
              </div>`;
          }).join('')
        : '<p class="empty-state" style="padding:16px">Sin estudiantes inscritos.</p>';

      bodyEl.innerHTML = `
        <div class="student-list">${listHtml}</div>
        <details class="resource-add-panel" style="margin-top:16px">
          <summary class="btn btn--small btn--primary" style="cursor:pointer;display:inline-block">+ Agregar estudiante</summary>
          <div style="margin-top:10px">
            <input type="text" id="add-student-filter" class="form__input" placeholder="Filtrar por nombre o correo..." autocomplete="off">
            <div id="add-student-list" class="add-student-list" style="margin-top:8px"></div>
          </div>
        </details>`;

      // Bind remove buttons
      bodyEl.querySelectorAll('.remove-student-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            await CourseService.removeStudent(btn.dataset.course, btn.dataset.uid);
            Toast.success('Estudiante eliminado del curso');
            await this.loadStudentsInModal(courseId);
          } catch (err) { Toast.error(err.message); btn.disabled = false; }
        });
      });

      // Load user list when details opens
      const details = bodyEl.querySelector('details');
      let usersLoaded = false;
      details.addEventListener('toggle', async () => {
        if (details.open && !usersLoaded) {
          usersLoaded = true;
          await this.loadAddStudentList(courseId, enrollments.map(e => e.student_id));
        }
      });

      bodyEl.querySelector('#add-student-filter')?.addEventListener('input', (e) => {
        this.filterAddStudentList(e.target.value.trim().toLowerCase());
      });

    } catch (err) {
      bodyEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  async loadAddStudentList(courseId, enrolledIds) {
    const listEl = document.getElementById('add-student-list');
    if (!listEl) return;
    listEl.innerHTML = '<div class="loader" style="padding:10px;text-align:center">Cargando...</div>';
    try {
      const users = await UserService.search({ role: 'student' });
      this._addStudentUsers = users.filter(u => !enrolledIds.includes(u.id));
      this.renderAddStudentList(courseId, this._addStudentUsers);
    } catch (err) { listEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`; }
  },

  renderAddStudentList(courseId, users) {
    const listEl = document.getElementById('add-student-list');
    if (!listEl) return;
    if (!users.length) { listEl.innerHTML = '<p class="empty-state" style="padding:8px">Sin usuarios disponibles.</p>'; return; }
    listEl.innerHTML = users.map(u => `
      <div class="student-item">
        <div class="student-item__info">
          <span class="student-item__name">${this.esc(u.name)}</span>
          <span class="student-item__email">${this.esc(u.email)}</span>
        </div>
        <button class="btn btn--small btn--primary add-student-btn"
          data-course="${courseId}" data-uid="${u.id}">Agregar</button>
      </div>`).join('');

    listEl.querySelectorAll('.add-student-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        btn.disabled = true;
        try {
          await CourseService.addStudent(btn.dataset.course, btn.dataset.uid);
          Toast.success('Estudiante agregado al curso');
          await this.loadStudentsInModal(courseId);
        } catch (err) { Toast.error(err.message); btn.disabled = false; }
      });
    });
  },

  filterAddStudentList(query) {
    if (!this._addStudentUsers) return;
    const filtered = query
      ? this._addStudentUsers.filter(u =>
          u.name?.toLowerCase().includes(query) || u.email?.toLowerCase().includes(query))
      : this._addStudentUsers;
    const courseId = document.querySelector('.add-student-btn')?.dataset.course ||
      document.querySelector('[data-course]')?.dataset.course;
    if (courseId) this.renderAddStudentList(courseId, filtered);
  },

  async showResourcesModal(courseId, title, readOnly = false) {
    this.openModal(`Recursos — ${title}`, '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    await this.loadResourcesInModal(courseId, readOnly);
  },

  async loadResourcesInModal(courseId, readOnly) {
    try {
      const resources = await CourseService.getResources(courseId);
      const listHtml = resources.length
        ? resources.map(r => `
          <div class="resource-item" data-rid="${r.id}">
            <a href="${this.esc(r.url)}" target="_blank" rel="noopener noreferrer" class="resource-item__link">
              ${this.resourceIcon(r.type)} ${this.esc(r.title)}
            </a>
            ${r.description ? `<span class="resource-item__desc">${this.esc(r.description)}</span>` : ''}
            ${!readOnly ? `<button class="btn btn--small btn--danger del-resource-btn" data-rid="${r.id}" style="margin-left:auto">Eliminar</button>` : ''}
          </div>`).join('')
        : '<p class="empty-state">Sin recursos aún.</p>';

      const addFormHtml = !readOnly ? `
        <details class="resource-add-panel" style="margin-top:16px">
          <summary class="btn btn--small btn--secondary" style="cursor:pointer;display:inline-block">+ Agregar recurso</summary>
          <form id="add-resource-form" class="form" style="margin-top:12px">
            <input type="text" id="res-title" class="form__input" placeholder="Título *" required>
            <input type="url" id="res-url" class="form__input" placeholder="URL *" required style="margin-top:8px">
            <input type="text" id="res-desc" class="form__input" placeholder="Descripción (opcional)" style="margin-top:8px">
            <select id="res-type" class="form__input" style="margin-top:8px">
              <option value="link">Enlace</option>
              <option value="video">Video</option>
              <option value="document">Documento</option>
              <option value="file">Archivo</option>
            </select>
            <button type="submit" class="btn btn--primary btn--small" style="margin-top:8px">Guardar</button>
          </form>
        </details>` : '';

      document.getElementById('modal-body').innerHTML = `<div class="resource-list">${listHtml}</div>${addFormHtml}`;

      if (!readOnly) {
        document.querySelectorAll('.del-resource-btn').forEach(btn =>
          btn.addEventListener('click', async () => {
            try {
              await CourseService.deleteResource(courseId, btn.dataset.rid);
              Toast.success('Recurso eliminado');
              await this.loadResourcesInModal(courseId, readOnly);
            } catch (err) { Toast.error(err.message); }
          }));

        document.getElementById('add-resource-form')?.addEventListener('submit', async (e) => {
          e.preventDefault();
          try {
            await CourseService.addResource(courseId, {
              title: document.getElementById('res-title').value.trim(),
              url: document.getElementById('res-url').value.trim(),
              description: document.getElementById('res-desc').value.trim() || null,
              type: document.getElementById('res-type').value,
            });
            Toast.success('Recurso agregado');
            await this.loadResourcesInModal(courseId, readOnly);
          } catch (err) { Toast.error(err.message); }
        });
      }
    } catch (err) {
      document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  resourceIcon(type) {
    return { video: '&#127909;', document: '&#128196;', file: '&#128190;', link: '&#128279;' }[type] || '&#128279;';
  },

  openModal(title, bodyHtml) {
    document.getElementById('course-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'course-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">${this.esc(title)}</h3>
          <button class="modal__close" id="modal-close-btn">&times;</button>
        </div>
        <div class="modal__body" id="modal-body">${bodyHtml}</div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#modal-close-btn').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};
