import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';

// Cliente del Matching Service (Go, puerto 8084 vía nginx /api/matching).
export const MatchingService = {
  // Crea una solicitud de emparejamiento para el estudiante autenticado.
  async createRequest(data) {
    const user = Auth.getUser();
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/request`, {
      method: 'POST',
      body: JSON.stringify({ student_id: user?.id, ...data }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al crear la solicitud');
    }
    return await res.json();
  },

  // Lista solicitudes con filtros opcionales (status, subject, studentId).
  async list({ status, subject, studentId } = {}) {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (subject) p.set('subject', subject);
    if (studentId) p.set('student_id', studentId);
    const qs = p.toString();
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}${qs ? `?${qs}` : ''}`);
    if (!res.ok) throw new Error('Error al cargar las solicitudes');
    const data = await res.json();
    return data.requests || [];
  },

  // Devuelve solo las solicitudes del usuario autenticado.
  async myRequests() {
    const user = Auth.getUser();
    return this.list({ studentId: user?.id });
  },

  async getById(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${id}`);
    if (!res.ok) throw new Error('Solicitud no encontrada');
    return await res.json();
  },

  // Edita los campos de una solicitud de tutoría.
  async update(id, data) {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar la solicitud');
    }
    return await res.json();
  },

  async cancel(id) {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${id}`, { method: 'DELETE' });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al cancelar la solicitud');
    }
    return await res.json().catch(() => ({}));
  },

  async updateStatus(id, status) {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${id}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al actualizar el estado');
    }
    return await res.json().catch(() => ({}));
  },

  // Tutores recomendados para un usuario.
  async getRecommendations(userId, limit = 10) {
    const uid = userId || Auth.getUser()?.id;
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/recommendations/${uid}?limit=${limit}`);
    if (!res.ok) throw new Error('Error al cargar recomendaciones');
    const data = await res.json();
    return data.recommendations || [];
  },

  // Matches activos del usuario.
  async getUserMatches(userId, status) {
    const uid = userId || Auth.getUser()?.id;
    const qs = status ? `?status=${encodeURIComponent(status)}` : '';
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${uid}/matches${qs}`);
    if (!res.ok) throw new Error('Error al cargar los matches');
    const data = await res.json();
    return data.matches || [];
  },

  // Un tutor se ofrece para una solicitud de un estudiante.
  async offer(requestId, score) {
    const user = Auth.getUser();
    const body = { tutor_id: user?.id };
    if (score != null) body.score = score;
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${requestId}/offer`, {
      method: 'POST',
      body: JSON.stringify(body),
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Error al ofrecerte como tutor');
    }
    return await res.json();
  },

  async accept(matchId) {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${matchId}/accept`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al aceptar el match');
    return await res.json().catch(() => ({}));
  },

  async reject(matchId) {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/${matchId}/reject`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al rechazar el match');
    return await res.json().catch(() => ({}));
  },

  // Dispara el procesamiento asíncrono de solicitudes pendientes.
  async process() {
    const res = await Auth.fetchWithAuth(`${Config.API.MATCHING}/process`, { method: 'POST' });
    if (!res.ok) throw new Error('Error al procesar las solicitudes');
    return await res.json().catch(() => ({}));
  },
};
