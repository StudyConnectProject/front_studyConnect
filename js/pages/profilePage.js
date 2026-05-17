import { UserService } from '../services/userService.js';
import { Toast } from '../components/toast.js';

export const ProfilePage = {
  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = '<div class="page"><div class="loader">Cargando perfil...</div></div>';

    try {
      const user = await UserService.getMe();
      main.innerHTML = `
        <div class="page">
          <div class="card">
            <h1 class="card__title">Mi Perfil</h1>
            <form id="profile-form" class="form">
              <div class="form__row">
                <div class="form__group">
                  <label class="form__label">Nombre</label>
                  <input type="text" id="prof-name" class="form__input" value="${this.esc(user.name)}" required>
                </div>
                <div class="form__group">
                  <label class="form__label">Email</label>
                  <input type="email" class="form__input" value="${this.esc(user.email)}" disabled>
                </div>
              </div>
              <div class="form__row">
                <div class="form__group">
                  <label class="form__label">Rol</label>
                  <input type="text" class="form__input" value="${({ tutor: 'Tutor', admin: 'Administrador', student: 'Estudiante' })[user.role?.toLowerCase()] || 'Estudiante'}" disabled>
                </div>
                <div class="form__group">
                  <label class="form__label">Estado</label>
                  <span class="badge ${user.isActive ? 'badge--success' : 'badge--error'}">
                    ${user.isActive ? 'Activo' : 'Inactivo'}
                  </span>
                </div>
              </div>
              <div class="form__group">
                <label class="form__label">Habilidades (separadas por coma)</label>
                <input type="text" id="prof-skills" class="form__input" value="${this.esc(user.skills.join(', '))}" placeholder="React, Node.js, Python">
              </div>
              <div class="form__group">
                <label class="form__label">Intereses (separados por coma)</label>
                <input type="text" id="prof-interests" class="form__input" value="${this.esc(user.interests.join(', '))}" placeholder="frontend, IA, datos">
              </div>
              <button type="submit" class="btn btn--primary">Guardar Cambios</button>
            </form>
          </div>
        </div>`;

      document.getElementById('profile-form').addEventListener('submit', async (e) => {
        e.preventDefault();
        try {
          await UserService.updateMe({
            name: document.getElementById('prof-name').value,
            skills: document.getElementById('prof-skills').value.split(',').map(s => s.trim()).filter(Boolean),
            interests: document.getElementById('prof-interests').value.split(',').map(s => s.trim()).filter(Boolean),
          });
          Toast.success('Perfil actualizado');
        } catch (err) {
          Toast.error(err.message);
        }
      });
    } catch (_) {
      main.innerHTML = '<div class="page"><div class="card"><p>Error al cargar perfil. <a href="#/login">Inicia sesión</a></p></div></div>';
    }
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str;
    return d.innerHTML;
  },
};
