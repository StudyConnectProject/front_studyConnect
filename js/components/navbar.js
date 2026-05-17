import { Auth } from '../utils/auth.js';

export const Navbar = {
  render() {
    const nav = document.getElementById('navbar');
    const user = Auth.getUser();
    const isAuth = Auth.isAuthenticated();

    if (!isAuth) {
      nav.innerHTML = `
        <div class="nav">
          <a href="#/" class="nav__brand">&#128218; StudyConnect</a>
          <div class="nav__links">
            <a href="#/login" class="nav__link">Iniciar Sesión</a>
            <a href="#/register" class="nav__link nav__link--primary">Registrarse</a>
          </div>
        </div>`;
      return;
    }

    const adminLink = Auth.isAdmin()
      ? '<a href="#/dashboard" class="nav__link">&#128202; Dashboard</a>'
      : '';

    nav.innerHTML = `
      <div class="nav">
        <a href="#/chat" class="nav__brand">&#128218; StudyConnect</a>
        <div class="nav__links">
          <a href="#/chat" class="nav__link">&#128172; Chat</a>
          <a href="#/search" class="nav__link">&#128269; Buscar</a>
          ${adminLink}
          <a href="#/profile" class="nav__link">&#128100; ${user?.email || 'Perfil'}</a>
          <a href="#" class="nav__link nav__link--logout" id="logout-btn">Salir</a>
        </div>
      </div>`;

    document.getElementById('logout-btn')?.addEventListener('click', async (e) => {
      e.preventDefault();
      const { AuthService } = await import('../services/authService.js');
      await AuthService.logout();
      window.location.hash = '#/login';
    });
  },
};
