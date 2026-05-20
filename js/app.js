import { Auth } from './utils/auth.js';
import { Navbar } from './components/navbar.js';
import { AiChat } from './components/aiChat.js';
import { LoginPage } from './pages/loginPage.js';
import { RegisterPage } from './pages/registerPage.js';
import { ProfilePage } from './pages/profilePage.js';
import { SearchPage } from './pages/searchPage.js';
import { ChatPage } from './pages/chatPage.js';
import { DashboardPage } from './pages/dashboardPage.js';
import { CoursePage } from './pages/coursePage.js';
import { MatchingPage } from './pages/matchingPage.js';
import { ExamPage } from './pages/examPage.js';
import { ChatService } from './services/chatService.js';

const routes = {
  '/login': () => LoginPage.render(),
  '/register': () => RegisterPage.render(),
  '/profile': () => ProfilePage.render(),
  '/search': () => SearchPage.render(),
  '/chat': () => ChatPage.render(),
  '/courses': () => CoursePage.render(),
  '/matching': () => MatchingPage.render(),
  '/exams': () => ExamPage.render(),
  '/dashboard': () => DashboardPage.render(),
};

const publicRoutes = ['/login', '/register'];

function getBasePath(hash) {
  const raw = hash.slice(1) || '/';
  const idx = raw.indexOf('/', 1);
  return idx > 0 ? raw.substring(0, idx) : raw;
}

// Decodifica el payload del JWT sin verificar la firma.
// Devuelve true si el token ya expiró O expirará en menos de 10 minutos (refresco proactivo).
function _jwtIsExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (!payload.exp) return false;
    const TEN_MINUTES_MS = 10 * 60 * 1000;
    return payload.exp * 1000 < Date.now() + TEN_MINUTES_MS;
  } catch (_) {
    return true; // token malformado → tratar como expirado
  }
}

let _navigating = false;

// Al cargar la página: si el token está expirado, intenta refrescarlo antes de navegar.
// Así evitamos que el usuario llegue al chat y sea expulsado en la primera llamada API.
async function _initNavigate() {
  const token = Auth.getToken();
  if (token && _jwtIsExpired(token)) {
    const refreshed = await Auth.refreshSession();
    if (!refreshed) {
      Auth.clear();
    }
  }
  navigate();
}

function navigate() {
  if (_navigating) return;
  _navigating = true;
  _doNavigate();
  _navigating = false;
}
function _doNavigate() {
  const hash = window.location.hash.slice(1) || '/';
  const base = getBasePath(window.location.hash || '#/');

  if (!Auth.isAuthenticated() && !publicRoutes.includes(base)) {
    window.location.hash = '#/login';
    return;
  }

  if (Auth.isAuthenticated() && publicRoutes.includes(base)) {
    window.location.hash = '#/chat';
    return;
  }

  Navbar.render();
  AiChat.mount();

  // El dashboard es exclusivo para administradores.
  if (base === '/dashboard' && !Auth.isAdmin()) {
    window.location.hash = '#/chat';
    return;
  }

  if (hash.startsWith('/chat/')) {
    const convId = hash.split('/chat/')[1];
    ChatPage.render(convId);
    return;
  }

  const route = routes[hash];
  if (route) {
    route();
  } else {
    window.location.hash = Auth.isAuthenticated() ? '#/chat' : '#/login';
  }
}

window.addEventListener('hashchange', navigate);
window.addEventListener('DOMContentLoaded', _initNavigate);
