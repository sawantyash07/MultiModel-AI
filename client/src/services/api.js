const API_BASE = '/api';

export const api = {
  // Models
  async getModels(params = {}) {
    const query = new URLSearchParams();
    if (params.search) query.append('search', params.search);
    if (params.task && params.task !== 'all') query.append('task', params.task);
    if (params.provider && params.provider !== 'all') query.append('provider', params.provider);
    if (params.hostingType && params.hostingType !== 'all') query.append('hostingType', params.hostingType);
    if (params.sort) query.append('sort', params.sort);
    if (params.page) query.append('page', params.page);
    if (params.limit) query.append('limit', params.limit);
    if (params.refresh) query.append('refresh', 'true');

    const res = await fetch(`${API_BASE}/models?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch models');
    return res.json();
  },

  async refreshModels() {
    const res = await fetch(`${API_BASE}/models/refresh`, { method: 'POST' });
    if (!res.ok) throw new Error('Failed to refresh models');
    return res.json();
  },

  // Comprehensive Multimodal Model Registry (12 Official Categories)
  async getRegistryModels(params = {}) {
    const query = new URLSearchParams();
    if (params.category && params.category !== 'all') query.append('category', params.category);
    if (params.provider && params.provider !== 'all') query.append('provider', params.provider);
    if (params.modality && params.modality !== 'all') query.append('modality', params.modality);
    if (params.freeOnly !== undefined) query.append('freeOnly', String(params.freeOnly));
    if (params.search) query.append('search', params.search);
    if (params.sort) query.append('sort', params.sort);

    const res = await fetch(`${API_BASE}/models/registry?${query.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch registry models');
    return res.json();
  },

  async getRegistryCategories() {
    const res = await fetch(`${API_BASE}/models/categories`);
    if (!res.ok) throw new Error('Failed to fetch model categories');
    return res.json();
  },

  async getCategoryModels(categoryKey) {
    const res = await fetch(`${API_BASE}/models/category/${encodeURIComponent(categoryKey)}`);
    if (!res.ok) throw new Error('Failed to fetch category models');
    return res.json();
  },

  async getLiveModelStatus() {
    const res = await fetch(`${API_BASE}/models/live-status`);
    if (!res.ok) throw new Error('Failed to fetch live model status');
    return res.json();
  },

  async setFreeOnlyMode(enabled) {
    const res = await fetch(`${API_BASE}/models/free-only-mode`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ enabled })
    });
    if (!res.ok) throw new Error('Failed to update Free-Only Mode');
    return res.json();
  },

  async setPreferredModel(category, modelId) {
    const res = await fetch(`${API_BASE}/models/preferred`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ category, modelId })
    });
    if (!res.ok) throw new Error('Failed to set preferred model');
    return res.json();
  },

  async recommendModel(task = 'general', modality = 'text', freeOnly = true) {
    const res = await fetch(`${API_BASE}/models/recommend`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ task, modality, freeOnly })
    });
    if (!res.ok) throw new Error('Failed to get model recommendation');
    return res.json();
  },

  async validateModality(modelId, modalities = ['text']) {
    const res = await fetch(`${API_BASE}/models/validate-modality`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ modelId, modalities })
    });
    if (!res.ok) throw new Error('Failed to validate modality');
    return res.json();
  },

  async testProviderConnection(providerId) {
    const res = await fetch(`${API_BASE}/models/test-connection`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ providerId })
    });
    if (!res.ok) throw new Error('Failed to test provider connection');
    return res.json();
  },

  // Conversations
  async getConversations(searchQuery = '') {
    const q = searchQuery ? `?q=${encodeURIComponent(searchQuery)}` : '';
    const res = await fetch(`${API_BASE}/conversations${q}`);
    if (!res.ok) throw new Error('Failed to fetch conversations');
    return res.json();
  },

  async getConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`);
    if (!res.ok) throw new Error('Failed to fetch conversation');
    return res.json();
  },

  async createConversation(data = {}) {
    const res = await fetch(`${API_BASE}/conversations`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data)
    });
    if (!res.ok) throw new Error('Failed to create conversation');
    return res.json();
  },

  async renameConversation(id, title) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    });
    if (!res.ok) throw new Error('Failed to rename conversation');
    return res.json();
  },

  async deleteConversation(id) {
    const res = await fetch(`${API_BASE}/conversations/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete conversation');
    return res.json();
  },

  async clearConversations() {
    const res = await fetch(`${API_BASE}/conversations`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear conversations');
    return res.json();
  },

  async updateMessage(conversationId, messageId, content) {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages/${messageId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    if (!res.ok) throw new Error('Failed to update message');
    return res.json();
  },

  async replaceMessages(conversationId, messages) {
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/messages`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages })
    });
    if (!res.ok) throw new Error('Failed to replace messages');
    return res.json();
  },

  // Highlight Annotations
  async getHighlights(conversationId) {
    if (!conversationId) return { highlights: [] };
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/highlights`);
    if (!res.ok) return { highlights: [] };
    return res.json();
  },

  async saveHighlight(conversationId, highlight) {
    if (!conversationId || !highlight) return null;
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/highlights`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(highlight)
    });
    if (!res.ok) throw new Error('Failed to save highlight');
    return res.json();
  },

  async deleteHighlight(conversationId, highlightId) {
    if (!conversationId || !highlightId) return false;
    const res = await fetch(`${API_BASE}/conversations/${conversationId}/highlights/${highlightId}`, {
      method: 'DELETE'
    });
    if (!res.ok) return false;
    return res.json();
  },

  async clearHighlights(conversationId, messageId = null) {
    if (!conversationId) return false;
    const url = messageId
      ? `${API_BASE}/conversations/${conversationId}/highlights?messageId=${encodeURIComponent(messageId)}`
      : `${API_BASE}/conversations/${conversationId}/highlights`;
    const res = await fetch(url, { method: 'DELETE' });
    if (!res.ok) return false;
    return res.json();
  },

  // Health & Settings
  async getHealth() {
    const res = await fetch(`${API_BASE}/health`);
    if (!res.ok) throw new Error('Failed to fetch system health');
    return res.json();
  },

  async getSettings() {
    const res = await fetch(`${API_BASE}/settings`);
    if (!res.ok) throw new Error('Failed to fetch settings');
    return res.json();
  },

  // Persistent User Memory & Projects
  async getMemories() {
    const res = await fetch(`${API_BASE}/memories`);
    if (!res.ok) throw new Error('Failed to fetch memories');
    return res.json();
  },

  async addMemory(content, category = 'GENERAL', status = 'ACTIVE', importance = 3) {
    const res = await fetch(`${API_BASE}/memories`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, category, status, importance })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to save memory');
    }
    return res.json();
  },

  async updateMemory(id, content, category, status, importance) {
    const res = await fetch(`${API_BASE}/memories/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, category, status, importance })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update memory');
    }
    return res.json();
  },

  async updateMemoryStatus(id, status) {
    const res = await fetch(`${API_BASE}/memories/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to update memory status');
    }
    return res.json();
  },

  async deleteMemory(id) {
    const res = await fetch(`${API_BASE}/memories/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete memory');
    return res.json();
  },

  async clearMemories() {
    const res = await fetch(`${API_BASE}/memories`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear memories');
    return res.json();
  },

  async getProjects() {
    const res = await fetch(`${API_BASE}/memories/projects`);
    if (!res.ok) throw new Error('Failed to fetch projects');
    return res.json();
  },

  async saveProject(project) {
    const res = await fetch(`${API_BASE}/memories/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(project)
    });
    if (!res.ok) throw new Error('Failed to save project');
    return res.json();
  },

  async deleteProject(id) {
    const res = await fetch(`${API_BASE}/memories/projects/${id}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to delete project');
    return res.json();
  },


  // Live Web Research & Fact Verification
  async searchWeb(query, limit = 5) {
    const res = await fetch(`${API_BASE}/research/search`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query, limit })
    });
    if (!res.ok) throw new Error('Failed to perform web research');
    return res.json();
  },

  async verifyFacts(query) {
    const res = await fetch(`${API_BASE}/research/verify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    if (!res.ok) throw new Error('Failed to verify facts');
    return res.json();
  },

  // Dynamic Suggestions & Personalized Prompts
  async getPersonalizedSuggestions() {
    try {
      const res = await fetch(`${API_BASE}/chat/personalized-suggestions`);
      if (!res.ok) return { suggestions: [], cards: [], chips: [] };
      return await res.json();
    } catch (_) {
      return { suggestions: [], cards: [], chips: [] };
    }
  },

  async getSuggestions(prompt, answer, history = [], modelId = 'auto', language = 'en', attachments = []) {
    try {
      const res = await fetch(`${API_BASE}/chat/suggestions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, answer, history, modelId, language, attachments })
      });
      if (!res.ok) return { suggestions: [], topic: null, isAiGenerated: false };
      return await res.json();
    } catch (_) {
      return { suggestions: [], topic: null, isAiGenerated: false };
    }
  },

  /**
   * Universal attachment upload for Images (JPG, PNG, WebP) and Documents (PDF, DOCX, XLSX, XLS, CSV, TXT, MD)
   */
  async uploadAttachment(file, conversationId = null) {
    if (!file) throw new Error('No file provided for upload');
    const fileName = (file.name || '').toLowerCase();
    const isDoc = fileName.endsWith('.pdf') || fileName.endsWith('.docx') || fileName.endsWith('.doc') ||
                  fileName.endsWith('.xlsx') || fileName.endsWith('.xls') || fileName.endsWith('.csv') ||
                  fileName.endsWith('.txt') || fileName.endsWith('.md');
    if (isDoc) {
      return this.uploadDocument(file, conversationId);
    }

    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) formData.append('conversationId', conversationId);

    const res = await fetch(`${API_BASE}/chat/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      let errDetail = `Upload failed (HTTP ${res.status})`;
      try {
        const json = await res.json();
        errDetail = json.error || json.message || errDetail;
      } catch (_) {
        try { errDetail = await res.text(); } catch (_) {}
      }
      throw new Error(errDetail);
    }
    return res.json();
  },

  // Document Intelligence APIs
  async uploadDocument(file, conversationId = null) {
    if (!file) throw new Error('No document provided for upload');
    const formData = new FormData();
    formData.append('file', file);
    if (conversationId) formData.append('conversationId', conversationId);

    const res = await fetch(`${API_BASE}/documents/upload`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Failed to parse and index document');
    }
    return res.json();
  },

  async getDocuments(conversationId) {
    if (!conversationId) return { count: 0, documents: [] };
    const res = await fetch(`${API_BASE}/documents/${conversationId}`);
    if (!res.ok) return { count: 0, documents: [] };
    return res.json();
  },

  async clearDocuments(conversationId) {
    if (!conversationId) return;
    const res = await fetch(`${API_BASE}/documents/${conversationId}`, { method: 'DELETE' });
    if (!res.ok) throw new Error('Failed to clear documents');
    return res.json();
  },

  // Voice / Speech-to-Text (ASR) APIs
  async transcribeAudio(audioBlob, language = 'en') {
    if (!audioBlob) throw new Error('No audio recording provided for transcription');
    const formData = new FormData();
    formData.append('file', audioBlob, 'voice_recording.webm');
    formData.append('language', language);

    const res = await fetch(`${API_BASE}/voice/transcribe`, {
      method: 'POST',
      body: formData
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Speech transcription failed');
    }
    return res.json();
  },

  async getVoiceStatus() {
    try {
      const res = await fetch(`${API_BASE}/voice/status`);
      if (!res.ok) return { status: 'OFFLINE' };
      return res.json();
    } catch (_) {
      return { status: 'OFFLINE' };
    }
  },

  /**
   * Dedicated file upload with multipart/form-data for image-to-text models
   */
  async uploadImage(file) {
    if (!file) throw new Error('No file provided for upload');
    const formData = new FormData();
    formData.append('file', file);

    const res = await fetch(`${API_BASE}/chat/upload`, {
      method: 'POST',
      body: formData
      // Note: do NOT manually set Content-Type so browser generates boundary correctly
    });

    if (!res.ok) {
      let errDetail = `Upload failed (HTTP ${res.status})`;
      try {
        const json = await res.json();
        errDetail = json.error || json.message || errDetail;
      } catch (_) {
        try { errDetail = await res.text(); } catch (_) {}
      }
      throw new Error(errDetail);
    }
    return res.json();
  },

  /**
   * Stream chat inference with Server-Sent Events (SSE)
   */
  async streamChat({
    conversationId,
    modelId,
    language = 'en',
    webSearch = null,
    allowFallback = false,
    messages,
    attachments,
    systemInstruction,
    requestId,
    messageId,
    onStart,
    onThinking,
    onToken,
    onMetadata,
    onAutoSelected,
    onMemory,
    onResearch,
    onDocument,
    onImage,
    onUsage,
    onCancelled,
    onDone,
    onError,
    signal
  }) {
    try {
      const response = await fetch(`${API_BASE}/chat/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          conversationId,
          modelId,
          language,
          webSearch,
          allowFallback,
          messages,
          attachments,
          systemInstruction,
          requestId,
          messageId,
          clientTimestamp: Date.now()
        }),
        signal
      });

      if (!response.ok) {
        let errDetail = '';
        try {
          const errJson = await response.json();
          errDetail = errJson.error || errJson.message || '';
        } catch (_) {
          try { errDetail = await response.text(); } catch (_) {}
        }
        throw new Error(errDetail || `Server returned ${response.status}: ${response.statusText}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder('utf-8');
      let buffer = '';
      let hasError = false;

      const processEvent = (evt) => {
        if (!evt.trim()) return;

        let eventType = 'message';
        let eventData = '';

        const lines = evt.split('\n');
        for (const line of lines) {
          const trimmedLine = line.trim();
          if (trimmedLine.startsWith('event:')) {
            eventType = trimmedLine.slice(6).trim();
          } else if (trimmedLine.startsWith('data:')) {
            eventData = trimmedLine.slice(5).trim();
          }
        }

        if (eventData) {
          try {
            const parsed = JSON.parse(eventData);

            if (eventType === 'start') {
              if (onStart) onStart(parsed);
            } else if (eventType === 'thinking') {
              if (onThinking) onThinking(parsed);
            } else if (eventType === 'token' || eventType === 'content') {
              const chunk = parsed.content !== undefined ? parsed.content : (parsed.text || '');
              if (onToken) onToken(chunk, parsed);
            } else if (eventType === 'image') {
              if (onImage) onImage(parsed);
            } else if (eventType === 'metadata') {
              if (onMetadata) onMetadata(parsed);
            } else if (eventType === 'auto_selected') {
              if (onAutoSelected) onAutoSelected(parsed.modelId);
            } else if (eventType === 'memory') {
              if (onMemory) onMemory(parsed);
            } else if (eventType === 'research') {
              if (onResearch) onResearch(parsed);
            } else if (eventType === 'document') {
              if (onDocument) onDocument(parsed);
            } else if (eventType === 'usage') {
              if (onUsage) onUsage(parsed);
            } else if (eventType === 'complete' || eventType === 'done') {
              if (!hasError && onDone) onDone(parsed);
            } else if (eventType === 'cancelled' || eventType === 'aborted') {
              if (onCancelled) onCancelled(parsed);
              else if (onDone) onDone({ status: 'cancelled', ...parsed });
            } else if (eventType === 'error') {
              hasError = true;
              if (onError) onError(new Error(parsed.error || 'Server reported an error'));
            }
          } catch (jsonErr) {
            console.warn('[SSE Parse Error]:', jsonErr, 'Raw:', eventData);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        // Normalize CRLF to LF
        const normalized = buffer.replace(/\r\n/g, '\n');
        const events = normalized.split('\n\n');
        buffer = events.pop() || ''; // Keep remainder in buffer

        for (const evt of events) {
          processEvent(evt);
        }
      }

      // Process any remaining event in buffer
      if (buffer && buffer.trim()) {
        const remainingEvts = buffer.replace(/\r\n/g, '\n').split('\n\n');
        for (const evt of remainingEvts) {
          processEvent(evt);
        }
      }

      if (!hasError && onDone) onDone({ status: 'complete' });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (onCancelled) onCancelled({ status: 'cancelled' });
        else if (onDone) onDone({ status: 'aborted' });
      } else {
        if (onError) onError(err);
      }
    }
  },

  /**
   * Propagates stop generation signal to the backend to immediately cancel upstream provider inference.
   */
  async stopChatStream({ conversationId, requestId, messageId }) {
    try {
      const res = await fetch(`${API_BASE}/chat/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, requestId, messageId })
      });
      if (!res.ok) return { status: 'stopped' };
      return await res.json();
    } catch (_) {
      return { status: 'stopped' };
    }
  },

  // =========================================================================
  // AI Model Hub API
  // =========================================================================

  async getHubModels(task = 'all', search = '') {
    const q = new URLSearchParams();
    if (task && task !== 'all') q.append('task', task);
    if (search && search.trim()) q.append('search', search.trim());
    const res = await fetch(`${API_BASE}/hub/models?${q.toString()}`);
    if (!res.ok) throw new Error('Failed to fetch Hub models');
    return res.json();
  },

  async verifyHubModel(modelId) {
    const res = await fetch(`${API_BASE}/hub/models/${encodeURIComponent(modelId)}/verify`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to verify model');
    return res.json();
  },

  async verifyAllHubModels() {
    const res = await fetch(`${API_BASE}/hub/models/verify-all`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to trigger model verification');
    return res.json();
  },

  async generateHubText(payload) {
    const res = await fetch(`${API_BASE}/hub/text/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Text generation failed');
    }
    return res.json();
  },

  async streamHubText({
    modelId,
    prompt,
    messages = [],
    temperature = 0.7,
    maxTokens = 2048,
    systemInstruction = '',
    onToken,
    onMetadata,
    onDone,
    onError,
    signal
  }) {
    try {
      const res = await fetch(`${API_BASE}/hub/text/stream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          modelId,
          prompt,
          messages,
          temperature,
          maxTokens,
          systemInstruction
        }),
        signal
      });

      if (!res.ok) {
        throw new Error(`Streaming failed with status: ${res.status}`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';
      let hasError = false;

      const processEvent = (eventBlock) => {
        const lines = eventBlock.split('\n');
        let eventType = 'token';
        let eventData = '';

        for (const line of lines) {
          if (line.startsWith('event:')) {
            eventType = line.substring(6).trim();
          } else if (line.startsWith('data:')) {
            eventData = line.substring(5).trim();
          }
        }

        if (eventData) {
          try {
            const parsed = JSON.parse(eventData);
            if (eventType === 'token') {
              if (onToken) onToken(parsed.content);
            } else if (eventType === 'metadata') {
              if (onMetadata) onMetadata(parsed);
            } else if (eventType === 'done') {
              if (!hasError && onDone) onDone(parsed);
            } else if (eventType === 'error') {
              hasError = true;
              if (onError) onError(new Error(parsed.error || 'Server error occurred'));
            }
          } catch (e) {
            console.warn('[Hub SSE Parse Error]:', e, eventData);
          }
        }
      };

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const normalized = buffer.replace(/\r\n/g, '\n');
        const events = normalized.split('\n\n');
        buffer = events.pop() || '';

        for (const evt of events) {
          processEvent(evt);
        }
      }

      if (buffer && buffer.trim()) {
        const remaining = buffer.replace(/\r\n/g, '\n').split('\n\n');
        for (const evt of remaining) {
          processEvent(evt);
        }
      }

      if (!hasError && onDone) onDone({ status: 'complete' });
    } catch (err) {
      if (err.name === 'AbortError') {
        if (onCancelled) onCancelled({ status: 'cancelled' });
        else if (onDone) onDone({ status: 'aborted' });
      } else {
        if (onError) onError(err);
      }
    }
  },

  /**
   * Propagates stop generation signal to the backend to immediately cancel upstream provider inference.
   */
  async stopChatStream({ conversationId, requestId, messageId }) {
    try {
      const res = await fetch(`${API_BASE}/chat/stop`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversationId, requestId, messageId })
      });
      if (!res.ok) return { status: 'stopped' };
      return await res.json();
    } catch (_) {
      return { status: 'stopped' };
    }
  },

  async generateHubImage(payload) {
    const res = await fetch(`${API_BASE}/hub/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Image generation failed');
    }
    return res.json();
  },

  async getHubImageHistory() {
    const res = await fetch(`${API_BASE}/hub/image/history`);
    if (!res.ok) throw new Error('Failed to fetch image history');
    return res.json();
  },

  async checkImageProvider(providerId, modelId) {
    const q = new URLSearchParams();
    if (modelId) q.append('modelId', modelId);
    const res = await fetch(`${API_BASE}/hub/image/providers/${encodeURIComponent(providerId)}/check?${q.toString()}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Provider check failed');
    return res.json();
  },

  async getImageProviderStatuses() {
    const res = await fetch(`${API_BASE}/hub/image/providers/status`);
    if (!res.ok) throw new Error('Failed to fetch image provider statuses');
    return res.json();
  },

  async deleteHubImage(id) {
    const res = await fetch(`${API_BASE}/hub/image/history/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete image');
    return res.json();
  },

  async analyzeHubVisionMultipart(formData) {
    const res = await fetch(`${API_BASE}/hub/vision/analyze`, {
      method: 'POST',
      body: formData
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Vision analysis failed');
    }
    return res.json();
  },

  async analyzeHubVisionJson(payload) {
    const res = await fetch(`${API_BASE}/hub/vision/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Vision analysis failed');
    }
    return res.json();
  },

  // =========================================================================
  // Text-To-Speech (Multilingual Indic Parler TTS)
  // =========================================================================

  async getTtsLanguages() {
    try {
      const res = await fetch(`${API_BASE}/tts/languages`);
      if (!res.ok) return [];
      return res.json();
    } catch (_) {
      return [
        { code: 'en', name: 'English', nativeName: 'English' },
        { code: 'hi', name: 'Hindi', nativeName: 'हिंदी' },
        { code: 'mr', name: 'Marathi', nativeName: 'मराठी' }
      ];
    }
  },

  async getTtsStatus() {
    try {
      const res = await fetch(`${API_BASE}/tts/status`);
      if (!res.ok) return null;
      return res.json();
    } catch (_) {
      return null;
    }
  },

  async synthesizeSpeech({ text, language = 'en', voice, conversationId, messageId, speed, signal }) {
    const res = await fetch(`${API_BASE}/tts/speak`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json, audio/mpeg;q=0.9'
      },
      body: JSON.stringify({ text, language, voice, conversationId, messageId, speed }),
      signal
    });

    if (!res.ok) {
      let errMsg = `TTS request failed (HTTP ${res.status})`;
      try {
        const json = await res.json();
        errMsg = json.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }

    const contentType = res.headers.get('content-type') || '';

    // If server returned structured JSON with audioBase64 and aligned timestamps
    if (contentType.includes('application/json')) {
      const data = await res.json();
      let blob;
      if (data.audioBase64) {
        const binaryString = atob(data.audioBase64);
        const len = binaryString.length;
        const bytes = new Uint8Array(len);
        for (let i = 0; i < len; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        blob = new Blob([bytes], { type: data.contentType || 'audio/mpeg' });
      }

      return {
        audioBlob: blob,
        model: data.modelId || 'google/multilingual-tts',
        provider: data.provider || 'Google Hosted Multilingual Speech Engine',
        language: data.language || language,
        cached: !!data.cached,
        durationMs: typeof data.durationMs === 'number' ? data.durationMs : 0,
        spokenText: data.spokenText || '',
        timestamps: Array.isArray(data.timestamps) ? data.timestamps : [],
        exactAlignment: !!data.exactAlignment
      };
    }

    // Binary audio response fallback with header metadata
    const blob = await res.blob();
    const model = res.headers.get('X-TTS-Model') || 'google/multilingual-tts';
    const provider = res.headers.get('X-TTS-Provider') || 'Google Hosted Multilingual Speech Engine';
    const lang = res.headers.get('X-TTS-Language') || language;
    const cached = res.headers.get('X-TTS-Cached') === 'true';
    const durationMs = parseInt(res.headers.get('X-TTS-Duration-Ms') || '0', 10);
    const exactAlignment = res.headers.get('X-TTS-Exact-Alignment') === 'true';

    let spokenText = '';
    const b64Spoken = res.headers.get('X-TTS-Spoken-Text');
    if (b64Spoken) {
      try {
        const binStr = atob(b64Spoken);
        const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
        spokenText = new TextDecoder('utf-8').decode(bytes);
      } catch (_) {}
    }

    let timestamps = [];
    const b64Timestamps = res.headers.get('X-TTS-Word-Timestamps');
    if (b64Timestamps) {
      try {
        const binStr = atob(b64Timestamps);
        const bytes = Uint8Array.from(binStr, c => c.charCodeAt(0));
        const jsonStr = new TextDecoder('utf-8').decode(bytes);
        timestamps = JSON.parse(jsonStr);
      } catch (_) {}
    }

    return {
      audioBlob: blob,
      model,
      provider,
      language: lang,
      cached,
      durationMs,
      spokenText,
      timestamps,
      exactAlignment
    };
  },

  async translateText({ text, targetLanguage = 'gu', sourceLanguage = 'en' }) {
    const res = await fetch(`${API_BASE}/translate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ text, targetLanguage, sourceLanguage })
    });
    if (!res.ok) {
      let errMsg = `Translation failed (HTTP ${res.status})`;
      try {
        const json = await res.json();
        errMsg = json.error || errMsg;
      } catch (_) {}
      throw new Error(errMsg);
    }
    return res.json();
  },

  // ============================================================================
  // Personal Knowledge Graph APIs
  // ============================================================================
  async getKnowledgeGraph(params = {}) {
    const query = new URLSearchParams();
    if (params.q) query.append('q', params.q);
    if (params.type && params.type !== 'ALL') query.append('type', params.type);
    if (params.source && params.source !== 'ALL') query.append('source', params.source);
    if (params.relation && params.relation !== 'ALL') query.append('relation', params.relation);
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE}/knowledge-graph${qs}`);
    if (!res.ok) throw new Error('Failed to fetch knowledge graph');
    return res.json();
  },

  async getKnowledgeNode(id) {
    const res = await fetch(`${API_BASE}/knowledge-graph/nodes/${encodeURIComponent(id)}`);
    if (!res.ok) throw new Error('Failed to fetch node details');
    return res.json();
  },

  async getKnowledgeNeighborhood(id, depth = 1) {
    const res = await fetch(`${API_BASE}/knowledge-graph/nodes/${encodeURIComponent(id)}/connections?depth=${depth}`);
    if (!res.ok) throw new Error('Failed to fetch neighborhood');
    return res.json();
  },

  async createKnowledgeNode(node) {
    const res = await fetch(`${API_BASE}/knowledge-graph/nodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(node)
    });
    if (!res.ok) throw new Error('Failed to create node');
    return res.json();
  },

  async updateKnowledgeNode(id, updates) {
    const res = await fetch(`${API_BASE}/knowledge-graph/nodes/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update node');
    return res.json();
  },

  async deleteKnowledgeNode(id) {
    const res = await fetch(`${API_BASE}/knowledge-graph/nodes/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete node');
    return res.json();
  },

  async createKnowledgeEdge(edge) {
    const res = await fetch(`${API_BASE}/knowledge-graph/edges`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(edge)
    });
    if (!res.ok) throw new Error('Failed to create edge');
    return res.json();
  },

  async updateKnowledgeEdge(id, updates) {
    const res = await fetch(`${API_BASE}/knowledge-graph/edges/${encodeURIComponent(id)}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(updates)
    });
    if (!res.ok) throw new Error('Failed to update edge');
    return res.json();
  },

  async deleteKnowledgeEdge(id) {
    const res = await fetch(`${API_BASE}/knowledge-graph/edges/${encodeURIComponent(id)}`, {
      method: 'DELETE'
    });
    if (!res.ok) throw new Error('Failed to delete edge');
    return res.json();
  },

  async verifyKnowledgeEdge(id, verified) {
    const res = await fetch(`${API_BASE}/knowledge-graph/edges/${encodeURIComponent(id)}/verify?verified=${verified}`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to verify edge');
    return res.json();
  },

  async mergeKnowledgeNodes(sourceNodeId, targetNodeId) {
    const res = await fetch(`${API_BASE}/knowledge-graph/nodes/merge`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ sourceNodeId, targetNodeId })
    });
    if (!res.ok) throw new Error('Failed to merge nodes');
    return res.json();
  },

  async rebuildKnowledgeGraph() {
    const res = await fetch(`${API_BASE}/knowledge-graph/rebuild`, {
      method: 'POST'
    });
    if (!res.ok) throw new Error('Failed to rebuild knowledge graph');
    return res.json();
  },

  async askKnowledgeGraph({ question, focusNodeId, modelId, filters }) {
    const res = await fetch(`${API_BASE}/knowledge-graph/ask`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ question, focusNodeId, modelId, filters })
    });
    if (!res.ok) throw new Error('Failed to query knowledge graph');
    return res.json();
  },

  async getKnowledgeGraphInsights() {
    const res = await fetch(`${API_BASE}/knowledge-graph/insights`);
    if (!res.ok) throw new Error('Failed to fetch insights');
    return res.json();
  }
};

