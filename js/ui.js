const UI = {
  welcomeEl: null,

  showToast(message, type = '') {
    const toast = document.createElement('div');
    toast.className = 'toast ' + type;
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2500);
  },

  renderChatList(data, onSelect, onDelete, onRename, searchQuery = '') {
    const list = document.getElementById('chatList');
    const query = (searchQuery || '').toLowerCase().trim();

    let chats = [...data.chats].sort((a, b) => b.createdAt - a.createdAt);
    if (query) chats = chats.filter(c => c.title.toLowerCase().includes(query));

    if (chats.length === 0) { list.innerHTML = ''; return; }

    list.innerHTML = chats.map(chat => {
      const active = chat.id === data.activeChatId ? 'active' : '';
      const safeTitle = chat.title.replace(/"/g, '&quot;');
      return `
        <div class="chat-item ${active}" data-id="${chat.id}">
          <div class="chat-item-title" title="${safeTitle}">${this.escapeHtml(chat.title)}</div>
          <div class="chat-item-actions">
            <button class="rename-btn" title="重命名" data-id="${chat.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="delete-btn" title="删除" data-id="${chat.id}">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.chat-item').forEach(item => {
      item.addEventListener('click', (e) => {
        if (e.target.closest('.delete-btn') || e.target.closest('.rename-btn')) return;
        onSelect(item.dataset.id);
      });
    });

    list.querySelectorAll('.delete-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (confirm('确定删除此会话？')) onDelete(btn.dataset.id);
      });
    });

    list.querySelectorAll('.rename-btn').forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        onRename(btn.dataset.id);
      });
    });
  },

  renderMessages(chat, onEdit, onDelete) {
    const container = document.getElementById('messages');
    const welcome = document.getElementById('welcomeScreen');
    this.welcomeEl = welcome;

    if (!chat || chat.messages.length === 0) {
      container.innerHTML = '';
      welcome.style.display = '';
      container.appendChild(welcome);
      return;
    }

    welcome.style.display = 'none';

    container.innerHTML = chat.messages.map((msg, idx) => this.messageHTML(msg, idx)).join('');

    container.querySelectorAll('.message-edit-btn').forEach(btn => {
      btn.addEventListener('click', () => onEdit(parseInt(btn.dataset.index)));
    });

    container.querySelectorAll('.message-delete-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (confirm('确定删除此消息？删除后 AI 的回复也会被移除。')) {
          onDelete(parseInt(btn.dataset.index));
        }
      });
    });

    this.scrollToBottom();
  },

  messageHTML(msg, idx) {
    const isUser = msg.role === 'user';
    const avatar = isUser ? 'Z' : 'AI';
    const content = isUser
      ? this.escapeHtml(msg.content).replace(/\n/g, '<br>')
      : Markdown.render(msg.content);

    return `
      <div class="message ${isUser ? 'user' : 'ai'}" data-idx="${idx}">
        <div class="message-avatar">${avatar}</div>
        <div class="message-content">
          <div class="message-text">${content}</div>
          <div class="message-actions">
            <button class="message-action-btn message-edit-btn" data-index="${idx}" title="编辑">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
            </button>
            <button class="message-action-btn message-delete-btn" data-index="${idx}" title="删除">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
            </button>
            ${!isUser ? `
              <button class="message-action-btn message-copy-btn" title="复制">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
              </button>
            ` : ''}
          </div>
        </div>
      </div>
    `;
  },

  hideWelcome() {
    const welcome = document.getElementById('welcomeScreen');
    if (welcome) welcome.style.display = 'none';
  },

  appendUserMessage(content) {
    this.hideWelcome();
    const container = document.getElementById('messages');

    const div = document.createElement('div');
    div.className = 'message user';
    div.innerHTML = `
      <div class="message-avatar">Z</div>
      <div class="message-content">
        <div class="message-text">${this.escapeHtml(content).replace(/\n/g, '<br>')}</div>
      </div>
    `;
    container.appendChild(div);
    this.scrollToBottom();
    return div;
  },

  appendAIMessage() {
    this.hideWelcome();
    const container = document.getElementById('messages');

    const div = document.createElement('div');
    div.className = 'message ai';
    div.innerHTML = `
      <div class="message-avatar">AI</div>
      <div class="message-content">
        <div class="message-text"><span class="typing-indicator"><span></span><span></span><span></span></span></div>
      </div>
    `;
    container.appendChild(div);
    this.scrollToBottom();
    return div;
  },

  updateAIMessage(tempDiv, content) {
    const textEl = tempDiv.querySelector('.message-text');
    if (!textEl) return;
    textEl.innerHTML = Markdown.render(content);
    this.scrollToBottom();
  },

  finishAIMessage(tempDiv, finalIndex, onEdit, onDelete) {
    const textEl = tempDiv.querySelector('.message-text');
    const renderedHTML = textEl.innerHTML;
    const contentDiv = tempDiv.querySelector('.message-content');
    contentDiv.innerHTML = '';

    const textWrap = document.createElement('div');
    textWrap.className = 'message-text';
    textWrap.innerHTML = renderedHTML;

    const actionsDiv = document.createElement('div');
    actionsDiv.className = 'message-actions';
    actionsDiv.innerHTML = `
      <button class="message-action-btn message-edit-btn" title="编辑">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      </button>
      <button class="message-action-btn message-delete-btn" title="删除">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
      </button>
      <button class="message-action-btn message-copy-btn" title="复制">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>
      </button>
    `;

    actionsDiv.querySelector('.message-edit-btn').addEventListener('click', () => onEdit(finalIndex));
    actionsDiv.querySelector('.message-delete-btn').addEventListener('click', () => {
      if (confirm('确定删除此消息？删除后 AI 的回复也会被移除。')) onDelete(finalIndex);
    });
    actionsDiv.querySelector('.message-copy-btn').addEventListener('click', () => {
      const text = textWrap.innerText;
      if (navigator.clipboard) navigator.clipboard.writeText(text).then(() => UI.showToast('已复制', 'success'));
    });

    contentDiv.appendChild(textWrap);
    contentDiv.appendChild(actionsDiv);

    tempDiv.removeAttribute('data-temp');
    tempDiv.dataset.idx = finalIndex;
  },

  scrollToBottom() {
    const container = document.getElementById('messages');
    container.scrollTop = container.scrollHeight;
  },

  updateChatTitle(title) {
    document.getElementById('chatTitle').textContent = title;
  },

  setAPIDateStatus(hasKey) {
    const el = document.getElementById('apiStatus');
    if (hasKey) {
      el.textContent = 'API 已就绪';
      el.style.color = '#27ae60';
    } else {
      el.textContent = 'API 未配置';
      el.style.color = '';
    }
  },

  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  },

  autoResizeTextarea(textarea) {
    textarea.style.height = 'auto';
    textarea.style.height = Math.min(textarea.scrollHeight, 200) + 'px';
  }
};
