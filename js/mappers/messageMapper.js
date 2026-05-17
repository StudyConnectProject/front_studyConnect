export const MessageMapper = {
  toView(msg) {
    return {
      id: msg._id || msg.id,
      conversationId: msg.conversationId,
      senderId: msg.senderId,
      text: msg.text,
      reactions: msg.reactions || {},
      deleted: msg.deleted || false,
      createdAt: msg.createdAt,
      time: msg.createdAt
        ? new Date(msg.createdAt).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
        : '',
      date: msg.createdAt
        ? new Date(msg.createdAt).toLocaleDateString('es-ES')
        : '',
    };
  },
};
