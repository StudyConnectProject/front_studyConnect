import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';

// El ExamService envuelve las respuestas en { success, data, message, ... }.
async function unwrap(res, fallbackMsg) {
  const json = await res.json().catch(() => ({}));
  if (!res.ok || json.success === false) {
    const detail = json.details?.[0]?.msg;
    throw new Error(detail || json.error || fallbackMsg);
  }
  return json.data;
}

export const ExamService = {
  /* ── Exámenes ─────────────────────────────────────────────── */
  // Listado con filtros arbitrarios: { tutor_id, course_id, status }
  async list(filters = {}) {
    const p = new URLSearchParams(
      Object.fromEntries(Object.entries(filters).filter(([, v]) => v != null && v !== ''))
    );
    const url = p.toString() ? `${Config.API.EXAMS}?${p}` : Config.API.EXAMS;
    const res = await Auth.fetchWithAuth(url);
    return await unwrap(res, 'Error al cargar los exámenes');
  },

  async listByCourse(courseId, status) {
    const p = new URLSearchParams({ course_id: courseId });
    if (status) p.set('status', status);
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}?${p}`);
    return await unwrap(res, 'Error al cargar los exámenes');
  },

  async get(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${id}`);
    return await unwrap(res, 'Examen no encontrado');
  },

  // Examen para presentarlo (sin marcar las opciones correctas).
  async getForTaking(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${id}/take`);
    return await unwrap(res, 'No se pudo cargar el examen');
  },

  async create(data) {
    const res = await Auth.fetchWithAuth(Config.API.EXAMS, {
      method: 'POST',
      body: JSON.stringify({ ...data, tutor_id: Auth.getUser()?.id }),
    });
    return await unwrap(res, 'Error al crear el examen');
  },

  async update(id, data) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return await unwrap(res, 'Error al actualizar el examen');
  },

  async remove(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${id}`, { method: 'DELETE' });
    return await unwrap(res, 'Error al eliminar el examen');
  },

  async changeStatus(id, status) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    return await unwrap(res, 'Error al cambiar el estado del examen');
  },

  /* ── Preguntas ────────────────────────────────────────────── */
  async addQuestion(examId, data) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${examId}/questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    return await unwrap(res, 'Error al añadir la pregunta');
  },

  async updateQuestion(examId, questionId, data) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${examId}/questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    return await unwrap(res, 'Error al actualizar la pregunta');
  },

  async deleteQuestion(examId, questionId) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${examId}/questions/${questionId}`, {
      method: 'DELETE',
    });
    return await unwrap(res, 'Error al eliminar la pregunta');
  },

  /* ── Evaluación ───────────────────────────────────────────── */
  // Envía las respuestas del estudiante; devuelve el intento ya calificado.
  async submitAttempt(examId, answers) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${examId}/attempts`, {
      method: 'POST',
      body: JSON.stringify({ student_id: Auth.getUser()?.id, answers }),
    });
    return await unwrap(res, 'Error al enviar el examen');
  },

  // Intentos sobre un examen (vista del tutor).
  async getExamAttempts(examId) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/${examId}/attempts`);
    return await unwrap(res, 'Error al cargar los intentos');
  },

  // Historial de intentos del estudiante autenticado.
  async getMyAttempts() {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/attempts/student/${Auth.getUser()?.id}`);
    return await unwrap(res, 'Error al cargar tu historial de exámenes');
  },

  // Detalle de un intento: preguntas, respuestas dadas y correctas.
  async getAttempt(attemptId) {
    const res = await Auth.fetchWithAuth(`${Config.API.EXAMS}/attempts/${attemptId}`);
    return await unwrap(res, 'Error al cargar el resultado');
  },
};
