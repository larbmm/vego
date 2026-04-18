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

    // 角色名称映射（英文 -> 中文）
    characterNameMap: {
      'xiyue': '曦月',
      'qianqian': '芊芊',
      'wanqing': '婉清',
    },

    async init() {
      await this.loadCharacters();
    },

    getCharacterDisplayName(name) {
      return this.characterNameMap[name] || name;
    },

    async loadCharacters() {
      const res = await fetch('/api/characters');
      this.characters = await res.json();
    },

    async loadMessages() {
      if (!this.selectedCharacter) return;
      
      const res = await fetch(`/api/messages/${this.selectedCharacter}?limit=${this.messageLimit}&offset=${this.messageOffset}`);
      const data = await res.json();
      
      this.messages = data.messages;
      this.totalMessages = data.total;
      this.selectedMessages = [];
    },

    async loadMoreMessages() {
      this.messageOffset += this.messageLimit;
      await this.loadMessages();
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
        alert('请输入角色名称');
        return;
      }

      const res = await fetch('/api/characters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: this.newCharacterName })
      });

      if (res.ok) {
        this.showNewCharacterModal = false;
        this.newCharacterName = '';
        await this.loadCharacters();
        alert('创建成功');
      } else {
        const error = await res.json();
        alert('创建失败：' + error.error);
      }
    },

    async deleteCharacter(name) {
      if (!confirm(`确定删除角色 ${name} 吗？此操作不可恢复！`)) {
        return;
      }

      const res = await fetch(`/api/characters/${name}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        await this.loadCharacters();
        alert('删除成功');
      } else {
        const error = await res.json();
        alert('删除失败：' + error.error);
      }
    },

    async sendMessage() {
      if (!this.newMessage.trim() || !this.selectedCharacter) {
        return;
      }

      this.isSending = true;

      try {
        const res = await fetch(`/api/chat/${this.selectedCharacter}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: this.newMessage })
        });

        if (res.ok) {
          const data = await res.json();
          this.newMessage = '';
          await this.loadMessages();
          
          // 滚动到底部
          setTimeout(() => {
            const container = document.getElementById('chatContainer');
            if (container) {
              container.scrollTop = container.scrollHeight;
            }
          }, 100);
        } else {
          const error = await res.json();
          alert('发送失败：' + error.error);
        }
      } catch (error) {
        alert('发送失败：' + error.message);
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
