const Storage = {
  DB_KEY: 'zhiku_ai_data',

  load() {
    try {
      const raw = localStorage.getItem(this.DB_KEY);
      if (!raw) return this.defaultData();
      return JSON.parse(raw);
    } catch (e) {
      console.warn('Failed to load storage:', e);
      return this.defaultData();
    }
  },

  save(data) {
    try {
      localStorage.setItem(this.DB_KEY, JSON.stringify(data));
    } catch (e) {
      console.warn('Failed to save storage:', e);
    }
  },

  defaultData() {
    return {
      chats: [],
      activeChatId: null,
      settings: {
        apiKeys: { deepseek: '', openai: '', custom: '' },
        baseUrls: {
          deepseek: 'https://api.deepseek.com/v1',
          openai: 'https://api.openai.com/v1',
          custom: ''
        },
        activeProvider: 'deepseek',
        temperature: 1
      }
    };
  },

  newChat(title) {
    const chat = {
      id: 'chat_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
      title: title || '新会话',
      createdAt: Date.now(),
      messages: []
    };
    return chat;
  },

  getChat(data, chatId) {
    return data.chats.find(c => c.id === chatId);
  },

  deleteChat(data, chatId) {
    data.chats = data.chats.filter(c => c.id !== chatId);
    if (data.activeChatId === chatId) {
      data.activeChatId = data.chats.length > 0 ? data.chats[0].id : null;
    }
    this.save(data);
  },

  updateMessage(data, chatId, messageIndex, newContent) {
    const chat = this.getChat(data, chatId);
    if (!chat || !chat.messages[messageIndex]) return;
    chat.messages[messageIndex].content = newContent;
    this.save(data);
  },

  deleteMessage(data, chatId, messageIndex) {
    const chat = this.getChat(data, chatId);
    if (!chat) return;
    chat.messages.splice(messageIndex, 1);
    this.save(data);
  },

  addMessage(data, chatId, role, content) {
    const chat = this.getChat(data, chatId);
    if (!chat) return null;
    const msg = {
      id: 'msg_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
      role,
      content,
      timestamp: Date.now()
    };
    chat.messages.push(msg);
    this.save(data);
    return msg;
  },

  clearChat(data, chatId) {
    const chat = this.getChat(data, chatId);
    if (chat) {
      chat.messages = [];
      this.save(data);
    }
  },

  updateChatTitle(data, chatId, title) {
    const chat = this.getChat(data, chatId);
    if (chat) {
      chat.title = title;
      this.save(data);
    }
  },

  getAllMessagesUpTo(data, chatId, messageIndex) {
    const chat = this.getChat(data, chatId);
    if (!chat) return [];
    return chat.messages.slice(0, messageIndex + 1);
  },

  reset() {
    localStorage.removeItem(this.DB_KEY);
  }
};
