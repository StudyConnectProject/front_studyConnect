import { UserService } from '../services/userService.js';
import { ChatService } from '../services/chatService.js';
import { Toast } from '../components/toast.js';
import { Auth } from '../utils/auth.js';

// Etiqueta y estilo de badge según el rol del usuario.
function roleInfo(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'tutor') return { label: 'Tutor', cls: 'badge--primary' };
  if (r === 'admin') return { label: 'Administrador', cls: 'badge--admin' };
  return { label: 'Estudiante', cls: 'badge--secondary' };
}

export const SearchPage = {
  _allUsers: [],

  async render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page">
        <div class="card">
          <h1 class="card__title">Buscar Usuarios</h1>
          <form id="search-form" class="form form--inline">
            <input type="text" id="s-name" class="form__input" placeholder="Nombre...">
            <select id="s-skill" class="form__input">
              <option value="">Todas las habilidades</option>
            </select>
            <select id="s-interest" class="form__input">
              <option value="">Todos los intereses</option>
            </select>
            <select id="s-role" class="form__input">
              <option value="">Todos los roles</option>
              <option value="student">Estudiante</option>
              <option value="tutor">Tutor</option>
            </select>
            <button type="submit" class="btn btn--primary">Buscar</button>
            <button type="button" id="search-reset" class="btn btn--secondary">Limpiar</button>
          </form>
        </div>
        <div id="search-results" class="grid">
          <div class="loader">Cargando usuarios...</div>
        </div>
      </div>`;

    // Carga inicial: todos los usuarios + opciones de los desplegables
    try {
      this._allUsers = await UserService.search({});
      this.populateFilters();
      this.renderResults(this._allUsers);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') {
        document.getElementById('search-results').innerHTML =
          '<p class="empty-state">Error al cargar usuarios.</p>';
      }
    }

    document.getElementById('search-form').addEventListener('submit', (e) => {
      e.preventDefault();
      this.applyFilters();
    });

    document.getElementById('search-reset').addEventListener('click', () => {
      document.getElementById('s-name').value = '';
      document.getElementById('s-skill').value = '';
      document.getElementById('s-interest').value = '';
      document.getElementById('s-role').value = '';
      this.renderResults(this._allUsers);
    });
  },

  // Llena los <select> de habilidad e interés con los valores reales de los usuarios
  populateFilters() {
    const skills = new Set();
    const interests = new Set();
    this._allUsers.forEach((u) => {
      (u.skills || []).forEach((s) => s && skills.add(s.trim()));
      (u.interests || []).forEach((i) => i && interests.add(i.trim()));
    });

    const fill = (id, values) => {
      const sel = document.getElementById(id);
      [...values].sort((a, b) => a.localeCompare(b)).forEach((v) => {
        const opt = document.createElement('option');
        opt.value = v;
        opt.textContent = v;
        sel.appendChild(opt);
      });
    };
    fill('s-skill', skills);
    fill('s-interest', interests);
  },

  // Filtra en memoria sobre la lista ya cargada
  applyFilters() {
    const name = document.getElementById('s-name').value.trim().toLowerCase();
    const skill = document.getElementById('s-skill').value;
    const interest = document.getElementById('s-interest').value;
    const role = document.getElementById('s-role').value;

    const filtered = this._allUsers.filter((u) => {
      if (name && !(u.name || '').toLowerCase().includes(name)) return false;
      if (role && u.role !== role) return false;
      if (skill && !(u.skills || []).includes(skill)) return false;
      if (interest && !(u.interests || []).includes(interest)) return false;
      return true;
    });
    this.renderResults(filtered);
  },

  renderResults(users) {
    const container = document.getElementById('search-results');
    if (!users.length) {
      container.innerHTML = '<p class="empty-state">No se encontraron usuarios.</p>';
      return;
    }
    const me = Auth.getUser();
    container.innerHTML = users.map(u => {
      const { label: roleLabel, cls: roleClass } = roleInfo(u.role);
      return `
      <div class="card card--user">
        <div class="card__header">
          <h3>${this.esc(u.name)}</h3>
          <span class="badge ${roleClass}">${roleLabel}</span>
        </div>
        <p class="card__email">${this.esc(u.email)}</p>
        ${u.skills.length ? `<div class="tags">${u.skills.map(s => `<span class="tag">${this.esc(s)}</span>`).join('')}</div>` : ''}
        ${u.interests.length ? `<div class="tags">${u.interests.map(i => `<span class="tag tag--outline">${this.esc(i)}</span>`).join('')}</div>` : ''}
        ${u.id !== me?.id ? `<button class="btn btn--small btn--secondary chat-btn" data-uid="${u.id}" style="margin-top:12px">&#128172; Chat</button>` : ''}
      </div>
    `;
    }).join('');

    container.querySelectorAll('.chat-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        try {
          const conv = await ChatService.createConversation([me.id, btn.dataset.uid]);
          window.location.hash = `#/chat/${conv._id}`;
        } catch (err) {
          if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message);
        }
      });
    });
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};
