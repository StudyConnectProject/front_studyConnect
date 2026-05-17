import { AuthService } from '../services/authService.js';
import { Toast } from '../components/toast.js';

export const LoginPage = {
  render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--centered">
        <div class="card card--auth">
          <h1 class="card__title">Iniciar Sesión</h1>
          <form id="login-form" class="form">
            <div class="form__group">
              <label class="form__label">Correo electrónico</label>
              <input type="email" id="email" class="form__input" placeholder="tu@email.com" required>
            </div>
            <div class="form__group">
              <label class="form__label">Contraseña</label>
              <input type="password" id="password" class="form__input" placeholder="Mínimo 6 caracteres" required minlength="6">
            </div>
            <button type="submit" class="btn btn--primary btn--block">Ingresar</button>
          </form>
          <p class="card__footer">¿No tienes cuenta? <a href="#/register">Regístrate</a></p>
        </div>
      </div>`;

    document.getElementById('login-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      try {
        await AuthService.login(email, password);
        Toast.success('Sesión iniciada');
        window.location.hash = '#/chat';
      } catch (err) {
        Toast.error(err.message);
      }
    });
  },
};
