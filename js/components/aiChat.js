/* === CHAT IA ESTUDIANTE: INICIO === */

import { Auth } from '../utils/auth.js';
import { Config } from '../config.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function _getStudentRole(user) {
  if (!user) return null;
  const role =
    String(user.role || '').toLowerCase() ||
    String((user.roles || [])[0] || '').toLowerCase();
  return role;
}

function _isStudent() {
  const user = Auth.getUser();
  return _getStudentRole(user) === 'student';
}

function _esc(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ─── Estado interno ────────────────────────────────────────────────────────────

const _state = {
  open: false,
  history: [],        // historial de contexto para la API (formato Gemini)
  sessionId: null,    // session_id proveniente del servidor
};

// ─── Constantes de DOM ─────────────────────────────────────────────────────────

const IDS = {
  BTN:      'ai-chat-fab',
  PANEL:    'ai-chat-panel',
  MESSAGES: 'ai-chat-messages',
  INPUT:    'ai-chat-input',
  SEND:     'ai-chat-send',
  CLOSE:    'ai-chat-close',
};

// ─── HTML ──────────────────────────────────────────────────────────────────────

function _buildHTML() {
  return `
    <!-- Botón flotante IA -->
    <button
      id="${IDS.BTN}"
      class="ai-fab"
      aria-label="Abrir asistente de IA"
      title="Asistente IA"
    >
      <span class="ai-fab__icon" aria-hidden="true">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" stroke-width="2" stroke-linecap="round"
          stroke-linejoin="round" width="26" height="26">
          <path d="M12 2a8 8 0 0 1 8 8c0 5-8 12-8 12S4 15 4 10a8 8 0 0 1 8-8z"/>
          <circle cx="12" cy="10" r="3"/>
        </svg>
      </span>
      <span class="ai-fab__badge" aria-hidden="true"></span>
    </button>

    <!-- Panel de chat -->
    <div
      id="${IDS.PANEL}"
      class="ai-panel"
      role="dialog"
      aria-modal="true"
      aria-label="Asistente IA"
      hidden
    >
      <!-- Header -->
      <div class="ai-panel__header">
        <div class="ai-panel__title">
          <span class="ai-panel__avatar" aria-hidden="true">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" stroke-width="2" stroke-linecap="round"
              stroke-linejoin="round" width="20" height="20">
              <rect x="3" y="11" width="18" height="10" rx="2"/>
              <circle cx="12" cy="5" r="2"/>
              <path d="M12 7v4M8 11V9M16 11V9"/>
            </svg>
          </span>
          <div>
            <span class="ai-panel__name">Asistente IA</span>
            <span class="ai-panel__status">En línea</span>
          </div>
        </div>
        <button id="${IDS.CLOSE}" class="ai-panel__close" aria-label="Cerrar chat">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2.5" stroke-linecap="round"
            width="18" height="18">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <!-- Área de mensajes -->
      <div id="${IDS.MESSAGES}" class="ai-panel__messages" role="log" aria-live="polite">
        <div class="ai-msg ai-msg--bot">
          <div class="ai-msg__bubble">
            ¡Hola! 👋 Soy tu asistente académico. Puedo ayudarte con resúmenes,
            quizzes, recomendaciones y más. ¿En qué te puedo ayudar hoy?
          </div>
        </div>
      </div>

      <!-- Input -->
      <div class="ai-panel__footer">
        <textarea
          id="${IDS.INPUT}"
          class="ai-panel__input"
          placeholder="Escribe tu consulta... (Enter para enviar)"
          rows="1"
          maxlength="2000"
          aria-label="Mensaje para el asistente"
        ></textarea>
        <button id="${IDS.SEND}" class="ai-panel__send" aria-label="Enviar mensaje">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" stroke-width="2" stroke-linecap="round"
            stroke-linejoin="round" width="20" height="20">
            <line x1="22" y1="2" x2="11" y2="13"/>
            <polygon points="22 2 15 22 11 13 2 9 22 2"/>
          </svg>
        </button>
      </div>
    </div>
  `;
}

// ─── Lógica del panel ──────────────────────────────────────────────────────────

function _openPanel() {
  const panel = document.getElementById(IDS.PANEL);
  const btn   = document.getElementById(IDS.BTN);
  if (!panel || !btn) return;
  _state.open = true;
  panel.hidden = false;
  panel.classList.add('ai-panel--open');
  btn.classList.add('ai-fab--active');
  btn.setAttribute('aria-expanded', 'true');
  document.getElementById(IDS.INPUT)?.focus();
}

function _closePanel() {
  const panel = document.getElementById(IDS.PANEL);
  const btn   = document.getElementById(IDS.BTN);
  if (!panel || !btn) return;
  _state.open = false;
  panel.classList.remove('ai-panel--open');
  btn.classList.remove('ai-fab--active');
  btn.setAttribute('aria-expanded', 'false');

  // Espera la transición CSS antes de ocultar del DOM
  panel.addEventListener('transitionend', () => {
    if (!_state.open) {
      panel.hidden = true;
      // Limpia historial al cerrar
      _state.history  = [];
      _state.sessionId = null;
      _resetMessages();
    }
  }, { once: true });
}

function _resetMessages() {
  const area = document.getElementById(IDS.MESSAGES);
  if (!area) return;
  area.innerHTML = `
    <div class="ai-msg ai-msg--bot">
      <div class="ai-msg__bubble">
        ¡Hola! 👋 Soy tu asistente académico. Puedo ayudarte con resúmenes,
        quizzes, recomendaciones y más. ¿En qué te puedo ayudar hoy?
      </div>
    </div>`;
}

function _appendMessage(text, role) {
  const area = document.getElementById(IDS.MESSAGES);
  if (!area) return;
  const div = document.createElement('div');
  div.className = `ai-msg ai-msg--${role === 'user' ? 'user' : 'bot'}`;

  // Convierte saltos de línea en <br> y limpia HTML para seguridad
  const safeText = _esc(text).replace(/\n/g, '<br>');
  div.innerHTML = `<div class="ai-msg__bubble">${safeText}</div>`;
  area.appendChild(div);
  area.scrollTop = area.scrollHeight;
}

function _setTyping(visible) {
  const send = document.getElementById(IDS.SEND);
  const input = document.getElementById(IDS.INPUT);
  if (send)  send.disabled = visible;
  if (input) input.disabled = visible;
}

// ─── Integración con agente_ia_proyecto ──────────────────────────────────────

async function _sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed) return;

  _appendMessage(trimmed, 'user');

  const input = document.getElementById(IDS.INPUT);
  if (input) {
    input.value = '';
    input.style.height = 'auto';
  }

  _setTyping(true);

  const user = Auth.getUser();
  const sessionId = _state.sessionId || (user?.id || user?._id || 'anon');

  try {
    const res = await Auth.fetchWithAuth(`${Config.BASE_URL}${Config.API.AI_AGENT}/chat`, {
      method: 'POST',
      body: JSON.stringify({
        query:      trimmed,
        session_id: sessionId,
        history:    _state.history,
      }),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${res.status}`);
    }

    const data = await res.json();

    // Actualiza estado de contexto
    if (data.session_id) _state.sessionId = data.session_id;
    if (Array.isArray(data.history)) _state.history = data.history;

    _appendMessage(data.response || '(Sin respuesta)', 'bot');
  } catch (err) {
    _appendMessage(
      '⚠️ No pude conectarme con el asistente. Intenta de nuevo en un momento.',
      'bot',
    );
    console.error('[AI Chat]', err);
  } finally {
    _setTyping(false);
    document.getElementById(IDS.INPUT)?.focus();
  }
}

// ─── Eventos ───────────────────────────────────────────────────────────────────

function _bindEvents() {
  document.getElementById(IDS.BTN)?.addEventListener('click', () => {
    _state.open ? _closePanel() : _openPanel();
  });

  document.getElementById(IDS.CLOSE)?.addEventListener('click', _closePanel);

  const input = document.getElementById(IDS.INPUT);
  if (input) {
    // Auto-resize textarea
    input.addEventListener('input', () => {
      input.style.height = 'auto';
      input.style.height = Math.min(input.scrollHeight, 120) + 'px';
    });

    // Enter envía (Shift+Enter = nueva línea)
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        _sendMessage(input.value);
      }
    });
  }

  document.getElementById(IDS.SEND)?.addEventListener('click', () => {
    const input = document.getElementById(IDS.INPUT);
    if (input) _sendMessage(input.value);
  });

  // Cierra con Escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _state.open) _closePanel();
  });
}

// ─── API pública ───────────────────────────────────────────────────────────────

export const AiChat = {
  /**
   * Monta el widget de chat si el usuario es estudiante.
   * Llama desde app.js después de cada navegación.
   */
  mount() {
    // Elimina instancia anterior si existe
    this.unmount();

    if (!Auth.isAuthenticated() || !_isStudent()) return;

    const container = document.createElement('div');
    container.id = 'ai-chat-root';
    container.innerHTML = _buildHTML();
    document.body.appendChild(container);

    _bindEvents();

    // Animación de entrada del FAB
    requestAnimationFrame(() => {
      document.getElementById(IDS.BTN)?.classList.add('ai-fab--visible');
    });
  },

  /** Desmonta el widget y limpia el estado. */
  unmount() {
    document.getElementById('ai-chat-root')?.remove();
    _state.open     = false;
    _state.history  = [];
    _state.sessionId = null;
  },
};

/* === CHAT IA ESTUDIANTE: FIN === */
