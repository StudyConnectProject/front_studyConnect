import { Config } from '../config.js';
import { Auth } from '../utils/auth.js';
import { MessageMapper } from '../mappers/messageMapper.js';

export const ChatService = {
  socket: null,

  connect() {
    if (this.socket?.connected) return;
    const token = Auth.getToken();
    this.socket = io({ auth: { token } });
    this.socket.on('connect_error', (err) => {
      console.error('[WS] Error:', err.message);
    });
  },

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  },

  joinConversation(conversationId, callback) {
    this.socket?.emit('conversation.join', { conversationId }, callback);
  },

  leaveConversation(conversationId) {
    this.socket?.emit('conversation.leave', { conversationId });
  },

  sendMessage(conversationId, text, callback) {
    const clientMessageId = crypto.randomUUID();
    this.socket?.emit('message.send', { conversationId, text, clientMessageId }, callback);
  },

  onNewMessage(callback) { this.socket?.on('message.new', callback); },
  onTypingStart(callback) { this.socket?.on('typing.start', callback); },
  onTypingStop(callback) { this.socket?.on('typing.stop', callback); },
  onReadReceipt(callback) { this.socket?.on('message.read', callback); },
  onReaction(callback) { this.socket?.on('message.react', callback); },
  onMessageDeleted(callback) { this.socket?.on('message.deleted', callback); },

  emitTypingStart(conversationId) { this.socket?.emit('typing.start', { conversationId }); },
  emitTypingStop(conversationId) { this.socket?.emit('typing.stop', { conversationId }); },

  // Reacciona (action: 'add') o quita la reacción (action: 'remove') de un mensaje.
  reactToMessage(messageId, emoji, action, callback) {
    this.socket?.emit('message.react', { messageId, emoji, action }, callback);
  },

  // Borra un mensaje propio.
  deleteMessage(messageId, callback) {
    this.socket?.emit('message.delete', { messageId }, callback);
  },

  // Marca la conversación como leída hasta lastMessageId.
  emitRead(conversationId, lastMessageId) {
    this.socket?.emit('message.read', { conversationId, lastMessageId });
  },

  async getConversations() {
    const res = await Auth.fetchWithAuth(`${Config.API.CONVERSATIONS}`);
    if (!res.ok) throw new Error('Error al cargar conversaciones');
    return await res.json();
  },

  async createConversation(participants) {
    const res = await Auth.fetchWithAuth(`${Config.API.CONVERSATIONS}`, {
      method: 'POST',
      body: JSON.stringify({ participants }),
    });
    if (!res.ok) throw new Error('Error al crear conversación');
    return await res.json();
  },

  async deleteConversation(conversationId) {
    const res = await Auth.fetchWithAuth(`${Config.API.CONVERSATIONS}/${conversationId}`, {
      method: 'DELETE',
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.message || 'Error al eliminar la conversación');
    }
    return await res.json().catch(() => ({}));
  },

  async getMessages(conversationId, cursor = null, limit = 20) {
    let url = `${Config.API.CONVERSATIONS}/${conversationId}/messages?limit=${limit}`;
    if (cursor) url += `&cursor=${cursor}`;
    const res = await Auth.fetchWithAuth(url);
    if (!res.ok) throw new Error('Error al cargar mensajes');
    const data = await res.json();
    data.messages = data.messages.map(MessageMapper.toView);
    return data;
  },

  async markAsRead(conversationId, lastMessageId) {
    await Auth.fetchWithAuth(`${Config.API.CONVERSATIONS}/${conversationId}/read-receipts`, {
      method: 'POST',
      body: JSON.stringify({ lastMessageId }),
    });
  },
};
