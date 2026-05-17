import { ChatService } from '../services/chatService.js';
import { UserService } from '../services/userService.js';
import { MessageMapper } from '../mappers/messageMapper.js';
import { Auth } from '../utils/auth.js';
import { Toast } from '../components/toast.js';

const REACTION_EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🙏'];

// Etiqueta y estilo de badge según el rol del usuario.
function roleInfo(role) {
  const r = String(role || '').toLowerCase();
  if (r === 'tutor') return { label: 'Tutor', cls: 'badge--primary' };
  if (r === 'admin') return { label: 'Administrador', cls: 'badge--admin' };
  return { label: 'Estudiante', cls: 'badge--secondary' };
}

export const ChatPage = {
  currentConversationId: null,
  typingTimeout: null,
  messages: [],
  otherUser: null,
  lastReadByOther: null,
  _conversations: [],
  _profileMap: {},

  async render(conversationId = null) {
    const main = document.getElementById('main-content');
    main.innerHTML = `
      <div class="chat-layout">
        <aside class="chat-sidebar">
          <div class="chat-sidebar__header">
            <h2 class="chat-sidebar__title">Conversaciones</h2>
            <button id="new-conv-btn" class="btn btn--small btn--primary" title="Nueva conversación">+</button>
          </div>
          <div id="new-conv-panel" class="new-conv-panel" style="display:none">
            <input type="text" id="new-conv-search" class="form__input new-conv-panel__search" placeholder="Filtrar usuarios..." autocomplete="off">
            <div id="new-conv-results" class="new-conv-results"><div class="loader" style="padding:10px;text-align:center">Cargando...</div></div>
          </div>
          <div id="conversation-list" class="chat-sidebar__list">
            <div class="loader">Cargando...</div>
          </div>
        </aside>
        <section class="chat-main" id="chat-main">
          <div class="chat-empty"><p>Selecciona una conversación para comenzar</p></div>
        </section>
      </div>`;

    ChatService.connect();
    await this.loadConversations();

    document.getElementById('new-conv-btn').addEventListener('click', async () => {
      const panel = document.getElementById('new-conv-panel');
      const isVisible = panel.style.display !== 'none';
      panel.style.display = isVisible ? 'none' : 'block';
      if (!isVisible) {
        document.getElementById('new-conv-search').value = '';
        await this.loadUserList();
        document.getElementById('new-conv-search').focus();
      }
    });

    document.getElementById('new-conv-search').addEventListener('input', (e) => {
      this.filterUserList(e.target.value.trim().toLowerCase());
    });

    ChatService.onNewMessage((msg) => {
      if (msg.conversationId === this.currentConversationId) {
        this.appendMessage(msg);
        this.scrollToBottom();
        // Estoy viendo la conversación: marco como leído el mensaje recibido.
        const view = MessageMapper.toView(msg);
        ChatService.emitRead(this.currentConversationId, view.id);
      }
    });

    ChatService.onTypingStart(({ conversationId }) => {
      if (conversationId === this.currentConversationId) {
        document.getElementById('typing-indicator')?.classList.add('visible');
      }
    });

    ChatService.onTypingStop(({ conversationId }) => {
      if (conversationId === this.currentConversationId) {
        document.getElementById('typing-indicator')?.classList.remove('visible');
      }
    });

    ChatService.onReaction(({ messageId, emoji, userId, action }) => {
      this.applyReaction(messageId, emoji, userId, action || 'add');
    });

    ChatService.onMessageDeleted(({ messageId, conversationId }) => {
      if (conversationId === this.currentConversationId) {
        this.applyDeletion(messageId);
      }
    });

    ChatService.onReadReceipt(({ conversationId, lastMessageId }) => {
      if (conversationId === this.currentConversationId) {
        this.lastReadByOther = lastMessageId;
        this.updateReadReceipt();
      }
    });

    if (conversationId) {
      await this.openConversation(conversationId);
    }
  },

  async loadConversations() {
    try {
      const conversations = await ChatService.getConversations();
      this._conversations = conversations;
      const list = document.getElementById('conversation-list');
      if (!conversations.length) {
        list.innerHTML = '<p class="empty-state">Sin conversaciones</p>';
        return;
      }
      const me = Auth.getUser();

      const otherIds = [...new Set(
        conversations.flatMap(c => c.participants.filter(p => p !== me.id))
      )];
      const profileMap = {};
      await Promise.all(otherIds.map(async id => {
        try { profileMap[id] = await UserService.getById(id); } catch { profileMap[id] = null; }
      }));
      this._profileMap = profileMap;

      list.innerHTML = conversations.map(c => {
        const otherId = c.participants.find(p => p !== me.id);
        const profile = profileMap[otherId];
        const name = profile?.name || otherId?.substring(0, 16) || 'Conversación';
        const { label: roleLabel, cls: roleClass } = roleInfo(profile?.role);
        const badgeHtml = profile?.role ? `<span class="badge ${roleClass}" style="font-size:0.65rem;padding:2px 6px">${roleLabel}</span>` : '';
        const preview = c.lastMessage?.text || 'Sin mensajes';
        const active = c._id === this.currentConversationId ? 'active' : '';
        return `
          <div class="conv-item ${active}" data-id="${c._id}">
            <div class="conv-avatar">${this.initials(name)}</div>
            <div class="conv-item__body">
              <div class="conv-item__header">
                <span class="conv-item__name">${this.esc(name)}</span>
                ${badgeHtml}
              </div>
              <div class="conv-item__preview">${this.esc(preview.substring(0, 40))}</div>
            </div>
            <button class="conv-item__delete" data-id="${c._id}" title="Eliminar conversación">&#128465;</button>
          </div>`;
      }).join('');

      list.querySelectorAll('.conv-item').forEach(item => {
        item.addEventListener('click', () => this.openConversation(item.dataset.id));
      });

      list.querySelectorAll('.conv-item__delete').forEach(btn => {
        btn.addEventListener('click', (e) => {
          e.stopPropagation();
          this.deleteConversation(btn.dataset.id);
        });
      });
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') {
        Toast.error('Error al cargar conversaciones');
      }
    }
  },

  async deleteConversation(conversationId) {
    if (!confirm('¿Eliminar esta conversación? Se borrará el historial de mensajes para ambos participantes.')) return;
    try {
      await ChatService.deleteConversation(conversationId);
      Toast.success('Conversación eliminada');
      // Si la conversación abierta es la eliminada, limpio el panel.
      if (this.currentConversationId === conversationId) {
        ChatService.leaveConversation(conversationId);
        this.currentConversationId = null;
        this.messages = [];
        const chatMain = document.getElementById('chat-main');
        if (chatMain) {
          chatMain.innerHTML = '<div class="chat-empty"><p>Selecciona una conversación para comenzar</p></div>';
        }
      }
      await this.loadConversations();
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') Toast.error(err.message);
    }
  },

  async openConversation(conversationId) {
    if (this.currentConversationId) {
      ChatService.leaveConversation(this.currentConversationId);
    }
    this.currentConversationId = conversationId;
    this.messages = [];
    this.lastReadByOther = null;
    ChatService.joinConversation(conversationId, () => {});

    const me = Auth.getUser();
    const conv = this._conversations.find(c => c._id === conversationId);
    const otherId = conv?.participants.find(p => p !== me.id);
    this.otherUser = this._profileMap[otherId] || null;
    if (conv?.readPointers && otherId) {
      this.lastReadByOther = conv.readPointers[otherId] || null;
    }

    const otherName = this.otherUser?.name || otherId?.substring(0, 16) || 'Conversación';
    const roleLabel = this.otherUser?.role ? roleInfo(this.otherUser.role).label : '';

    const chatMain = document.getElementById('chat-main');
    chatMain.innerHTML = `
      <div class="chat-header">
        <div class="conv-avatar">${this.initials(otherName)}</div>
        <div class="chat-header__info">
          <span class="chat-header__name">${this.esc(otherName)}</span>
          ${roleLabel ? `<span class="chat-header__role">${roleLabel}</span>` : ''}
        </div>
      </div>
      <div class="chat-messages" id="chat-messages">
        <div class="loader">Cargando mensajes...</div>
      </div>
      <div id="typing-indicator" class="typing-indicator">Escribiendo...</div>
      <form class="chat-input" id="chat-input-form">
        <input type="text" id="chat-input" class="form__input" placeholder="Escribe un mensaje..." autocomplete="off">
        <button type="submit" class="btn btn--primary">Enviar</button>
      </form>`;

    // Mensaje opcional pre-cargado (p. ej. tras aceptar a un tutor).
    const prefill = sessionStorage.getItem('sc_chat_prefill');
    if (prefill) {
      sessionStorage.removeItem('sc_chat_prefill');
      const prefillInput = document.getElementById('chat-input');
      if (prefillInput) {
        prefillInput.value = prefill;
        prefillInput.focus();
      }
    }

    try {
      const data = await ChatService.getMessages(conversationId);
      const container = document.getElementById('chat-messages');
      container.innerHTML = '';
      this._lastDate = null;
      data.messages.reverse().forEach(msg => this.appendMessage(msg));
      this.scrollToBottom();
      this.updateReadReceipt();
      // Marco la conversación como leída hasta el último mensaje.
      const last = this.messages[this.messages.length - 1];
      if (last) ChatService.emitRead(conversationId, last.id);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') Toast.error('Error al cargar mensajes');
    }

    document.getElementById('chat-input-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const input = document.getElementById('chat-input');
      const text = input.value.trim();
      if (!text) return;
      input.value = '';
      ChatService.sendMessage(conversationId, text, (res) => {
        if (res?.error) {
          Toast.error(res.error);
        } else if (res?.message) {
          this.appendMessage(res.message);
          this.scrollToBottom();
        }
      });
    });

    const chatInput = document.getElementById('chat-input');
    chatInput.addEventListener('input', () => {
      ChatService.emitTypingStart(conversationId);
      clearTimeout(this.typingTimeout);
      this.typingTimeout = setTimeout(() => ChatService.emitTypingStop(conversationId), 1000);
    });

    document.querySelectorAll('.conv-item').forEach(item => {
      item.classList.toggle('active', item.dataset.id === conversationId);
    });
  },

  appendMessage(rawMsg) {
    const container = document.getElementById('chat-messages');
    if (!container) return;
    const msg = MessageMapper.toView(rawMsg);
    if (this.messages.some(m => m.id === msg.id)) return; // evita duplicados
    this.messages.push(msg);

    // Separador de fecha
    if (msg.date && msg.date !== this._lastDate) {
      this._lastDate = msg.date;
      const sep = document.createElement('div');
      sep.className = 'date-separator';
      sep.innerHTML = `<span>${msg.date}</span>`;
      container.appendChild(sep);
    }

    container.appendChild(this.buildMessageEl(msg));
  },

  buildMessageEl(msg) {
    const me = Auth.getUser();
    const isMine = msg.senderId === me.id;
    const div = document.createElement('div');
    div.className = `message ${isMine ? 'message--mine' : 'message--other'}`;
    div.dataset.mid = msg.id;
    div.innerHTML = this.messageInnerHtml(msg, isMine);
    this.wireMessageEvents(div, msg, isMine);
    return div;
  },

  messageInnerHtml(msg, isMine) {
    if (msg.deleted) {
      return `
        <div class="message__col">
          <div class="message__bubble message__bubble--deleted">
            <p class="message__text"><em>Mensaje eliminado</em></p>
          </div>
        </div>`;
    }

    const me = Auth.getUser();
    const avatar = isMine
      ? ''
      : `<div class="msg-avatar">${this.initials(this.otherUser?.name || '?')}</div>`;

    const reactionsHtml = this.reactionsHtml(msg, me.id);

    const actions = `
      <div class="message__actions">
        <button class="msg-action react-btn" title="Reaccionar">🙂</button>
        ${isMine ? '<button class="msg-action delete-btn" title="Eliminar">🗑️</button>' : ''}
        <div class="reaction-picker" style="display:none">
          ${REACTION_EMOJIS.map(e => `<button class="reaction-opt" data-emoji="${e}">${e}</button>`).join('')}
        </div>
      </div>`;

    return `
      ${avatar}
      <div class="message__col">
        <div class="message__bubble">
          <p class="message__text">${this.esc(msg.text)}</p>
        </div>
        <div class="message__reactions">${reactionsHtml}</div>
        <div class="message__meta">
          <span class="message__time">${msg.time}</span>
          ${isMine ? '<span class="message__seen"></span>' : ''}
        </div>
      </div>
      ${actions}`;
  },

  reactionsHtml(msg, myId) {
    const entries = Object.entries(msg.reactions || {}).filter(([, ids]) => (ids || []).length);
    return entries.map(([emoji, ids]) => {
      const mine = ids.includes(myId) ? 'reaction-chip--mine' : '';
      return `<button class="reaction-chip ${mine}" data-emoji="${emoji}">${emoji} ${ids.length}</button>`;
    }).join('');
  },

  wireMessageEvents(div, msg, isMine) {
    if (msg.deleted) return;

    const reactBtn = div.querySelector('.react-btn');
    const picker = div.querySelector('.reaction-picker');
    reactBtn?.addEventListener('click', () => {
      const open = picker.style.display !== 'none';
      document.querySelectorAll('.reaction-picker').forEach(p => { p.style.display = 'none'; });
      picker.style.display = open ? 'none' : 'flex';
    });

    div.querySelectorAll('.reaction-opt').forEach(opt => {
      opt.addEventListener('click', () => {
        picker.style.display = 'none';
        this.toggleReaction(msg.id, opt.dataset.emoji);
      });
    });

    div.querySelectorAll('.reaction-chip').forEach(chip => {
      chip.addEventListener('click', () => this.toggleReaction(msg.id, chip.dataset.emoji));
    });

    if (isMine) {
      div.querySelector('.delete-btn')?.addEventListener('click', () => {
        if (!confirm('¿Eliminar este mensaje?')) return;
        ChatService.deleteMessage(msg.id, (res) => {
          if (res?.error) Toast.error(res.error);
          else this.applyDeletion(msg.id);
        });
      });
    }
  },

  toggleReaction(messageId, emoji) {
    const me = Auth.getUser();
    const msg = this.messages.find(m => m.id === messageId);
    if (!msg) return;
    const ids = (msg.reactions && msg.reactions[emoji]) || [];
    const action = ids.includes(me.id) ? 'remove' : 'add';
    // Actualización optimista
    this.applyReaction(messageId, emoji, me.id, action);
    ChatService.reactToMessage(messageId, emoji, action, (res) => {
      if (res?.error) {
        Toast.error(res.error);
        this.applyReaction(messageId, emoji, me.id, action === 'add' ? 'remove' : 'add');
      }
    });
  },

  applyReaction(messageId, emoji, userId, action) {
    const msg = this.messages.find(m => m.id === messageId);
    if (!msg) return;
    if (!msg.reactions) msg.reactions = {};
    const ids = msg.reactions[emoji] || [];
    if (action === 'remove') {
      msg.reactions[emoji] = ids.filter(id => id !== userId);
      if (!msg.reactions[emoji].length) delete msg.reactions[emoji];
    } else if (!ids.includes(userId)) {
      msg.reactions[emoji] = [...ids, userId];
    }
    this.refreshReactions(messageId);
  },

  refreshReactions(messageId) {
    const div = document.querySelector(`.message[data-mid="${messageId}"]`);
    if (!div) return;
    const msg = this.messages.find(m => m.id === messageId);
    const me = Auth.getUser();
    const slot = div.querySelector('.message__reactions');
    if (!slot || !msg) return;
    slot.innerHTML = this.reactionsHtml(msg, me.id);
    slot.querySelectorAll('.reaction-chip').forEach(chip => {
      chip.addEventListener('click', () => this.toggleReaction(messageId, chip.dataset.emoji));
    });
  },

  applyDeletion(messageId) {
    const msg = this.messages.find(m => m.id === messageId);
    if (msg) {
      msg.deleted = true;
      msg.text = 'Mensaje eliminado';
    }
    const div = document.querySelector(`.message[data-mid="${messageId}"]`);
    if (div && msg) {
      const isMine = msg.senderId === Auth.getUser().id;
      div.innerHTML = this.messageInnerHtml(msg, isMine);
    }
  },

  // Marca como "Visto" mi último mensaje si la otra persona ya lo leyó.
  updateReadReceipt() {
    document.querySelectorAll('.message__seen').forEach(el => { el.textContent = ''; });
    if (!this.lastReadByOther) return;
    const me = Auth.getUser();
    const myMsgs = this.messages.filter(m => m.senderId === me.id);
    if (!myMsgs.length) return;
    const lastMine = myMsgs[myMsgs.length - 1];
    const readIdx = this.messages.findIndex(m => m.id === this.lastReadByOther);
    const mineIdx = this.messages.findIndex(m => m.id === lastMine.id);
    if (readIdx >= 0 && readIdx >= mineIdx) {
      const div = document.querySelector(`.message[data-mid="${lastMine.id}"]`);
      const seen = div?.querySelector('.message__seen');
      if (seen) seen.textContent = '✓✓ Visto';
    }
  },

  scrollToBottom() {
    const c = document.getElementById('chat-messages');
    if (c) c.scrollTop = c.scrollHeight;
  },

  async loadUserList() {
    try {
      const users = await UserService.search({});
      const me = Auth.getUser();
      this._allUsers = users.filter(u => u.id !== me?.id);
      this.renderUserList(this._allUsers);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') Toast.error('Error al cargar usuarios');
    }
  },

  renderUserList(users) {
    const resultsEl = document.getElementById('new-conv-results');
    if (!users.length) {
      resultsEl.innerHTML = '<p class="empty-state new-conv-empty">Sin resultados</p>';
      return;
    }
    resultsEl.innerHTML = users.map(u => {
      const { label: roleLabel, cls: roleClass } = roleInfo(u.role);
      return `
        <div class="new-conv-user" data-uid="${u.id}">
          <div class="new-conv-user__info">
            <span class="new-conv-user__name">${this.esc(u.name)}</span>
            <span class="new-conv-user__email">${this.esc(u.email)}</span>
          </div>
          <span class="badge ${roleClass}">${roleLabel}</span>
        </div>`;
    }).join('');
    resultsEl.querySelectorAll('.new-conv-user').forEach(item => {
      item.addEventListener('click', () => this.startConversationWith(item.dataset.uid));
    });
  },

  filterUserList(query) {
    if (!this._allUsers) return;
    if (!query) { this.renderUserList(this._allUsers); return; }
    const filtered = this._allUsers.filter(u =>
      u.name?.toLowerCase().includes(query) ||
      u.email?.toLowerCase().includes(query) ||
      u.role?.toLowerCase().includes(query)
    );
    this.renderUserList(filtered);
  },

  async startConversationWith(userId) {
    try {
      const me = Auth.getUser();
      const conv = await ChatService.createConversation([me.id, userId]);
      document.getElementById('new-conv-panel').style.display = 'none';
      document.getElementById('new-conv-search').value = '';
      await this.loadConversations();
      await this.openConversation(conv._id);
    } catch (err) {
      if (err.message !== 'SESSION_EXPIRED') Toast.error('Error al crear conversación');
    }
  },

  initials(name) {
    return (name || '?')
      .trim()
      .split(/\s+/)
      .slice(0, 2)
      .map(w => w[0]?.toUpperCase() || '')
      .join('') || '?';
  },

  esc(str) {
    const d = document.createElement('div');
    d.textContent = str || '';
    return d.innerHTML;
  },
};
