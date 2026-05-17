import { AuthService } from '../services/authService.js';
import { UserService } from '../services/userService.js';
import { Toast } from '../components/toast.js';

export const RegisterPage = {
  render() {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="page page--centered">
        <div class="card card--auth">
          <h1 class="card__title">Crear Cuenta</h1>
          <form id="register-form" class="form">
            <div class="form__group">
              <label class="form__label">Nombre completo</label>
              <input type="text" id="name" class="form__input" placeholder="Tu nombre" required>
            </div>
            <div class="form__group">
              <label class="form__label">Correo electrónico</label>
              <input type="email" id="email" class="form__input" placeholder="tu@email.com" required>
            </div>
            <div class="form__group">
              <label class="form__label">Contraseña</label>
              <input type="password" id="password" class="form__input" placeholder="Mínimo 6 caracteres" required minlength="6">
            </div>
            <div class="form__group">
              <label class="form__label">Rol</label>
              <select id="role" class="form__input" required>
                <option value="STUDENT">Estudiante</option>
                <option value="TUTOR">Tutor</option>
              </select>
            </div>
            <button type="submit" class="btn btn--primary btn--block">Registrarse</button>
          </form>
          <p class="card__footer">¿Ya tienes cuenta? <a href="#/login">Inicia sesión</a></p>
        </div>
      </div>`;

    document.getElementById('register-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const name = document.getElementById('name').value;
      const email = document.getElementById('email').value;
      const password = document.getElementById('password').value;
      const role = document.getElementById('role').value;
      try {
        const authData = await AuthService.register(email, password, role);
        await UserService.createProfile({
          id: authData.user.id,
          name,
          email,
          role: role.toLowerCase(),
        });
        Toast.success('Cuenta creada exitosamente');
        window.location.hash = '#/profile';
      } catch (err) {
        Toast.error(err.message);
      }
    });
  },
};
