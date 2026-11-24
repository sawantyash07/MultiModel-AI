import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA_DIR = path.resolve(__dirname, '../../data');
const DATA_FILE = path.join(DATA_DIR, 'conversations.json');

function ensureDataFile() {
  if (!fs.existsSync(DATA_DIR)) {
    fs.mkdirSync(DATA_DIR, { recursive: true });
  }
  if (!fs.existsSync(DATA_FILE)) {
    fs.writeFileSync(DATA_FILE, JSON.stringify([], null, 2), 'utf-8');
  }
}

function readAll() {
  ensureDataFile();
  try {
    const raw = fs.readFileSync(DATA_FILE, 'utf-8');
    return JSON.parse(raw) || [];
  } catch (err) {
    console.error('[ConversationStore] Error reading conversations:', err);
    return [];
  }
}

function writeAll(conversations) {
  ensureDataFile();
  try {
    fs.writeFileSync(DATA_FILE, JSON.stringify(conversations, null, 2), 'utf-8');
  } catch (err) {
    console.error('[ConversationStore] Error writing conversations:', err);
  }
}

export function generateSmartTitle(firstPrompt = '') {
  if (!firstPrompt || !firstPrompt.trim()) return 'New Conversation';
  const clean = firstPrompt.trim().replace(/^[\r\n\t]+/, '');
  const lower = clean.toLowerCase();

  if (lower.startsWith('write a ') || lower.startsWith('create a ') || lower.startsWith('implement ')) {
    const words = clean.split(/\s+/).slice(0, 5).join(' ');
    return words.charAt(0).toUpperCase() + words.slice(1);
  }
  if (lower.includes('code') || lower.includes('function') || lower.includes('class') || lower.includes('react') || lower.includes('python')) {
    return 'Code: ' + clean.substring(0, 28) + (clean.length > 28 ? '...' : '');
  }
  if (lower.includes('image') || lower.includes('photo') || lower.includes('picture') || lower.includes('draw')) {
    return 'Image: ' + clean.substring(0, 28) + (clean.length > 28 ? '...' : '');
  }
  if (lower.includes('return policy') || lower.includes('refund') || lower.includes('shipping') || lower.includes('support')) {
    return 'Support: ' + clean.substring(0, 28) + (clean.length > 28 ? '...' : '');
  }

  const shortened = clean.length > 35 ? clean.substring(0, 35) + '...' : clean;
  return shortened.charAt(0).toUpperCase() + shortened.slice(1);
}

export const conversationStore = {
  list(searchQuery = '') {
    const all = readAll();
    let filtered = all.map(c => ({
      id: c.id,
      title: c.title,
      modelId: c.modelId,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
      messageCount: (c.messages || []).length,
      lastMessagePreview: c.messages && c.messages.length > 0
        ? (c.messages[c.messages.length - 1].content || '').substring(0, 60)
        : ''
    }));

    if (searchQuery && searchQuery.trim()) {
      const q = searchQuery.toLowerCase().trim();
      filtered = filtered.filter(c => 
        c.title.toLowerCase().includes(q) || 
        c.lastMessagePreview.toLowerCase().includes(q)
      );
    }

    filtered.sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
    return filtered;
  },

  get(id) {
    const all = readAll();
    return all.find(c => c.id === id) || null;
  },

  create(initialData = {}) {
    const all = readAll();
    const id = initialData.id || uuidv4();
    const title = initialData.title || (initialData.firstPrompt ? generateSmartTitle(initialData.firstPrompt) : 'New Conversation');
    
    const newConv = {
      id,
      title,
      modelId: initialData.modelId || 'auto',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      messages: initialData.messages || []
    };

    all.unshift(newConv);
    writeAll(all);
    return newConv;
  },

  update(id, updates = {}) {
    const all = readAll();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) return null;

    const existing = all[index];
    const updated = {
      ...existing,
      ...updates,
      updatedAt: new Date().toISOString()
    };

    all[index] = updated;
    writeAll(all);
    return updated;
  },

  appendMessage(id, message) {
    const all = readAll();
    let conv = all.find(c => c.id === id);
    if (!conv) {
      conv = this.create({ id, messages: [message] });
      return conv;
    }

    if (!conv.messages) conv.messages = [];
    conv.messages.push(message);

    // Auto-update title if it's currently default and this is the first user message
    if ((conv.title === 'New Conversation' || !conv.title) && message.role === 'user') {
      conv.title = generateSmartTitle(message.content);
    }

    conv.updatedAt = new Date().toISOString();
    writeAll(all);
    return conv;
  },

  delete(id) {
    const all = readAll();
    const initialLen = all.length;
    const remaining = all.filter(c => c.id !== id);
    writeAll(remaining);
    return remaining.length < initialLen;
  },

  clearAll() {
    writeAll([]);
    return true;
  }
};
