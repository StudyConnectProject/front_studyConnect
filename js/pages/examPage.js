import { ExamService } from '../services/examService.js';
import { CourseService } from '../services/courseService.js';
import { Auth } from '../utils/auth.js';
import { Toast } from '../components/toast.js';

const STATUS_LABELS = { draft: 'Borrador', published: 'Publicado', closed: 'Cerrado' };
const STATUS_CLASS  = { draft: 'badge--warning', published: 'badge--success', closed: 'badge--secondary' };
const Q_TYPE_LABELS = { multiple_choice: 'Opción múltiple', true_false: 'Verdadero / Falso', open: 'Respuesta abierta' };

export const ExamPage = {
  _tab: 'list',

  async render() {
    const user = Auth.getUser();
    const role = (user?.role || user?.roles?.[0] || '').toLowerCase();
    const isTutor = role === 'tutor' || role === 'admin';

    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page">
        <div class="courses-header">
          <h1 class="courses-title">&#128221; ${isTutor ? 'Gestión de Exámenes' : 'Exámenes'}</h1>
          <div class="courses-tabs">
            ${isTutor
              ? `<button class="tab-btn tab-btn--active" data-tab="list">Mis Exámenes</button>
                 <button class="tab-btn" data-tab="create">+ Crear Examen</button>`
              : `<button class="tab-btn tab-btn--active" data-tab="available">Disponibles</button>
                 <button class="tab-btn" data-tab="history">Mis Resultados</button>`
            }
          </div>
        </div>
        <div id="exam-content"></div>
      </div>`;

    main.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        main.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('tab-btn--active'));
        btn.classList.add('tab-btn--active');
        this._tab = btn.dataset.tab;
        this.renderTab(isTutor);
      });
    });

    this._tab = isTutor ? 'list' : 'available';
    await this.renderTab(isTutor);
  },

  async renderTab(isTutor) {
    const content = document.getElementById('exam-content');
    if (!content) return;
    content.innerHTML = '<div class="loader" style="padding:30px;text-align:center">Cargando...</div>';
    if (isTutor) {
      if (this._tab === 'list')   await this.renderTutorExams(content);
      else                        this.renderCreateForm(content);
    } else {
      if (this._tab === 'available') await this.renderAvailableExams(content);
      else                           await this.renderStudentHistory(content);
    }
  },

  /* ════════════════════════ TUTOR ════════════════════════════ */

  async renderTutorExams(container) {
    const user = Auth.getUser();
    try {
      const exams = await ExamService.list({ tutor_id: user.id });
      if (!exams.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>No tienes exámenes creados aún.</p>
          <button class="btn btn--primary" style="margin-top:16px" id="go-create-exam">Crear mi primer examen</button>
        </div>`;
        container.querySelector('#go-create-exam')?.addEventListener('click', () => {
          document.querySelector('[data-tab="create"]')?.click();
        });
        return;
      }
      container.innerHTML = `<div class="courses-grid">${exams.map(e => this.tutorExamCard(e)).join('')}</div>`;
      this.bindTutorCardActions(container);
      // Card click → exam detail
      container.querySelectorAll('.exam-card').forEach(card => {
        card.style.cursor = 'pointer';
        card.addEventListener('click', (e) => {
          if (e.target.closest('button')) return;
          this.showExamDetailModal(card.dataset.id);
        });
      });
    } catch (err) { Toast.error(err.message); }
  },

  tutorExamCard(e) {
    const sc = STATUS_CLASS[e.status] || 'badge--secondary';
    const canPublish = e.status === 'draft';
    const canClose   = e.status === 'published';
    const canDelete  = e.status === 'draft';
    return `
      <div class="course-card exam-card" data-id="${e.id}">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(e.title)}</h3>
          <span class="badge ${sc}">${STATUS_LABELS[e.status] || e.status}</span>
        </div>
        ${e.description ? `<p class="course-card__desc">${this.esc(e.description.substring(0,120))}${e.description.length>120?'…':''}</p>` : ''}
        <div class="exam-card__meta">
          ${e.time_limit_min ? `<span class="tag tag--level">⏱ ${e.time_limit_min} min</span>` : ''}
          <span class="tag tag--category">Nota mínima: ${e.passing_score ?? 60}%</span>
        </div>
        <div class="course-card__actions">
          ${canPublish ? `<button class="btn btn--small btn--primary exam-publish-btn" data-id="${e.id}">Publicar</button>` : ''}
          ${canClose   ? `<button class="btn btn--small btn--secondary exam-close-btn" data-id="${e.id}">Cerrar</button>` : ''}
          <button class="btn btn--small btn--secondary exam-edit-btn" data-id="${e.id}">Editar</button>
          <button class="btn btn--small btn--secondary exam-questions-btn" data-id="${e.id}" data-status="${e.status}">Preguntas</button>
          <button class="btn btn--small btn--secondary exam-results-btn" data-id="${e.id}" data-title="${this.esc(e.title)}">Resultados</button>
          ${canDelete ? `<button class="btn btn--small btn--danger exam-delete-btn" data-id="${e.id}">Eliminar</button>` : ''}
        </div>
      </div>`;
  },

  bindTutorCardActions(container) {
    container.querySelectorAll('.exam-publish-btn').forEach(b =>
      b.addEventListener('click', () => this.changeStatus(b.dataset.id, 'published')));
    container.querySelectorAll('.exam-close-btn').forEach(b =>
      b.addEventListener('click', () => this.changeStatus(b.dataset.id, 'closed')));
    container.querySelectorAll('.exam-delete-btn').forEach(b =>
      b.addEventListener('click', () => this.deleteExam(b.dataset.id)));
    container.querySelectorAll('.exam-edit-btn').forEach(b =>
      b.addEventListener('click', () => this.showEditModal(b.dataset.id)));
    container.querySelectorAll('.exam-questions-btn').forEach(b =>
      b.addEventListener('click', () => this.showQuestionsModal(b.dataset.id, b.dataset.status)));
    container.querySelectorAll('.exam-results-btn').forEach(b =>
      b.addEventListener('click', () => this.showResultsModal(b.dataset.id, b.dataset.title)));
  },

  async changeStatus(id, status) {
    try {
      if (status === 'published') {
        const exam = await ExamService.get(id);
        const questions = exam.questions || [];
        if (questions.length === 0) {
          Toast.error('No puedes publicar un examen sin preguntas. Agrega al menos una pregunta primero.');
          return;
        }
      }
      await ExamService.changeStatus(id, status);
      Toast.success(status === 'published' ? 'Examen publicado' : 'Examen cerrado');
      await this.renderTab(true);
    } catch (err) { Toast.error(err.message); }
  },

  async deleteExam(id) {
    if (!confirm('¿Eliminar este examen? Esta acción no se puede deshacer.')) return;
    try {
      await ExamService.remove(id);
      Toast.success('Examen eliminado');
      await this.renderTab(true);
    } catch (err) { Toast.error(err.message); }
  },

  /* ── Detalle del examen (tutor) ─────────────────────────── */
  async showExamDetailModal(examId) {
    this.openModal('Detalle del Examen', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>', true);
    try {
      const e = await ExamService.get(examId);
      const sc = STATUS_CLASS[e.status] || 'badge--secondary';
      const questions = e.questions || [];
      const totalPts = questions.reduce((s, q) => s + (q.points || 1), 0);
      const isDraft = e.status === 'draft';

      const qHtml = questions.length
        ? questions.map((q, i) => this.questionItem(q, i, examId, isDraft)).join('')
        : '<p class="empty-state" style="padding:12px">Sin preguntas aún.</p>';

      document.getElementById('modal-body').innerHTML = `
        <div style="display:flex;flex-wrap:wrap;gap:8px;align-items:center;margin-bottom:14px">
          <span class="badge ${sc}">${STATUS_LABELS[e.status] || e.status}</span>
          ${e.time_limit_min ? `<span class="tag tag--level">⏱ ${e.time_limit_min} min</span>` : ''}
          <span class="tag tag--category">Nota mínima: ${e.passing_score ?? 60}%</span>
          <span class="tag tag--category">${totalPts} punto${totalPts !== 1 ? 's' : ''} en total</span>
        </div>
        ${e.description ? `<p style="color:var(--text-secondary);margin-bottom:16px;line-height:1.5">${this.esc(e.description)}</p>` : ''}
        <h3 style="font-size:0.9rem;font-weight:700;text-transform:uppercase;letter-spacing:.05em;color:var(--text-secondary);margin-bottom:10px">
          ${questions.length} pregunta${questions.length !== 1 ? 's' : ''}
        </h3>
        <div id="questions-list">${qHtml}</div>
        ${isDraft ? `
        <hr style="margin:20px 0">
        <h3 style="font-size:1rem;font-weight:600;margin-bottom:12px">Añadir pregunta</h3>
        ${this.questionForm(examId)}` : ''}
        <div style="display:flex;flex-wrap:wrap;gap:8px;margin-top:20px;border-top:1px solid var(--border);padding-top:16px">
          ${isDraft ? `<button class="btn btn--primary" id="ed-publish">Publicar</button>` : ''}
          ${e.status === 'published' ? `<button class="btn btn--secondary" id="ed-close">Cerrar examen</button>` : ''}
          <button class="btn btn--secondary" id="ed-edit">Editar datos</button>
          <button class="btn btn--secondary" id="ed-results">Ver resultados</button>
        </div>`;

      if (isDraft) {
        this.bindAddQuestionForm(examId);
        document.getElementById('questions-list').querySelectorAll('.q-delete-btn').forEach(btn =>
          btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta pregunta?')) return;
            btn.disabled = true;
            try {
              await ExamService.deleteQuestion(examId, btn.dataset.qid);
              Toast.success('Pregunta eliminada');
              await this.showExamDetailModal(examId);
            } catch (err) { Toast.error(err.message); btn.disabled = false; }
          })
        );
      }

      document.getElementById('ed-publish')?.addEventListener('click', async () => {
        await this.changeStatus(examId, 'published');
        document.getElementById('exam-modal')?.remove();
      });
      document.getElementById('ed-close')?.addEventListener('click', async () => {
        await this.changeStatus(examId, 'closed');
        document.getElementById('exam-modal')?.remove();
      });
      document.getElementById('ed-edit')?.addEventListener('click', () => {
        document.getElementById('exam-modal')?.remove();
        this.showEditModal(examId);
      });
      document.getElementById('ed-results')?.addEventListener('click', () => {
        document.getElementById('exam-modal')?.remove();
        this.showResultsModal(examId, e.title);
      });
    } catch (err) {
      document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ── Crear examen ─────────────────────────────────────────── */
  renderCreateForm(container) {
    const user = Auth.getUser();
    container.innerHTML = `
      <div class="card" style="max-width:620px;margin:0 auto">
        <h2 class="card__title">Nuevo Examen</h2>
        <form id="create-exam-form" class="form">
          <label class="form__label">Curso *</label>
          <select id="ef-course" class="form__input" required>
            <option value="">Cargando cursos...</option>
          </select>
          <label class="form__label">Título *</label>
          <input type="text" id="ef-title" class="form__input" required maxlength="255">
          <label class="form__label">Descripción</label>
          <textarea id="ef-desc" class="form__input" rows="3" style="resize:vertical"></textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form__label">Tiempo límite (minutos)</label>
              <input type="number" id="ef-time" class="form__input" min="1" max="300" placeholder="Sin límite">
            </div>
            <div>
              <label class="form__label">Nota mínima (%)</label>
              <input type="number" id="ef-score" class="form__input" min="0" max="100" value="60">
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:16px">
            <button type="submit" class="btn btn--primary">Crear Examen</button>
            <button type="button" id="ef-cancel" class="btn btn--secondary">Cancelar</button>
          </div>
        </form>
      </div>`;

    // Cargar los cursos del tutor
    CourseService.list({ tutorId: user.id, pageSize: 100 }).then(data => {
      const sel = document.getElementById('ef-course');
      const courses = data.items || [];
      sel.innerHTML = courses.length
        ? `<option value="">Selecciona un curso</option>` + courses.map(c => `<option value="${c.id}">${this.esc(c.title)}</option>`).join('')
        : `<option value="">No tienes cursos creados</option>`;
    }).catch(() => {});

    container.querySelector('#ef-cancel').addEventListener('click', () => {
      document.querySelector('[data-tab="list"]')?.click();
    });

    container.querySelector('#create-exam-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      const courseId = document.getElementById('ef-course').value;
      if (!courseId) { Toast.error('Selecciona un curso'); btn.disabled = false; return; }
      try {
        const exam = await ExamService.create({
          title:          document.getElementById('ef-title').value.trim(),
          description:    document.getElementById('ef-desc').value.trim() || undefined,
          course_id:      courseId,
          time_limit_min: parseInt(document.getElementById('ef-time').value) || undefined,
          passing_score:  parseInt(document.getElementById('ef-score').value) || 60,
        });
        Toast.success('Examen creado — ahora añade preguntas');
        document.querySelector('[data-tab="list"]')?.click();
        setTimeout(() => this.showQuestionsModal(exam.id, 'draft'), 400);
      } catch (err) { Toast.error(err.message); btn.disabled = false; }
    });
  },

  /* ── Editar examen (modal) ───────────────────────────────── */
  async showEditModal(examId) {
    this.openModal('Editar Examen', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>');
    try {
      const e = await ExamService.get(examId);
      document.getElementById('modal-body').innerHTML = `
        <form id="edit-exam-form" class="form">
          <label class="form__label">Título *</label>
          <input type="text" id="ee-title" class="form__input" value="${this.esc(e.title)}" required>
          <label class="form__label">Descripción</label>
          <textarea id="ee-desc" class="form__input" rows="3" style="resize:vertical">${this.esc(e.description || '')}</textarea>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
            <div>
              <label class="form__label">Tiempo límite (min)</label>
              <input type="number" id="ee-time" class="form__input" min="1" max="300" value="${e.time_limit_min || ''}">
            </div>
            <div>
              <label class="form__label">Nota mínima (%)</label>
              <input type="number" id="ee-score" class="form__input" min="0" max="100" value="${e.passing_score ?? 60}">
            </div>
          </div>
          <div style="display:flex;gap:12px;margin-top:16px">
            <button type="submit" class="btn btn--primary">Guardar</button>
            <button type="button" id="ee-cancel" class="btn btn--secondary">Cancelar</button>
          </div>
        </form>`;

      document.getElementById('ee-cancel').addEventListener('click', () => document.getElementById('exam-modal')?.remove());
      document.getElementById('edit-exam-form').addEventListener('submit', async (ev) => {
        ev.preventDefault();
        const btn = ev.target.querySelector('[type="submit"]');
        btn.disabled = true;
        try {
          await ExamService.update(examId, {
            title:          document.getElementById('ee-title').value.trim(),
            description:    document.getElementById('ee-desc').value.trim() || null,
            time_limit_min: parseInt(document.getElementById('ee-time').value) || null,
            passing_score:  parseInt(document.getElementById('ee-score').value) || 60,
          });
          Toast.success('Examen actualizado');
          document.getElementById('exam-modal')?.remove();
          await this.renderTab(true);
        } catch (err) { Toast.error(err.message); btn.disabled = false; }
      });
    } catch (err) {
      document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ── Preguntas (modal) ───────────────────────────────────── */
  async showQuestionsModal(examId, examStatus) {
    this.openModal('Preguntas del Examen', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>', true);
    await this.loadQuestionsModal(examId, examStatus);
  },

  async loadQuestionsModal(examId, examStatus) {
    const bodyEl = document.getElementById('modal-body');
    const editable = examStatus === 'draft';
    try {
      const exam = await ExamService.get(examId);
      const questions = exam.questions || [];

      const questionsHtml = questions.length
        ? questions.map((q, i) => this.questionItem(q, i, examId, editable)).join('')
        : '<p class="empty-state" style="padding:12px">Sin preguntas. Añade la primera.</p>';

      bodyEl.innerHTML = `
        <div id="questions-list">${questionsHtml}</div>
        ${editable ? `
        <hr style="margin:20px 0">
        <h3 style="font-size:1rem;font-weight:600;margin-bottom:12px">Añadir pregunta</h3>
        ${this.questionForm(examId)}` : ''}`;

      if (editable) {
        this.bindAddQuestionForm(examId);
        bodyEl.querySelectorAll('.q-delete-btn').forEach(btn =>
          btn.addEventListener('click', async () => {
            if (!confirm('¿Eliminar esta pregunta?')) return;
            btn.disabled = true;
            try {
              await ExamService.deleteQuestion(examId, btn.dataset.qid);
              Toast.success('Pregunta eliminada');
              await this.loadQuestionsModal(examId, examStatus);
            } catch (err) { Toast.error(err.message); btn.disabled = false; }
          })
        );
      }
    } catch (err) {
      bodyEl.innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  questionItem(q, i, examId, editable) {
    const opts = (q.options || []).map(o =>
      `<li class="${o.is_correct ? 'q-option--correct' : ''}">${this.esc(o.option_text)}${o.is_correct ? ' ✓' : ''}</li>`
    ).join('');
    return `
      <div class="question-item">
        <div class="question-item__header">
          <span class="question-item__num">${i + 1}.</span>
          <span class="question-item__text">${this.esc(q.question_text)}</span>
          <span class="tag tag--level" style="margin-left:auto">${Q_TYPE_LABELS[q.question_type] || q.question_type}</span>
          <span class="tag tag--category">${q.points} pt${q.points !== 1 ? 's' : ''}</span>
          ${editable ? `<button class="btn btn--small btn--danger q-delete-btn" data-qid="${q.id}">✕</button>` : ''}
        </div>
        ${opts ? `<ul class="q-options">${opts}</ul>` : ''}
      </div>`;
  },

  questionForm(examId) {
    return `
      <form id="add-question-form" class="form">
        <label class="form__label">Pregunta *</label>
        <textarea id="qf-text" class="form__input" rows="2" required style="resize:vertical"></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px">
          <div>
            <label class="form__label">Tipo *</label>
            <select id="qf-type" class="form__input">
              <option value="multiple_choice">Opción múltiple</option>
              <option value="true_false">Verdadero / Falso</option>
              <option value="open">Respuesta abierta</option>
            </select>
          </div>
          <div>
            <label class="form__label">Puntos</label>
            <input type="number" id="qf-points" class="form__input" min="1" max="100" value="1">
          </div>
        </div>
        <div id="qf-options-section"></div>
        <button type="submit" class="btn btn--primary" style="margin-top:12px">Añadir pregunta</button>
      </form>`;
  },

  bindAddQuestionForm(examId) {
    const form     = document.getElementById('add-question-form');
    const typesSel = document.getElementById('qf-type');
    if (!form) return;

    const renderOptions = () => {
      const type = typesSel.value;
      const sec  = document.getElementById('qf-options-section');
      if (type === 'open') { sec.innerHTML = ''; return; }

      if (type === 'true_false') {
        sec.innerHTML = `
          <p class="form__label" style="margin-top:10px">Opciones</p>
          <div class="q-option-row">
            <input type="text" class="form__input qf-opt-text" value="Verdadero" readonly>
            <label class="q-correct-label"><input type="radio" name="qf-correct" value="0"> Correcta</label>
          </div>
          <div class="q-option-row">
            <input type="text" class="form__input qf-opt-text" value="Falso" readonly>
            <label class="q-correct-label"><input type="radio" name="qf-correct" value="1"> Correcta</label>
          </div>`;
        return;
      }

      // multiple_choice — 2 opciones iniciales + botón para añadir
      sec.innerHTML = `
        <p class="form__label" style="margin-top:10px">Opciones <small>(marca la correcta)</small></p>
        <div id="qf-opts-list">
          ${[0,1].map(i => `
            <div class="q-option-row">
              <input type="text" class="form__input qf-opt-text" placeholder="Opción ${i+1}">
              <label class="q-correct-label"><input type="radio" name="qf-correct" value="${i}"> Correcta</label>
            </div>`).join('')}
        </div>
        <button type="button" id="qf-add-opt" class="btn btn--small btn--secondary" style="margin-top:6px">+ Opción</button>`;

      document.getElementById('qf-add-opt').addEventListener('click', () => {
        const list = document.getElementById('qf-opts-list');
        const idx  = list.children.length;
        const row  = document.createElement('div');
        row.className = 'q-option-row';
        row.innerHTML = `
          <input type="text" class="form__input qf-opt-text" placeholder="Opción ${idx+1}">
          <label class="q-correct-label"><input type="radio" name="qf-correct" value="${idx}"> Correcta</label>
          <button type="button" class="btn btn--small btn--danger qf-rem-opt">✕</button>`;
        row.querySelector('.qf-rem-opt').addEventListener('click', () => row.remove());
        list.appendChild(row);
      });
    };

    typesSel.addEventListener('change', renderOptions);
    renderOptions();

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn  = form.querySelector('[type="submit"]');
      btn.disabled = true;
      const type = typesSel.value;

      let options = [];
      if (type !== 'open') {
        const texts    = [...document.querySelectorAll('.qf-opt-text')].map(i => i.value.trim());
        const correctV = document.querySelector('input[name="qf-correct"]:checked')?.value;
        if (texts.some(t => !t)) { Toast.error('Rellena todas las opciones'); btn.disabled = false; return; }
        if (correctV === undefined) { Toast.error('Marca la opción correcta'); btn.disabled = false; return; }
        options = texts.map((t, i) => ({ option_text: t, is_correct: String(i) === String(correctV) }));
      }

      const orderIndex = (document.querySelectorAll('.question-item').length);
      try {
        await ExamService.addQuestion(examId, {
          question_text: document.getElementById('qf-text').value.trim(),
          question_type: type,
          points:        parseInt(document.getElementById('qf-points').value) || 1,
          order_index:   orderIndex,
          options,
        });
        Toast.success('Pregunta añadida');
        await this.loadQuestionsModal(examId, 'draft');
      } catch (err) { Toast.error(err.message); btn.disabled = false; }
    });
  },

  /* ── Resultados del examen (tutor) ───────────────────────── */
  async showResultsModal(examId, title) {
    this.openModal(`Resultados — ${title}`, '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>', true);
    try {
      const attempts = await ExamService.getExamAttempts(examId);
      if (!attempts.length) {
        document.getElementById('modal-body').innerHTML = '<p class="empty-state" style="padding:16px">Ningún estudiante ha presentado este examen aún.</p>';
        return;
      }
      const rows = attempts.map(a => {
        const date = new Date(a.submitted_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
        const badge = a.passed
          ? '<span class="badge badge--success">Aprobado</span>'
          : '<span class="badge badge--danger">Reprobado</span>';
        return `<tr>
          <td>${this.esc(a.student_id.substring(0,8))}…</td>
          <td style="text-align:center;font-weight:600">${a.score}%</td>
          <td style="text-align:center">${badge}</td>
          <td style="text-align:center;font-size:0.8rem;color:var(--text-secondary)">${date}</td>
          <td style="text-align:center">
            <button class="btn btn--small btn--secondary view-attempt-btn" data-aid="${a.id}">Ver</button>
          </td>
        </tr>`;
      }).join('');

      document.getElementById('modal-body').innerHTML = `
        <table class="results-table">
          <thead><tr>
            <th>Estudiante</th><th>Puntaje</th><th>Estado</th><th>Fecha</th><th></th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>`;

      document.getElementById('modal-body').querySelectorAll('.view-attempt-btn').forEach(btn =>
        btn.addEventListener('click', () => this.showAttemptDetailModal(btn.dataset.aid))
      );
    } catch (err) {
      document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ════════════════════════ ESTUDIANTE ═══════════════════════ */

  async renderAvailableExams(container) {
    try {
      const ids = await CourseService.getMyEnrollments();
      if (!ids.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>No estás inscrito en ningún curso. Inscríbete primero para ver exámenes.</p>
          <a href="#/courses" class="btn btn--primary" style="margin-top:16px">Ver cursos</a>
        </div>`;
        return;
      }

      // Cargar exámenes publicados de todos los cursos inscritos en paralelo
      const allExams = (await Promise.all(
        ids.map(id => ExamService.list({ course_id: id, status: 'published' }).catch(() => []))
      )).flat();

      if (!allExams.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>No hay exámenes disponibles en tus cursos por ahora.</p>
        </div>`;
        return;
      }

      container.innerHTML = `<div class="courses-grid">${allExams.map(e => this.studentExamCard(e)).join('')}</div>`;
      container.querySelectorAll('.take-exam-btn').forEach(btn =>
        btn.addEventListener('click', () => this.startExam(btn.dataset.id))
      );
    } catch (err) { Toast.error(err.message); }
  },

  studentExamCard(e) {
    return `
      <div class="course-card exam-card">
        <div class="course-card__header">
          <h3 class="course-card__title">${this.esc(e.title)}</h3>
          <span class="badge badge--success">Disponible</span>
        </div>
        ${e.description ? `<p class="course-card__desc">${this.esc(e.description.substring(0,120))}${e.description.length>120?'…':''}</p>` : ''}
        <div class="exam-card__meta">
          ${e.time_limit_min ? `<span class="tag tag--level">⏱ ${e.time_limit_min} min</span>` : '<span class="tag tag--level">Sin límite</span>'}
          <span class="tag tag--category">Aprobación: ${e.passing_score ?? 60}%</span>
        </div>
        <div class="course-card__actions">
          <button class="btn btn--primary take-exam-btn" data-id="${e.id}">Presentar examen</button>
        </div>
      </div>`;
  },

  /* ── Presentar examen ───────────────────────────────────────*/
  async startExam(examId) {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="loader" style="padding:30px;text-align:center">Cargando examen...</div>';
    try {
      const exam = await ExamService.getForTaking(examId);
      this._examAnswers = {};
      this._examTimer   = null;

      main.innerHTML = `
        <div class="page exam-take">
          <div class="exam-take__header">
            <div>
              <h1 class="courses-title">&#128221; ${this.esc(exam.title)}</h1>
              ${exam.description ? `<p style="color:var(--text-secondary);margin-top:4px">${this.esc(exam.description)}</p>` : ''}
            </div>
            ${exam.time_limit_min
              ? `<div class="exam-timer" id="exam-timer">⏱ ${exam.time_limit_min}:00</div>`
              : ''}
          </div>
          <div id="exam-questions">
            ${exam.questions.map((q, i) => this.renderQuestionInput(q, i)).join('')}
          </div>
          <div style="display:flex;gap:12px;margin-top:24px;padding-bottom:40px">
            <button class="btn btn--primary btn--lg" id="submit-exam-btn">Entregar examen</button>
            <button class="btn btn--secondary btn--lg" id="cancel-exam-btn">Cancelar</button>
          </div>
        </div>`;

      if (exam.time_limit_min) this.startTimer(exam.time_limit_min, examId, exam);

      document.getElementById('cancel-exam-btn').addEventListener('click', () => {
        if (confirm('¿Cancelar el examen? Tu progreso se perderá.')) this.render();
      });

      document.getElementById('submit-exam-btn').addEventListener('click', () =>
        this.submitExam(examId, exam.questions)
      );
    } catch (err) {
      Toast.error(err.message);
      await this.render();
    }
  },

  renderQuestionInput(q, i) {
    let answerHtml = '';
    if (q.question_type === 'open') {
      answerHtml = `<textarea class="form__input exam-answer" data-qid="${q.id}" data-type="open"
        rows="3" style="resize:vertical" placeholder="Escribe tu respuesta aquí..."></textarea>`;
    } else {
      answerHtml = `<div class="q-options-input">${(q.options || []).map(o => `
        <label class="q-option-choice">
          <input type="radio" name="q_${q.id}" value="${o.id}" class="exam-answer" data-qid="${q.id}" data-type="choice">
          <span>${this.esc(o.option_text)}</span>
        </label>`).join('')}
      </div>`;
    }
    return `
      <div class="question-take-item">
        <div class="question-take-item__header">
          <span class="question-item__num">${i + 1}.</span>
          <span class="question-take-item__text">${this.esc(q.question_text)}</span>
          <span class="tag tag--category" style="margin-left:auto">${q.points} pt${q.points !== 1 ? 's' : ''}</span>
        </div>
        ${answerHtml}
      </div>`;
  },

  startTimer(minutes, examId, exam) {
    let secs = minutes * 60;
    const timerEl = document.getElementById('exam-timer');
    this._examTimer = setInterval(() => {
      secs--;
      if (!timerEl) { clearInterval(this._examTimer); return; }
      const m = Math.floor(secs / 60);
      const s = secs % 60;
      timerEl.textContent = `⏱ ${m}:${String(s).padStart(2, '0')}`;
      if (secs <= 60) timerEl.classList.add('exam-timer--warning');
      if (secs <= 0) {
        clearInterval(this._examTimer);
        Toast.error('¡Tiempo agotado! Entregando automáticamente…');
        this.submitExam(examId, exam.questions);
      }
    }, 1000);
  },

  async submitExam(examId, questions) {
    clearInterval(this._examTimer);
    const btn = document.getElementById('submit-exam-btn');
    if (btn) btn.disabled = true;

    const answers = questions.map(q => {
      if (q.question_type === 'open') {
        const ta = document.querySelector(`.exam-answer[data-qid="${q.id}"][data-type="open"]`);
        return { question_id: q.id, answer_text: ta?.value || '' };
      }
      const selected = document.querySelector(`input[name="q_${q.id}"]:checked`);
      return { question_id: q.id, selected_option_id: selected?.value || null };
    });

    try {
      const result = await ExamService.submitAttempt(examId, answers);
      this.showAttemptResult(result);
    } catch (err) {
      Toast.error(err.message);
      if (btn) btn.disabled = false;
    }
  },

  showAttemptResult(attempt) {
    const main = document.getElementById('main-content');
    const passed = attempt.passed;
    const scoreColor = passed ? 'var(--success)' : 'var(--danger)';

    const questionsHtml = (attempt.questions || []).map((q, i) => {
      const ans = q.student_answer;
      let answerDisplay = '';
      if (q.question_type === 'open') {
        answerDisplay = `<p class="q-answer-open">"${this.esc(ans?.answer_text || '—')}"</p>`;
      } else {
        const studentOpt = (q.options || []).find(o => o.id === ans?.selected_option_id);
        const correctOpt = (q.options || []).find(o => o.is_correct);
        answerDisplay = (q.options || []).map(o => {
          let cls = 'q-option-result';
          if (o.is_correct) cls += ' q-option-result--correct';
          if (o.id === ans?.selected_option_id && !o.is_correct) cls += ' q-option-result--wrong';
          return `<div class="${cls}">${this.esc(o.option_text)}</div>`;
        }).join('');
        if (!studentOpt) answerDisplay += `<p style="color:var(--danger);font-size:0.8rem;margin-top:4px">Sin respuesta — Correcta: ${this.esc(correctOpt?.option_text || '')}</p>`;
      }

      const pts = ans?.points_awarded != null ? `+${ans.points_awarded}/${q.points} pts` : '';
      const icon = ans?.is_correct === true ? '✅' : ans?.is_correct === false ? '❌' : '📝';
      return `
        <div class="question-take-item question-result-item">
          <div class="question-take-item__header">
            <span class="question-item__num">${i+1}.</span>
            <span class="question-take-item__text">${this.esc(q.question_text)}</span>
            <span style="margin-left:auto">${icon}</span>
            ${pts ? `<span class="tag tag--category">${pts}</span>` : ''}
          </div>
          ${answerDisplay}
        </div>`;
    }).join('');

    main.innerHTML = `
      <div class="page">
        <div class="exam-result-header">
          <div class="exam-result-score" style="border-color:${scoreColor};color:${scoreColor}">
            ${attempt.score}%
          </div>
          <div>
            <h1 class="courses-title">${attempt.exam_title || 'Resultado del Examen'}</h1>
            <p style="font-size:1.1rem;font-weight:600;color:${scoreColor};margin-top:4px">
              ${passed ? '🎉 ¡Aprobado!' : '😔 Reprobado'}
            </p>
            <p style="color:var(--text-secondary);margin-top:2px">Nota mínima: ${attempt.passing_score ?? 60}%</p>
          </div>
        </div>
        <div id="result-questions">${questionsHtml}</div>
        <div style="margin-top:24px;display:flex;gap:12px;padding-bottom:40px">
          <button class="btn btn--primary" id="back-to-exams">Volver a exámenes</button>
        </div>
      </div>`;

    document.getElementById('back-to-exams').addEventListener('click', () => this.render());
  },

  /* ── Historial del estudiante ───────────────────────────────*/
  async renderStudentHistory(container) {
    const user = Auth.getUser();
    try {
      const attempts = await ExamService.getMyAttempts();
      if (!attempts.length) {
        container.innerHTML = `<div class="empty-state card" style="padding:40px;text-align:center">
          <p>Aún no has presentado ningún examen.</p>
        </div>`;
        return;
      }

      const rows = attempts.map(a => {
        const date  = new Date(a.submitted_at).toLocaleDateString('es-CO', { day:'2-digit', month:'short', year:'numeric' });
        const badge = a.passed
          ? '<span class="badge badge--success">Aprobado</span>'
          : '<span class="badge badge--danger">Reprobado</span>';
        return `<tr>
          <td>${this.esc(a.exam_title || 'Examen')}</td>
          <td style="text-align:center;font-weight:600">${a.score}%</td>
          <td style="text-align:center">${badge}</td>
          <td style="text-align:center;font-size:0.8rem;color:var(--text-secondary)">${date}</td>
          <td style="text-align:center">
            <button class="btn btn--small btn--secondary view-my-attempt-btn" data-aid="${a.id}">Revisar</button>
          </td>
        </tr>`;
      }).join('');

      container.innerHTML = `
        <div class="card" style="overflow-x:auto">
          <table class="results-table">
            <thead><tr>
              <th>Examen</th><th>Puntaje</th><th>Estado</th><th>Fecha</th><th></th>
            </tr></thead>
            <tbody>${rows}</tbody>
          </table>
        </div>`;

      container.querySelectorAll('.view-my-attempt-btn').forEach(btn =>
        btn.addEventListener('click', () => this.showAttemptDetailModal(btn.dataset.aid))
      );
    } catch (err) { Toast.error(err.message); }
  },

  /* ── Detalle de intento (modal) ─────────────────────────── */
  async showAttemptDetailModal(attemptId) {
    this.openModal('Detalle del Intento', '<div class="loader" style="padding:20px;text-align:center">Cargando...</div>', true);
    try {
      const attempt = await ExamService.getAttempt(attemptId);
      const passed  = attempt.passed;
      const scoreColor = passed ? 'var(--success)' : 'var(--danger)';

      const questionsHtml = (attempt.questions || []).map((q, i) => {
        const ans = q.student_answer;
        let ansHtml = '';
        if (q.question_type === 'open') {
          ansHtml = `<p class="q-answer-open">"${this.esc(ans?.answer_text || '—')}"</p>`;
        } else {
          ansHtml = (q.options || []).map(o => {
            let cls = 'q-option-result';
            if (o.is_correct) cls += ' q-option-result--correct';
            if (o.id === ans?.selected_option_id && !o.is_correct) cls += ' q-option-result--wrong';
            return `<div class="${cls}">${this.esc(o.option_text)}</div>`;
          }).join('');
        }
        const icon = ans?.is_correct === true ? '✅' : ans?.is_correct === false ? '❌' : '📝';
        return `
          <div class="question-take-item question-result-item">
            <div class="question-take-item__header">
              <span class="question-item__num">${i+1}.</span>
              <span class="question-take-item__text">${this.esc(q.question_text)}</span>
              <span style="margin-left:auto">${icon}</span>
              ${ans?.points_awarded != null ? `<span class="tag tag--category">+${ans.points_awarded}/${q.points} pts</span>` : ''}
            </div>
            ${ansHtml}
          </div>`;
      }).join('');

      document.getElementById('modal-body').innerHTML = `
        <div style="text-align:center;margin-bottom:20px">
          <div class="exam-result-score" style="border-color:${scoreColor};color:${scoreColor};display:inline-flex">
            ${attempt.score}%
          </div>
          <p style="font-size:1rem;font-weight:600;color:${scoreColor};margin-top:8px">
            ${passed ? '🎉 Aprobado' : '😔 Reprobado'}
          </p>
        </div>
        ${questionsHtml}`;
    } catch (err) {
      document.getElementById('modal-body').innerHTML = `<p style="color:var(--danger)">${err.message}</p>`;
    }
  },

  /* ════════════════════════ HELPERS ══════════════════════════ */

  openModal(title, bodyHtml, wide = false) {
    document.getElementById('exam-modal')?.remove();
    const div = document.createElement('div');
    div.id = 'exam-modal';
    div.innerHTML = `
      <div class="modal-overlay" id="exam-modal-overlay">
        <div class="modal${wide ? ' modal--wide' : ''}">
          <div class="modal__header">
            <h2 class="modal__title">${title}</h2>
            <button class="modal__close" id="exam-modal-close">✕</button>
          </div>
          <div class="modal__body" id="modal-body">${bodyHtml}</div>
        </div>
      </div>`;
    document.body.appendChild(div);
    div.querySelector('#exam-modal-close').addEventListener('click', () => div.remove());
    // Only close when clicking the backdrop itself, not the modal content
    div.querySelector('#exam-modal-overlay').addEventListener('click', (e) => {
      if (e.target === div.querySelector('#exam-modal-overlay')) div.remove();
    });
  },

  esc(str) {
    if (str == null) return '';
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  },
};
