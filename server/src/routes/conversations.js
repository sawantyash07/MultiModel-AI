import express from 'express';
import { conversationStore } from '../services/conversationStore.js';

const router = express.Router();

/**
 * GET /api/conversations
 * Lists all conversations (searchable via ?q=...).
 */
router.get('/', (req, res) => {
  try {
    const q = req.query.q || '';
    const list = conversationStore.list(q);
    res.json({ conversations: list });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * GET /api/conversations/:id
 * Returns conversation details and full message list.
 */
router.get('/:id', (req, res) => {
  try {
    const conv = conversationStore.get(req.params.id);
    if (!conv) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(conv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/conversations
 * Creates a fresh new conversation.
 */
router.post('/', (req, res) => {
  try {
    const { id, title, modelId, firstPrompt } = req.body;
    const newConv = conversationStore.create({ id, title, modelId, firstPrompt });
    res.status(201).json(newConv);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/conversations/:id/messages
 * Appends a message (assistant or user) to an existing conversation.
 */
router.post('/:id/messages', (req, res) => {
  try {
    const { message } = req.body;
    if (!message) {
      return res.status(400).json({ error: 'Message payload required' });
    }
    const updated = conversationStore.appendMessage(req.params.id, message);
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * PATCH /api/conversations/:id
 * Renames title or updates model preferences.
 */
router.patch('/:id', (req, res) => {
  try {
    const { title, modelId } = req.body;
    const updated = conversationStore.update(req.params.id, {
      ...(title !== undefined && { title: title.trim() }),
      ...(modelId !== undefined && { modelId })
    });
    if (!updated) {
      return res.status(404).json({ error: 'Conversation not found' });
    }
    res.json(updated);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/conversations/:id
 * Deletes a conversation.
 */
router.delete('/:id', (req, res) => {
  try {
    const deleted = conversationStore.delete(req.params.id);
    res.json({ id: req.params.id, deleted });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/conversations
 * Clears all conversations.
 */
router.delete('/', (req, res) => {
  try {
    conversationStore.clearAll();
    res.json({ message: 'All conversations cleared' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
