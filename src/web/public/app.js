function app() {
  return {
    currentView: 'characters',
    mobileMenuOpen: false,
    characters: [],
    selectedCharacter: '',
    messages: [],
    totalMessages: 0,
    selectedMessages: [],
    editingMessageId: null,
    editingMessageContent: '',
    editingCharacter: null,
    personaFiles: [],
    currentPersonaFile: null,
    currentPersonaContent: '',
    showNewCharacterModal: false,
    newCharacterName: '',
    newCharacterDisplayName: '',
    newCharacterCopyFrom: '',
    messageLimit: 50,
    messageOffset: 0,
    newMessage: '',
    isSending: false,

    // 配置管理
    configContent: '',
    configLoading: false,
    configSaving: false,

    // 系统状态
    status: {},
    logs: [],
    logFilter: 'all',
    autoRefreshInterval: null,

    async init() {
      await this.loadCharacters();
    },

    getCharacterDisplayName(name) {
      // 从角色列表中查找display_name
      const char = this.characters.find(c => c.name === name);
      return char?.display_name || name;
    },

    async loadCharacters() {
      const res = await fetch('/api/characters');
      this.characters = await res.json();
    },

    async loadMessages() {
      if (!this.selectedCharacter) return;

      // 重置offset，从最新的消息开始加载
      this.messageOffset = 0;

      // 计算从哪里开始加载最新的消息
      const res = await fetch(`/api/messages/${this.selectedCharacter}?limit=${this.messageLimit}&offset=${this.messageOffset}`);
      const data = await res.json();

      // 计算最新消息的offset
      const latestOffset = Math.max(0, data.total - this.messageLimit);

      // 重新加载最新的消息
      const latestRes = await fetch(`/api/messages/${this.selectedCharacter}?limit=${this.messageLimit}&offset=${latestOffset}`);
      const latestData = await latestRes.json();

      // 数据库返回的是升序（旧到新），直接使用
      this.messages = latestData.messages;
      this.totalMessages = data.total;
      this.messageOffset = latestOffset;
      this.selectedMessages = [];

      // 滚动到底部
      this.$nextTick(() => {
        const container = document.getElementById('chatContainer');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });
    },

    async loadMoreMessages() {
      if (!this.selectedCharacter) return;

      // 如果已经加载到最开始了，不再加载
      if (this.messageOffset === 0) {
        return;
      }

      // 保存当前滚动位置
      const container = document.getElementById('chatContainer');
      const oldScrollHeight = container ? container.scrollHeight : 0;

      // 计算新的offset，向前加载
      const newOffset = Math.max(0, this.messageOffset - this.messageLimit);
      const loadCount = this.messageOffset - newOffset;

      const res = await fetch(`/api/messages/${this.selectedCharacter}?limit=${loadCount}&offset=${newOffset}`);
      const data = await res.json();

      // 将旧消息追加到前面
      this.messages = [...data.messages, ...this.messages];
      this.messageOffset = newOffset;

      // 恢复滚动位置，保持在原来的消息位置
      this.$nextTick(() => {
        if (container) {
          const newScrollHeight = container.scrollHeight;
          container.scrollTop = newScrollHeight - oldScrollHeight;
        }
      });
    },

    toggleMessageSelection(id) {
      const index = this.selectedMessages.indexOf(id);
      if (index > -1) {
        this.selectedMessages.splice(index, 1);
      } else {
        this.selectedMessages.push(id);
      }
    },

    clearSelection() {
      this.selectedMessages = [];
      // Uncheck all checkboxes
      document.querySelectorAll('input[type="checkbox"]').forEach(cb => {
        if (cb.value && this.messages.find(m => m.id == cb.value)) {
          cb.checked = false;
        }
      });
    },

    async deleteSelectedMessages() {
      if (!confirm(`确定删除选中的 ${this.selectedMessages.length} 条消息吗？`)) {
        return;
      }

      for (const id of this.selectedMessages) {
        await fetch(`/api/messages/${this.selectedCharacter}/${id}`, {
          method: 'DELETE'
        });
      }

      this.selectedMessages = [];
      await this.loadMessages();
      alert('删除成功');
    },

    async clearAllMessages() {
      if (!confirm('确定删除所有消息吗？此操作不可恢复！')) {
        return;
      }

      await fetch(`/api/messages/${this.selectedCharacter}`, {
        method: 'DELETE'
      });

      await this.loadMessages();
      alert('删除成功');
    },

    editMessage(msg) {
      this.editingMessageId = msg.id;
      this.editingMessageContent = msg.content;
    },

    async saveMessage(id) {
      await fetch(`/api/messages/${this.selectedCharacter}/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.editingMessageContent })
      });

      this.editingMessageId = null;
      await this.loadMessages();
    },

    async editCharacter(name) {
      this.editingCharacter = name;

      const res = await fetch(`/api/persona/${name}`);
      const data = await res.json();
      this.personaFiles = data.files;

      if (this.personaFiles.length > 0) {
        this.currentPersonaFile = this.personaFiles[0].name;
        this.currentPersonaContent = this.personaFiles[0].content;
      }
    },

    async savePersonaFile() {
      await fetch(`/api/persona/${this.editingCharacter}/${this.currentPersonaFile}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: this.currentPersonaContent })
      });

      alert('保存成功');
      await this.editCharacter(this.editingCharacter);
    },

    async createCharacter() {
      if (!this.newCharacterName) {
        alert('请输入英文ID');
        return;
      }

      try {
        const res = await fetch('/api/characters', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            name: this.newCharacterName,
            display_name: this.newCharacterDisplayName || undefined,
            copy_from: this.newCharacterCopyFrom || undefined
          })
        });

        if (res.ok) {
          const data = await res.json();
          this.showNewCharacterModal = false;
          this.newCharacterName = '';
          this.newCharacterDisplayName = '';
          this.newCharacterCopyFrom = '';
          await this.loadCharacters();

          // 显示详细的成功信息
          const displayName = this.newCharacterDisplayName || data.name;
          const copyNote = data.copy_from ? `\n\n已从 ${this.getCharacterDisplayName(data.copy_from)} 复制人设，请检查并修改。` : '';
          alert(`✅ ${data.message || '创建成功！'}\n\n角色 "${displayName}" (${data.name}) 已创建并添加到列表中。${copyNote}\n\n下一步：\n1. 点击"编辑"按钮检查并修改人设\n2. 在"配置管理"中添加 bot token\n3. 重启应用`);
        } else {
          const error = await res.json();
          alert('❌ 创建失败：' + error.error);
        }
      } catch (error) {
        alert('❌ 创建失败：' + error.message);
      }
    },

    async deleteCharacter(name) {
      if (!confirm(`确定删除角色 ${this.getCharacterDisplayName(name)} 吗？\n\n此操作将：\n- 删除角色的所有文件和数据\n- 从配置文件中移除角色\n\n此操作不可恢复！`)) {
        return;
      }

      try {
        const res = await fetch(`/api/characters/${name}`, {
          method: 'DELETE'
        });

        if (res.ok) {
          const data = await res.json();
          await this.loadCharacters();
          alert(data.message || '删除成功');
        } else {
          const error = await res.json();
          alert('删除失败：' + error.error);
        }
      } catch (error) {
        alert('删除失败：' + error.message);
      }
    },

    async sendMessage() {
      if (!this.newMessage.trim() || !this.selectedCharacter || this.isSending) {
        return;
      }

      const messageContent = this.newMessage;
      
      // 1. 立即清空输入框
      this.newMessage = '';

      // 2. 立即显示用户消息
      const tempUserMessage = {
        id: 'temp-user-' + Date.now(),
        role: 'user',
        content: messageContent,
        created_at: new Date().toISOString()
      };
      this.messages.push(tempUserMessage);
      this.totalMessages++;

      // 3. 添加"AI正在思考"的临时消息
      const tempThinkingMessage = {
        id: 'temp-thinking-' + Date.now(),
        role: 'assistant',
        content: '正在思考...',
        created_at: new Date().toISOString(),
        isThinking: true
      };
      this.messages.push(tempThinkingMessage);

      // 滚动到底部
      this.$nextTick(() => {
        const container = document.getElementById('chatContainer');
        if (container) {
          container.scrollTop = container.scrollHeight;
        }
      });

      this.isSending = true;

      try {
        const res = await fetch(`/api/chat/${this.selectedCharacter}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: messageContent })
        });

        if (res.ok) {
          const data = await res.json();

          // 4. 移除临时消息，重新加载完整消息列表
          this.messages = this.messages.filter(m => m.id !== tempUserMessage.id && m.id !== tempThinkingMessage.id);
          this.totalMessages--;
          
          await this.loadMessages();
        } else {
          const error = await res.json();
          alert('发送失败：' + error.error);
          // 失败时移除临时消息，恢复输入框内容
          this.messages = this.messages.filter(m => m.id !== tempUserMessage.id && m.id !== tempThinkingMessage.id);
          this.totalMessages--;
          this.newMessage = messageContent;
        }
      } catch (error) {
        alert('发送失败：' + error.message);
        // 失败时移除临时消息，恢复输入框内容
        this.messages = this.messages.filter(m => m.id !== tempUserMessage.id && m.id !== tempThinkingMessage.id);
        this.totalMessages--;
        this.newMessage = messageContent;
      } finally {
        this.isSending = false;
      }
    },

    formatTime(timestamp) {
      const date = new Date(timestamp);
      return date.toLocaleString('zh-CN', {
        year: 'numeric',
        month: '2-digit',
        day: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      });
    },

    async loadConfig() {
      this.configLoading = true;
      try {
        const res = await fetch('/api/config');
        if (res.ok) {
          const data = await res.json();
          this.configContent = data.content;
        } else {
          const error = await res.json();
          alert('加载配置失败：' + error.error);
        }
      } catch (error) {
        alert('加载配置失败：' + error.message);
      } finally {
        this.configLoading = false;
      }
    },

    async saveConfig() {
      if (!confirm('确定保存配置吗？配置将在重启应用后生效。')) {
        return;
      }

      this.configSaving = true;
      try {
        const res = await fetch('/api/config', {
          method: 'PUT',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ content: this.configContent })
        });

        if (res.ok) {
          const data = await res.json();
          alert(data.message || '保存成功');
        } else {
          const error = await res.json();
          alert('保存失败：' + error.error);
        }
      } catch (error) {
        alert('保存失败：' + error.message);
      } finally {
        this.configSaving = false;
      }
    },

    // 系统状态相关方法
    async loadStatus() {
      try {
        const res = await fetch('/api/status');
        this.status = await res.json();
      } catch (error) {
        console.error('Failed to load status:', error);
      }
    },

    async loadLogs() {
      try {
        const res = await fetch('/api/logs?limit=200');
        const data = await res.json();
        this.logs = data.logs;
      } catch (error) {
        console.error('Failed to load logs:', error);
      }
    },

    async clearLogs() {
      if (!confirm('确定清空所有日志吗？')) return;

      try {
        await fetch('/api/logs', { method: 'DELETE' });
        this.logs = [];
        alert('日志已清空');
      } catch (error) {
        alert('清空失败：' + error.message);
      }
    },

    startAutoRefresh() {
      // 清除旧的定时器
      if (this.autoRefreshInterval) {
        clearInterval(this.autoRefreshInterval);
      }

      // 每5秒自动刷新状态和日志
      this.autoRefreshInterval = setInterval(() => {
        if (this.currentView === 'status') {
          this.loadStatus();
          this.loadLogs();
        }
      }, 5000);
    },

    get filteredLogs() {
      if (this.logFilter === 'all') {
        return this.logs;
      }
      return this.logs.filter(log => log.level === this.logFilter);
    },

    formatLogTime(timestamp) {
      const date = new Date(timestamp);
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      const seconds = String(date.getSeconds()).padStart(2, '0');
      return `${hours}:${minutes}:${seconds}`;
    }
  };
}
