import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';

export const CourseService = {
  async list({ category, level, tutorId, status, page = 1, pageSize = 20 } = {}) {
    const p = new URLSearchParams({ page, page_size: pageSize });
    if (category) p.set('category', category);
    if (level) p.set('level', level);
    if (tutorId) p.set('tutor_id', tutorId);
    if (status) p.set('status', status);
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}?${p}`);
    if (!res.ok) throw new Error('Error al cargar cursos');
    return await res.json();
  },

  async search({ q, category, page = 1, pageSize = 20 } = {}) {
    const p = new URLSearchParams({ page, page_size: pageSize });
    if (q) p.set('q', q);
    if (category) p.set('category', category);
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/search?${p}`);
    if (!res.ok) throw new Error('Error en búsqueda');
    return await res.json();
  },

  async getById(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${id}`);
    if (!res.ok) throw new Error('Curso no encontrado');
    return await res.json();
  },

  async create(data) {
    const res = await Auth.fetchWithAuth(Config.API.COURSES, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || err.message || 'Error al crear curso');
    }
    return await res.json();
  },

  async update(id, data) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al actualizar curso');
    }
    return await res.json();
  },

  async updateStatus(id, status) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al cambiar estado');
    }
    return await res.json();
  },

  async deleteCourse(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al eliminar curso');
    }
  },

  async enroll(courseId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/enroll`, { method: 'POST' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al inscribirse');
    }
    return await res.json();
  },

  async cancelEnrollment(courseId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/enroll`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al cancelar inscripción');
    }
  },

  async getMyEnrollments() {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/my-enrollments`);
    if (!res.ok) throw new Error('Error al cargar inscripciones');
    return await res.json(); // array of course UUIDs
  },

  async getStudents(courseId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/students`);
    if (!res.ok) throw new Error('Error al cargar estudiantes');
    return await res.json();
  },

  async getResources(courseId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/resources`);
    if (!res.ok) throw new Error('Error al cargar recursos');
    return await res.json();
  },

  async addResource(courseId, data) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/resources`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al agregar recurso');
    }
    return await res.json();
  },

  async deleteResource(courseId, resourceId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/resources/${resourceId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al eliminar recurso');
    }
  },

  async addStudent(courseId, studentId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/students`, {
      method: 'POST',
      body: JSON.stringify({ student_id: studentId }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al agregar estudiante');
    }
    return await res.json();
  },

  async removeStudent(courseId, studentId) {
    const res = await Auth.fetchWithAuth(`${Config.API.COURSES}/${courseId}/students/${studentId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.detail?.message || 'Error al eliminar estudiante');
    }
  },
};
