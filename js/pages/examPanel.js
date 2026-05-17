import { ExamService } from '../services/examService.js';
import { UserService } from '../services/userService.js';
import { Auth } from '../utils/auth.js';
import { Toast } from '../components/toast.js';

const STATUS = {
  draft: { label: 'Borrador', cls: 'badge--secondary' },
  published: { label: 'Publicado', cls: 'badge--success' },
  closed: { label: 'Cerrado', cls: 'badge--error' },
};

const QTYPE = {
  multiple_choice: 'Opción múltiple',
  true_false: 'Verdadero / Falso',
  open: 'Pregunta abierta',
};

// Panel modal de exámenes, abierto desde una tarjeta de curso.
export const ExamPanel = {
  _course: null,
  _isTutor: false,

  async open(course, isTutor) {
    this._course = course;
    this._isTutor = isTutor;
    this._openModal();
    await this.showList();
  },

  /* ── Infraestructura del modal ────────────────────────────── */
  _openModal() {
    document.getElementById('exam-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'exam-modal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
      <div class="modal modal--lg">
        <div class="modal__header">
          <h3 class="modal__title" id="exam-modal-title">Exámenes</h3>
          <button class="modal__close" id="exam-modal-close">&times;</button>
        </div>
        <div class="modal__body" id="exam-modal-body"></div>
      </div>`;
    document.body.appendChild(modal);
    modal.querySelector('#exam-modal-close').addEventListener('click', () => modal.remove());
    modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
  },

  _title(t) { const el = document.getElementById('exam-modal-title'); if (el) el.textContent = t; },
  _body() { return document.getElementById('exam-modal-body'); },
  _loading() { const b = this._body(); if (b) b.innerHTML = '<div class="loader" style="padding:30px;text-align:center">Cargando...</div>'; },
  _close() { document.getElementById('exam-modal')?.remove(); },
  _error(msg) { const b = this._body(); if (b) b.innerHTML = `<p style="color:var(--danger);padding:20px">${this.esc(msg)}</p>`; },

  /* ── Listado de exámenes del curso ────────────────────────── */
  async showList() {
    this._title(`Exámenes — ${this._course.title}`);
    this._loading();
    try {
      let exams = await ExamService.listByCourse(this._course.id);
      if (!this._isTutor) {
        exams = exams.filter((e) => e.status === 'published' || e.status === 'closed');
      }
      this._isTutor ? this._renderTutorList(exams) : this._renderStudentList(exams);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') this._error(err.message);
    }
  },

  _renderTutorList(exams) {
    const body = this._body();
    const cards = exams.length
      ? exams.map((e) => this._tutorExamCard(e)).join('')
      : '<p class="empty-state" style="padding:20px">Este curso aún no tiene exámenes.</p>';
    body.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
        <button class="btn btn--primary btn--small" id="ex-new">+ Crear examen</button>
      </div>
      <div class="exam-list">${cards}</div>`;

    body.querySelector('#ex-new').addEventListener('click', () => this.showExamForm(null));
    body.querySelectorAll('[data-act]').forEach((btn) => {
      btn.addEventListener('click', () => this._tutorAction(btn.dataset.act, btn.dataset.id));
    });
  },

  _tutorExamCard(e) {
    const st = STATUS[e.status] || { label: e.status, cls: 'badge--secondary' };
    let actions = '';
    if (e.status === 'draft') {
      actions = `
        <button class="btn btn--small btn--secondary" data-act="edit" data-id="${e.id}">Editar</button>
        <button class="btn btn--small btn--secondary" data-act="questions" data-id="${e.id}">Preguntas</button>
        <button class="btn btn--small btn--primary" data-act="publish" data-id="${e.id}">Publicar</button>
        <button class="btn btn--small btn--danger" data-act="delete" data-id="${e.id}">Eliminar</button>`;
    } else if (e.status === 'published') {
      actions = `
        <button class="btn btn--small btn--secondary" data-act="questions" data-id="${e.id}">Ver preguntas</button>
        <button class="btn btn--small btn--secondary" data-act="attempts" data-id="${e.id}">Ver resultados</button>
        <button class="btn btn--small btn--danger" data-act="close" data-id="${e.id}">Cerrar examen</button>`;
    } else {
      actions = `
        <button class="btn btn--small btn--secondary" data-act="questions" data-id="${e.id}">Ver preguntas</button>
        <button class="btn btn--small btn--secondary" data-act="attempts" data-id="${e.id}">Ver resultados</button>`;
    }
    return `
      <div class="exam-card">
        <div class="exam-card__head">
          <h4 class="exam-card__title">${this.esc(e.title)}</h4>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        ${e.description ? `<p class="exam-card__desc">${this.esc(e.description)}</p>` : ''}
        <div class="exam-card__meta">
          <span class="tag">&#9201; ${e.time_limit_min ? e.time_limit_min + ' min' : 'Sin límite'}</span>
          <span class="tag">Aprobación: ${e.passing_score ?? 60}%</span>
        </div>
        <div class="exam-card__actions">${actions}</div>
      </div>`;
  },

  async _tutorAction(act, id) {
    if (act === 'edit') return this.showExamForm(id);
    if (act === 'questions') return this.showQuestions(id);
    if (act === 'attempts') return this.showExamAttempts(id);
    if (act === 'publish') {
      if (!confirm('Al publicar el examen ya no podrás editar sus preguntas. ¿Publicarlo?')) return;
      return this._changeStatus(id, 'published');
    }
    if (act === 'close') {
      if (!confirm('Cerrar el examen impedirá nuevos intentos de los estudiantes. ¿Continuar?')) return;
      return this._changeStatus(id, 'closed');
    }
    if (act === 'delete') {
      if (!confirm('¿Eliminar este examen? Esta acción no se puede deshacer.')) return;
      try {
        await ExamService.remove(id);
        Toast.success('Examen eliminado');
        await this.showList();
      } catch (err) { Toast.error(err.message); }
    }
  },

  async _changeStatus(id, status) {
    try {
      await ExamService.changeStatus(id, status);
      Toast.success(status === 'published' ? 'Examen publicado' : 'Examen cerrado');
      await this.showList();
    } catch (err) { Toast.error(err.message); }
  },

  /* ── Crear / editar examen ────────────────────────────────── */
  async showExamForm(examId) {
    this._loading();
    let exam = null;
    if (examId) {
      try { exam = await ExamService.get(examId); }
      catch (err) { return this._error(err.message); }
    }
    this._title(examId ? 'Editar examen' : 'Crear examen');
    this._body().innerHTML = `
      <form id="exam-form" class="form">
        <label class="form__label">Título *</label>
        <input type="text" id="exf-title" class="form__input" required maxlength="255" value="${this.esc(exam?.title || '')}">
        <label class="form__label">Descripción</label>
        <textarea id="exf-desc" class="form__input" rows="3" style="resize:vertical">${this.esc(exam?.description || '')}</textarea>
        <div style="display:flex;gap:12px">
          <div style="flex:1">
            <label class="form__label">Límite de tiempo (min)</label>
            <input type="number" id="exf-time" class="form__input" min="0" value="${exam?.time_limit_min ?? ''}">
          </div>
          <div style="flex:1">
            <label class="form__label">Puntaje de aprobación (%)</label>
            <input type="number" id="exf-pass" class="form__input" min="0" max="100" value="${exam?.passing_score ?? 60}">
          </div>
        </div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button type="submit" class="btn btn--primary">${examId ? 'Guardar cambios' : 'Crear examen'}</button>
          <button type="button" class="btn btn--secondary" id="exf-cancel">Cancelar</button>
        </div>
      </form>`;

    this._body().querySelector('#exf-cancel').addEventListener('click', () => this.showList());
    this._body().querySelector('#exam-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      const payload = {
        title: document.getElementById('exf-title').value.trim(),
        description: document.getElementById('exf-desc').value.trim(),
        time_limit_min: parseInt(document.getElementById('exf-time').value, 10) || null,
        passing_score: parseInt(document.getElementById('exf-pass').value, 10) || 60,
      };
      try {
        if (examId) {
          await ExamService.update(examId, payload);
          Toast.success('Examen actualizado');
        } else {
          await ExamService.create({ ...payload, course_id: this._course.id });
          Toast.success('Examen creado. Ahora añade preguntas.');
        }
        await this.showList();
      } catch (err) {
        Toast.error(err.message);
        btn.disabled = false;
      }
    });
  },

  /* ── Gestión de preguntas ─────────────────────────────────── */
  async showQuestions(examId) {
    this._loading();
    let exam;
    try { exam = await ExamService.get(examId); }
    catch (err) { return this._error(err.message); }

    const editable = this._isTutor && exam.status === 'draft';
    this._title(`Preguntas — ${exam.title}`);
    const questions = (exam.questions || []).sort((a, b) => a.order_index - b.order_index);

    const list = questions.length
      ? questions.map((q, i) => this._questionCard(q, i, examId, editable)).join('')
      : '<p class="empty-state" style="padding:16px">Este examen no tiene preguntas.</p>';

    this._body().innerHTML = `
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:14px">
        <button class="btn btn--small btn--secondary" id="q-back">&larr; Volver</button>
        ${editable ? '<button class="btn btn--small btn--primary" id="q-new">+ Añadir pregunta</button>' : ''}
      </div>
      ${!editable && exam.status !== 'draft'
        ? '<p class="exam-hint">El examen está publicado o cerrado: las preguntas son de solo lectura.</p>' : ''}
      <div class="exam-q-list">${list}</div>`;

    this._body().querySelector('#q-back').addEventListener('click', () => this.showList());
    this._body().querySelector('#q-new')?.addEventListener('click', () => this.showQuestionForm(examId, null, questions.length));
    if (editable) {
      this._body().querySelectorAll('[data-qedit]').forEach((b) =>
        b.addEventListener('click', () => {
          const q = questions.find((x) => x.id === b.dataset.qedit);
          this.showQuestionForm(examId, q, questions.length);
        }));
      this._body().querySelectorAll('[data-qdel]').forEach((b) =>
        b.addEventListener('click', () => this._deleteQuestion(examId, b.dataset.qdel)));
    }
  },

  _questionCard(q, index, examId, editable) {
    const opts = (q.options || []).map((o) => `
      <li class="exam-opt ${o.is_correct ? 'exam-opt--correct' : ''}">
        ${o.is_correct ? '&#10003; ' : ''}${this.esc(o.option_text)}
      </li>`).join('');
    return `
      <div class="exam-q">
        <div class="exam-q__head">
          <span class="exam-q__num">${index + 1}</span>
          <span class="exam-q__text">${this.esc(q.question_text)}</span>
        </div>
        <div class="exam-q__meta">
          <span class="tag">${QTYPE[q.question_type] || q.question_type}</span>
          <span class="tag">${q.points} pt${q.points === 1 ? '' : 's'}</span>
        </div>
        ${opts ? `<ul class="exam-opt-list">${opts}</ul>` : ''}
        ${editable ? `<div class="exam-q__actions">
          <button class="btn btn--small btn--secondary" data-qedit="${q.id}">Editar</button>
          <button class="btn btn--small btn--danger" data-qdel="${q.id}">Eliminar</button>
        </div>` : ''}
      </div>`;
  },

  async _deleteQuestion(examId, questionId) {
    if (!confirm('¿Eliminar esta pregunta?')) return;
    try {
      await ExamService.deleteQuestion(examId, questionId);
      Toast.success('Pregunta eliminada');
      await this.showQuestions(examId);
    } catch (err) { Toast.error(err.message); }
  },

  /* ── Formulario de pregunta ───────────────────────────────── */
  showQuestionForm(examId, question, totalQuestions) {
    const isEdit = !!question;
    const type = question?.question_type || 'multiple_choice';
    this._title(isEdit ? 'Editar pregunta' : 'Nueva pregunta');
    this._body().innerHTML = `
      <form id="q-form" class="form">
        <label class="form__label">Enunciado *</label>
        <textarea id="qf-text" class="form__input" rows="2" required style="resize:vertical">${this.esc(question?.question_text || '')}</textarea>
        <div style="display:flex;gap:12px">
          <div style="flex:2">
            <label class="form__label">Tipo de pregunta</label>
            <select id="qf-type" class="form__input">
              <option value="multiple_choice" ${type === 'multiple_choice' ? 'selected' : ''}>Opción múltiple</option>
              <option value="true_false" ${type === 'true_false' ? 'selected' : ''}>Verdadero / Falso</option>
              <option value="open" ${type === 'open' ? 'selected' : ''}>Pregunta abierta</option>
            </select>
          </div>
          <div style="flex:1">
            <label class="form__label">Puntos</label>
            <input type="number" id="qf-points" class="form__input" min="1" value="${question?.points ?? 1}">
          </div>
        </div>
        <div id="qf-options"></div>
        <div style="display:flex;gap:12px;margin-top:16px">
          <button type="submit" class="btn btn--primary">${isEdit ? 'Guardar' : 'Añadir pregunta'}</button>
          <button type="button" class="btn btn--secondary" id="qf-cancel">Cancelar</button>
        </div>
      </form>`;

    const typeSel = document.getElementById('qf-type');
    const renderOpts = () => this._renderOptionsEditor(typeSel.value, question);
    typeSel.addEventListener('change', renderOpts);
    renderOpts();

    document.getElementById('qf-cancel').addEventListener('click', () => this.showQuestions(examId));
    document.getElementById('q-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const btn = e.target.querySelector('[type="submit"]');
      const payload = this._collectQuestionPayload(typeSel.value);
      if (payload.error) { Toast.error(payload.error); return; }
      btn.disabled = true;
      const data = {
        question_text: document.getElementById('qf-text').value.trim(),
        question_type: typeSel.value,
        points: parseInt(document.getElementById('qf-points').value, 10) || 1,
        order_index: question ? question.order_index : totalQuestions,
        options: payload.options,
      };
      try {
        if (isEdit) {
          await ExamService.updateQuestion(examId, question.id, data);
          Toast.success('Pregunta actualizada');
        } else {
          await ExamService.addQuestion(examId, data);
          Toast.success('Pregunta añadida');
        }
        await this.showQuestions(examId);
      } catch (err) {
        Toast.error(err.message);
        btn.disabled = false;
      }
    });
  },

  _renderOptionsEditor(type, question) {
    const container = document.getElementById('qf-options');
    if (type === 'open') {
      container.innerHTML = '<p class="exam-hint">Las preguntas abiertas no tienen opciones; el estudiante responde con texto.</p>';
      return;
    }
    if (type === 'true_false') {
      const opts = question?.options?.length === 2
        ? question.options
        : [{ option_text: 'Verdadero', is_correct: true }, { option_text: 'Falso', is_correct: false }];
      container.innerHTML = `
        <label class="form__label">Respuesta correcta</label>
        ${opts.map((o, i) => `
          <label class="exam-opt-edit">
            <input type="radio" name="qf-correct" value="${i}" ${o.is_correct ? 'checked' : ''}>
            <span>${this.esc(o.option_text)}</span>
          </label>`).join('')}`;
      return;
    }
    // multiple_choice
    const opts = question?.options?.length
      ? question.options
      : [{ option_text: '', is_correct: false }, { option_text: '', is_correct: false }];
    container.innerHTML = `
      <label class="form__label">Opciones (marca la correcta)</label>
      <div id="qf-opt-rows">${opts.map((o, i) => this._mcRow(o, i)).join('')}</div>
      <button type="button" class="btn btn--small btn--secondary" id="qf-add-opt" style="margin-top:8px">+ Añadir opción</button>`;

    const wire = () => {
      container.querySelectorAll('.qf-opt-del').forEach((b) =>
        b.addEventListener('click', () => {
          const rows = container.querySelectorAll('.qf-opt-row');
          if (rows.length <= 2) { Toast.error('Una pregunta de opción múltiple necesita al menos 2 opciones'); return; }
          b.closest('.qf-opt-row').remove();
        }));
    };
    wire();
    document.getElementById('qf-add-opt').addEventListener('click', () => {
      const rows = document.getElementById('qf-opt-rows');
      const div = document.createElement('div');
      div.innerHTML = this._mcRow({ option_text: '', is_correct: false }, rows.children.length);
      rows.appendChild(div.firstElementChild);
      wire();
    });
  },

  _mcRow(o, i) {
    return `
      <div class="qf-opt-row">
        <input type="radio" name="qf-correct" value="${i}" ${o.is_correct ? 'checked' : ''} title="Marcar como correcta">
        <input type="text" class="form__input qf-opt-text" placeholder="Texto de la opción" value="${this.esc(o.option_text || '')}">
        <button type="button" class="btn btn--small btn--danger qf-opt-del">&times;</button>
      </div>`;
  },

  _collectQuestionPayload(type) {
    if (type === 'open') return { options: [] };

    if (type === 'true_false') {
      const checked = document.querySelector('input[name="qf-correct"]:checked');
      return {
        options: [
          { option_text: 'Verdadero', is_correct: checked?.value === '0' },
          { option_text: 'Falso', is_correct: checked?.value === '1' },
        ],
      };
    }

    // multiple_choice
    const rows = [...document.querySelectorAll('.qf-opt-row')];
    const options = [];
    rows.forEach((row, i) => {
      const text = row.querySelector('.qf-opt-text').value.trim();
      const correct = row.querySelector('input[name="qf-correct"]')?.checked;
      if (text) options.push({ option_text: text, is_correct: !!correct });
    });
    if (options.length < 2) return { error: 'Añade al menos 2 opciones con texto' };
    if (!options.some((o) => o.is_correct)) return { error: 'Marca cuál opción es la correcta' };
    return { options };
  },

  /* ── Resultados de un examen (vista del tutor) ────────────── */
  async showExamAttempts(examId) {
    this._loading();
    try {
      const [exam, attempts] = await Promise.all([
        ExamService.get(examId),
        ExamService.getExamAttempts(examId),
      ]);
      this._title(`Resultados — ${exam.title}`);

      const ids = [...new Set(attempts.map((a) => a.student_id))];
      const profiles = await Promise.all(ids.map((id) => UserService.getById(id).catch(() => null)));
      const nameMap = {};
      ids.forEach((id, i) => { nameMap[id] = profiles[i]; });

      const rows = attempts.length
        ? attempts.map((a) => {
            const p = nameMap[a.student_id];
            const name = p?.name || a.student_id.substring(0, 8);
            return `
              <div class="exam-attempt" data-attempt="${a.id}">
                <div class="exam-attempt__info">
                  <span class="exam-attempt__name">${this.esc(name)}</span>
                  <span class="exam-attempt__date">${new Date(a.submitted_at).toLocaleString('es')}</span>
                </div>
                <span class="exam-score-pill ${a.passed ? 'exam-score-pill--pass' : 'exam-score-pill--fail'}">
                  ${a.score}% · ${a.passed ? 'Aprobó' : 'Reprobó'}
                </span>
              </div>`;
          }).join('')
        : '<p class="empty-state" style="padding:16px">Ningún estudiante ha presentado este examen.</p>';

      this._body().innerHTML = `
        <div style="margin-bottom:14px">
          <button class="btn btn--small btn--secondary" id="at-back">&larr; Volver</button>
        </div>
        <div class="exam-attempt-list">${rows}</div>`;

      this._body().querySelector('#at-back').addEventListener('click', () => this.showList());
      this._body().querySelectorAll('.exam-attempt').forEach((el) => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => this.showResult(el.dataset.attempt, () => this.showExamAttempts(examId)));
      });
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') this._error(err.message);
    }
  },

  /* ── Listado para el estudiante ───────────────────────────── */
  _renderStudentList(exams) {
    const body = this._body();
    const cards = exams.length
      ? exams.map((e) => this._studentExamCard(e)).join('')
      : '<p class="empty-state" style="padding:20px">Este curso aún no tiene exámenes disponibles.</p>';
    body.innerHTML = `
      <div style="display:flex;justify-content:flex-end;margin-bottom:14px">
        <button class="btn btn--small btn--secondary" id="ex-my">&#128203; Mis intentos</button>
      </div>
      <div class="exam-list">${cards}</div>`;

    body.querySelector('#ex-my').addEventListener('click', () => this.showMyAttempts());
    body.querySelectorAll('[data-take]').forEach((b) =>
      b.addEventListener('click', () => this.showTake(b.dataset.take)));
  },

  _studentExamCard(e) {
    const st = STATUS[e.status] || { label: e.status, cls: 'badge--secondary' };
    const closed = e.status === 'closed';
    return `
      <div class="exam-card">
        <div class="exam-card__head">
          <h4 class="exam-card__title">${this.esc(e.title)}</h4>
          <span class="badge ${st.cls}">${st.label}</span>
        </div>
        ${e.description ? `<p class="exam-card__desc">${this.esc(e.description)}</p>` : ''}
        <div class="exam-card__meta">
          <span class="tag">&#9201; ${e.time_limit_min ? e.time_limit_min + ' min' : 'Sin límite'}</span>
          <span class="tag">Aprobación: ${e.passing_score ?? 60}%</span>
        </div>
        <div class="exam-card__actions">
          ${closed
            ? '<span class="exam-hint">El examen está cerrado, no admite nuevos intentos.</span>'
            : `<button class="btn btn--small btn--primary" data-take="${e.id}">Presentar examen</button>`}
        </div>
      </div>`;
  },

  /* ── Presentar un examen ──────────────────────────────────── */
  async showTake(examId) {
    this._loading();
    let exam;
    try { exam = await ExamService.getForTaking(examId); }
    catch (err) { return this._error(err.message); }

    const questions = (exam.questions || []).sort((a, b) => a.order_index - b.order_index);
    if (!questions.length) {
      this._body().innerHTML = `
        <p class="empty-state" style="padding:20px">Este examen todavía no tiene preguntas.</p>
        <button class="btn btn--small btn--secondary" id="tk-back">&larr; Volver</button>`;
      this._body().querySelector('#tk-back').addEventListener('click', () => this.showList());
      return;
    }

    this._title(`Presentando: ${exam.title}`);
    this._body().innerHTML = `
      <p class="exam-hint">${questions.length} pregunta(s) · Aprobación: ${exam.passing_score ?? 60}%
        ${exam.time_limit_min ? ' · Tiempo sugerido: ' + exam.time_limit_min + ' min' : ''}</p>
      <form id="take-form">
        ${questions.map((q, i) => this._takeQuestion(q, i)).join('')}
        <div style="display:flex;gap:12px;margin-top:8px">
          <button type="submit" class="btn btn--primary">Enviar examen</button>
          <button type="button" class="btn btn--secondary" id="tk-cancel">Cancelar</button>
        </div>
      </form>`;

    this._body().querySelector('#tk-cancel').addEventListener('click', () => this.showList());
    this._body().querySelector('#take-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      if (!confirm('¿Enviar el examen? No podrás cambiar tus respuestas.')) return;
      const btn = e.target.querySelector('[type="submit"]');
      btn.disabled = true;
      const answers = questions.map((q) => {
        if (q.question_type === 'open') {
          return { question_id: q.id, answer_text: (document.getElementById(`open_${q.id}`)?.value || '').trim() };
        }
        const sel = document.querySelector(`input[name="take_${q.id}"]:checked`);
        return { question_id: q.id, selected_option_id: sel ? sel.value : null };
      });
      try {
        const attempt = await ExamService.submitAttempt(examId, answers);
        Toast.success('Examen enviado y calificado');
        this._renderResult(attempt, () => this.showList());
      } catch (err) {
        Toast.error(err.message);
        btn.disabled = false;
      }
    });
  },

  _takeQuestion(q, i) {
    let input = '';
    if (q.question_type === 'open') {
      input = `<textarea id="open_${q.id}" class="form__input" rows="3" placeholder="Tu respuesta..." style="resize:vertical"></textarea>`;
    } else {
      input = (q.options || []).map((o) => `
        <label class="exam-opt-take">
          <input type="radio" name="take_${q.id}" value="${o.id}">
          <span>${this.esc(o.option_text)}</span>
        </label>`).join('');
    }
    return `
      <div class="exam-q">
        <div class="exam-q__head">
          <span class="exam-q__num">${i + 1}</span>
          <span class="exam-q__text">${this.esc(q.question_text)}</span>
        </div>
        <div class="exam-q__meta"><span class="tag">${q.points} pt${q.points === 1 ? '' : 's'}</span></div>
        <div class="exam-take-input">${input}</div>
      </div>`;
  },

  /* ── Historial de intentos del estudiante ─────────────────── */
  async showMyAttempts() {
    this._loading();
    this._title('Mis exámenes presentados');
    try {
      let attempts = await ExamService.getMyAttempts();
      attempts = attempts.filter((a) => a.course_id === this._course.id);

      const tutorIds = [...new Set(attempts.map((a) => a.tutor_id))];
      const tutors = await Promise.all(tutorIds.map((id) => UserService.getById(id).catch(() => null)));
      const tutorMap = {};
      tutorIds.forEach((id, i) => { tutorMap[id] = tutors[i]; });

      const rows = attempts.length
        ? attempts.map((a) => `
            <div class="exam-attempt" data-attempt="${a.id}">
              <div class="exam-attempt__info">
                <span class="exam-attempt__name">${this.esc(a.exam_title)}</span>
                <span class="exam-attempt__date">
                  ${this.esc(this._course.title)} ·
                  Tutor: ${this.esc(tutorMap[a.tutor_id]?.name || '—')} ·
                  ${new Date(a.submitted_at).toLocaleString('es')}
                </span>
              </div>
              <span class="exam-score-pill ${a.passed ? 'exam-score-pill--pass' : 'exam-score-pill--fail'}">
                ${a.score}% · ${a.passed ? 'Aprobado' : 'Reprobado'}
              </span>
            </div>`).join('')
        : '<p class="empty-state" style="padding:16px">Aún no has presentado exámenes de este curso.</p>';

      this._body().innerHTML = `
        <div style="margin-bottom:14px">
          <button class="btn btn--small btn--secondary" id="my-back">&larr; Volver</button>
        </div>
        <div class="exam-attempt-list">${rows}</div>`;

      this._body().querySelector('#my-back').addEventListener('click', () => this.showList());
      this._body().querySelectorAll('.exam-attempt').forEach((el) => {
        el.style.cursor = 'pointer';
        el.addEventListener('click', () => this.showResult(el.dataset.attempt, () => this.showMyAttempts()));
      });
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') this._error(err.message);
    }
  },

  /* ── Detalle de un intento (resultado) ────────────────────── */
  async showResult(attemptId, onBack) {
    this._loading();
    try {
      const attempt = await ExamService.getAttempt(attemptId);
      this._renderResult(attempt, onBack);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') this._error(err.message);
    }
  },

  _renderResult(attempt, onBack) {
    this._title(`Resultado — ${attempt.exam_title || 'Examen'}`);
    const questions = (attempt.questions || []).sort((a, b) => a.order_index - b.order_index);

    this._body().innerHTML = `
      <div style="margin-bottom:14px">
        <button class="btn btn--small btn--secondary" id="res-back">&larr; Volver</button>
      </div>
      <div class="exam-result-head">
        <div class="exam-result-score ${attempt.passed ? 'exam-result-score--pass' : 'exam-result-score--fail'}">
          ${attempt.score}%
        </div>
        <div>
          <p class="exam-result-verdict">${attempt.passed ? '&#10003; Aprobado' : '&#10007; Reprobado'}</p>
          <p class="exam-hint">Mínimo para aprobar: ${attempt.passing_score ?? 60}%</p>
        </div>
      </div>
      <p class="exam-hint" style="margin:14px 0 6px">Revisión de respuestas:</p>
      <div class="exam-q-list">${questions.map((q, i) => this._resultQuestion(q, i)).join('')}</div>`;

    this._body().querySelector('#res-back').addEventListener('click', () => onBack && onBack());
  },

  _resultQuestion(q, i) {
    const ans = q.student_answer;
    let body = '';

    if (q.question_type === 'open') {
      body = `
        <div class="exam-open-answer">
          <strong>Tu respuesta:</strong>
          <p>${this.esc(ans?.answer_text || '(sin responder)')}</p>
          <span class="exam-hint">Las preguntas abiertas no se califican automáticamente.</span>
        </div>`;
    } else {
      body = `<ul class="exam-opt-list">${(q.options || []).map((o) => {
        const chosen = ans && ans.selected_option_id === o.id;
        let cls = '';
        if (o.is_correct) cls = 'exam-opt--correct';
        else if (chosen) cls = 'exam-opt--wrong';
        const mark = o.is_correct ? '&#10003; ' : (chosen ? '&#10007; ' : '');
        const you = chosen ? ' <em>(tu respuesta)</em>' : '';
        return `<li class="exam-opt ${cls}">${mark}${this.esc(o.option_text)}${you}</li>`;
      }).join('')}</ul>`;
    }

    const correct = ans?.is_correct;
    const badge = q.question_type === 'open'
      ? '<span class="badge badge--secondary">Sin calificar</span>'
      : `<span class="badge ${correct ? 'badge--success' : 'badge--error'}">${correct ? 'Correcta' : 'Incorrecta'}</span>`;

    return `
      <div class="exam-q">
        <div class="exam-q__head">
          <span class="exam-q__num">${i + 1}</span>
          <span class="exam-q__text">${this.esc(q.question_text)}</span>
        </div>
        <div class="exam-q__meta">
          ${badge}
          <span class="tag">${ans?.points_awarded ?? 0} / ${q.points} pts</span>
        </div>
        ${body}
      </div>`;
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str == null ? '' : String(str);
    return d.innerHTML;
  },
};
