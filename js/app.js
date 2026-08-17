const App = {
  data: null,
  currentAbortController: null,
  isGenerating: false,
  tempMessageIndices: { user: -1, ai: -1 },

  init() {
    this.data = Storage.load();
    Markdown.init();
    this.bindEvents();
    this.renderAll();
    this.updateAPIStatus();
  },

  bindEvents() {
    document.getElementById('newChatBtn').addEventListener('click', () => this.createNewChat());
    document.getElementById('sidebarToggle').addEventListener('click', () => {
      document.getElementById('sidebar').classList.toggle('mobile-open');
    });
    document.getElementById('settingsBtn').addEventListener('click', () => this.openSettings());
    document.getElementById('settingsClose').addEventListener('click', () => this.closeSettings());
    document.getElementById('saveSettingsBtn').addEventListener('click', () => this.saveSettings());
    document.getElementById('resetBtn').addEventListener('click', () => {
      if (confirm('确定重置所有数据？这将删除所有会话和设置！')) {
        Storage.reset();
        this.data = Storage.defaultData();
        this.renderAll();
        this.closeSettings();
        UI.showToast('已重置', 'success');
      }
    });

    document.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
        document.querySelectorAll('.provider-panel').forEach(p => p.classList.add('hidden'));
        btn.classList.add('active');
        document.querySelector(`.provider-panel[data-provider="${btn.dataset.provider}"]`).classList.remove('hidden');
      });
    });

    document.getElementById('temperature').addEventListener('input', (e) => {
      document.getElementById('tempValue').textContent = parseFloat(e.target.value).toFixed(1);
    });

    document.getElementById('modelSelect').addEventListener('change', (e) => {
      if (this.data.activeChatId) {
        const chat = Storage.getChat(this.data, this.data.activeChatId);
        if (chat) chat.model = e.target.value;
        Storage.save(this.data);
      }
    });

    document.getElementById('clearChatBtn').addEventListener('click', () => {
      if (!this.data.activeChatId) return;
      if (confirm('确定清空当前会话的所有消息？')) {
        Storage.clearChat(this.data, this.data.activeChatId);
        const chat = Storage.getChat(this.data, this.data.activeChatId);
        this.renderChat();
        this.renderChatList();
      }
    });

    document.getElementById('searchInput').addEventListener('input', (e) => {
      this.renderChatList(e.target.value);
    });

    const input = document.getElementById('inputBox');
    input.addEventListener('input', () => UI.autoResizeTextarea(input));
    input.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        this.sendMessage();
      }
    });

    document.getElementById('sendBtn').addEventListener('click', () => this.sendMessage());
    document.getElementById('stopBtn').addEventListener('click', () => this.stopGeneration());

    document.querySelectorAll('.suggestion-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('inputBox').value = btn.dataset.prompt;
        this.sendMessage();
      });
    });

    document.getElementById('editClose').addEventListener('click', () => this.closeEdit());
    document.getElementById('editCancelBtn').addEventListener('click', () => this.closeEdit());
    document.getElementById('editSaveBtn').addEventListener('click', () => this.saveEdit());

    document.getElementById('editModal').addEventListener('click', (e) => {
      if (e.target.id === 'editModal') this.closeEdit();
    });
    document.getElementById('settingsModal').addEventListener('click', (e) => {
      if (e.target.id === 'settingsModal') this.closeSettings();
    });
  },

  renderAll() {
    this.renderChatList();
    this.renderChat();
  },

  renderChatList(search) {
    UI.renderChatList(
      this.data,
      (id) => this.selectChat(id),
      (id) => this.deleteChat(id),
      (id) => this.renameChat(id),
      search
    );
  },

  renderChat() {
    const chat = this.data.activeChatId ? Storage.getChat(this.data, this.data.activeChatId) : null;
    UI.renderMessages(chat, 
      (idx) => this.openEdit(idx), 
      (idx) => this.deleteMessage(idx)
    );
    UI.updateChatTitle(chat ? chat.title : '新会话');

    if (chat?.model) {
      document.getElementById('modelSelect').value = chat.model;
    }
  },

  createNewChat() {
    const chat = Storage.newChat('新会话');
    this.data.chats.unshift(chat);
    this.data.activeChatId = chat.id;
    Storage.save(this.data);
    this.renderChatList();
    this.renderChat();
    document.getElementById('sidebar').classList.remove('mobile-open');
    setTimeout(() => document.getElementById('inputBox').focus(), 100);
  },

  selectChat(id) {
    this.data.activeChatId = id;
    Storage.save(this.data);
    this.renderChatList();
    this.renderChat();
    document.getElementById('sidebar').classList.remove('mobile-open');
  },

  deleteChat(id) {
    Storage.deleteChat(this.data, id);
    this.renderChatList();
    this.renderChat();
  },

  renameChat(id) {
    const chat = Storage.getChat(this.data, id);
    if (!chat) return;
    const newTitle = prompt('重命名会话：', chat.title);
    if (newTitle && newTitle.trim()) {
      Storage.updateChatTitle(this.data, id, newTitle.trim());
      this.renderChatList();
      if (this.data.activeChatId === id) {
        UI.updateChatTitle(newTitle.trim());
      }
    }
  },

  sendMessage() {
    if (this.isGenerating) return;

    const input = document.getElementById('inputBox');
    const content = input.value.trim();
    if (!content) return;

    if (!this.data.activeChatId) {
      this.createNewChat();
    }

    this.isGenerating = true;
    this.updateSendButton();

    const chat = Storage.getChat(this.data, this.data.activeChatId);
    if (!chat) return;

    if (chat.title === '新会话') {
      const title = content.length > 20 ? content.slice(0, 20) + '...' : content;
      Storage.updateChatTitle(this.data, chat.id, title);
      UI.updateChatTitle(title);
    }

    Storage.addMessage(this.data, chat.id, 'user', content);
    input.value = '';
    UI.autoResizeTextarea(input);
    this.renderChatList();
    this.renderChat();

    this.generateReply();
  },

  async generateReply() {
    const chat = Storage.getChat(this.data, this.data.activeChatId);
    if (!chat) { this.isGenerating = false; this.updateSendButton(); return; }

    const apiKey = Api.getProviderConfig(this.data.settings).apiKey;
    if (!apiKey) {
      UI.showToast('请先在设置中配置 API Key', 'error');
      this.isGenerating = false;
      this.updateSendButton();
      this.openSettings();
      return;
    }

    const model = chat.model || document.getElementById('modelSelect').value;
    const messages = chat.messages.map(m => ({ role: m.role, content: m.content }));

    const aiTempDiv = UI.appendAIMessage();
    this.currentAbortController = new AbortController();

    try {
      const fullContent = await Api.sendMessages(
        messages, model, this.data.settings,
        (chunk, accumulated) => UI.updateAIMessage(aiTempDiv, accumulated),
        this.currentAbortController.signal
      );

      Storage.addMessage(this.data, chat.id, 'assistant', fullContent);
      const finalIdx = chat.messages.length - 1;
      UI.finishAIMessage(aiTempDiv, finalIdx,
        (idx) => this.openEdit(idx),
        (idx) => this.deleteMessage(idx)
      );

    } catch (e) {
      if (e.name === 'AbortError') {
        const partial = aiTempDiv.querySelector('.message-text').innerText;
        if (partial.trim()) {
          Storage.addMessage(this.data, chat.id, 'assistant', partial);
        } else {
          aiTempDiv.remove();
        }
      } else {
        UI.showToast(e.message || '生成失败', 'error');
        aiTempDiv.querySelector('.message-text').innerHTML = 
          `<span style="color:#e74c3c">❌ 出错：${UI.escapeHtml(e.message)}</span>`;
      }
    } finally {
      this.isGenerating = false;
      this.currentAbortController = null;
      this.updateSendButton();
    }
  },

  stopGeneration() {
    if (this.currentAbortController) {
      this.currentAbortController.abort();
    }
  },

  updateSendButton() {
    const sendBtn = document.getElementById('sendBtn');
    const stopBtn = document.getElementById('stopBtn');
    sendBtn.style.display = this.isGenerating ? 'none' : 'flex';
    stopBtn.style.display = this.isGenerating ? 'flex' : 'none';
    sendBtn.disabled = this.isGenerating;
  },

  deleteMessage(index) {
    const chat = Storage.getChat(this.data, this.data.activeChatId);
    if (!chat) return;

    let deleteCount = 1;
    if (chat.messages[index]?.role === 'user') {
      if (chat.messages[index + 1]?.role === 'assistant') deleteCount = 2;
    } else if (chat.messages[index]?.role === 'assistant') {
      let lookIdx = index - 1;
      while (lookIdx >= 0 && chat.messages[lookIdx]?.role === 'assistant') lookIdx--;
      if (lookIdx >= 0 && chat.messages[lookIdx]?.role === 'user') {
        Storage.deleteMessage(this.data, chat.id, lookIdx);
        index--;
      }
    }

    for (let i = 0; i < deleteCount; i++) {
      Storage.deleteMessage(this.data, chat.id, index);
    }
    this.renderChat();
  },

  openEdit(index) {
    const chat = Storage.getChat(this.data, this.data.activeChatId);
    if (!chat || !chat.messages[index]) return;

    const msg = chat.messages[index];
    let editableMsg = msg;
    let editableIndex = index;

    if (msg.role === 'assistant') {
      let userIdx = index - 1;
      while (userIdx >= 0 && chat.messages[userIdx]?.role === 'assistant') userIdx--;
      if (userIdx < 0) {
        UI.showToast('AI 消息需要编辑前面的用户消息', 'error');
        return;
      }
      editableMsg = chat.messages[userIdx];
      editableIndex = userIdx;
    }

    this.editingIndex = editableIndex;
    document.getElementById('editTextarea').value = editableMsg.content;
    document.getElementById('editModal').classList.remove('hidden');
  },

  closeEdit() {
    document.getElementById('editModal').classList.add('hidden');
    this.editingIndex = null;
  },

  async saveEdit() {
    const chat = Storage.getChat(this.data, this.data.activeChatId);
    if (!chat || this.editingIndex === null) return;

    const newContent = document.getElementById('editTextarea').value.trim();
    if (!newContent) {
      UI.showToast('消息内容不能为空', 'error');
      return;
    }

    const editingRole = chat.messages[this.editingIndex].role;

    Storage.updateMessage(this.data, chat.id, this.editingIndex, newContent);

    if (editingRole === 'user') {
      while (chat.messages.length > this.editingIndex + 1) {
        Storage.deleteMessage(this.data, chat.id, this.editingIndex + 1);
      }
    } else {
      Storage.deleteMessage(this.data, chat.id, this.editingIndex);
    }

    this.closeEdit();
    this.renderChat();

    if (editingRole === 'user') {
      await new Promise(r => setTimeout(r, 100));
      this.generateReply();
    }
  },

  openSettings() {
    const s = this.data.settings;
    document.getElementById('dsApiKey').value = s.apiKeys.deepseek || '';
    document.getElementById('dsBaseUrl').value = s.baseUrls.deepseek || 'https://api.deepseek.com/v1';
    document.getElementById('oaApiKey').value = s.apiKeys.openai || '';
    document.getElementById('oaBaseUrl').value = s.baseUrls.openai || 'https://api.openai.com/v1';
    document.getElementById('cuApiKey').value = s.apiKeys.custom || '';
    document.getElementById('cuBaseUrl').value = s.baseUrls.custom || '';
    document.getElementById('activeProvider').value = s.activeProvider || 'deepseek';
    document.getElementById('temperature').value = s.temperature ?? 1;
    document.getElementById('tempValue').textContent = (s.temperature ?? 1).toFixed(1);

    document.getElementById('settingsModal').classList.remove('hidden');
  },

  closeSettings() {
    document.getElementById('settingsModal').classList.add('hidden');
  },

  saveSettings() {
    const s = this.data.settings;
    s.apiKeys.deepseek = document.getElementById('dsApiKey').value.trim();
    s.baseUrls.deepseek = document.getElementById('dsBaseUrl').value.trim() || 'https://api.deepseek.com/v1';
    s.apiKeys.openai = document.getElementById('oaApiKey').value.trim();
    s.baseUrls.openai = document.getElementById('oaBaseUrl').value.trim() || 'https://api.openai.com/v1';
    s.apiKeys.custom = document.getElementById('cuApiKey').value.trim();
    s.baseUrls.custom = document.getElementById('cuBaseUrl').value.trim();
    s.activeProvider = document.getElementById('activeProvider').value;
    s.temperature = parseFloat(document.getElementById('temperature').value);

    Storage.save(this.data);
    this.updateAPIStatus();
    this.closeSettings();
    UI.showToast('设置已保存', 'success');
  },

  updateAPIStatus() {
    const cfg = Api.getProviderConfig(this.data.settings);
    UI.setAPIDateStatus(!!cfg.apiKey);
  }
};

document.addEventListener('DOMContentLoaded', () => App.init());
