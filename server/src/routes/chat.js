import express from 'express';
import { streamInference } from '../services/inferenceAdapter.js';
import { generateFollowUpSuggestions } from '../services/suggestionService.js';
import { conversationStore } from '../services/conversationStore.js';

const router = express.Router();

/**
 * POST /api/chat and POST /api/chat/stream
 * Handles streaming chat responses over Server-Sent Events (SSE).
 */
router.post(['/', '/stream'], async (req, res) => {
  const {
    conversationId,
    modelId = 'auto',
    messages = [],
    attachments = [],
    systemInstruction = ''
  } = req.body;

  // Set SSE Headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache, no-transform',
    'Connection': 'keep-alive',
    'X-Accel-Buffering': 'no'
  });

  const abortController = new AbortController();
  res.on('close', () => {
    if (!res.writableEnded) {
      abortController.abort();
    }
  });

  try {
    // If conversationId is supplied, record the user message
    const lastUserMsg = messages[messages.length - 1];
    if (conversationId && lastUserMsg && lastUserMsg.role === 'user') {
      conversationStore.appendMessage(conversationId, {
        id: lastUserMsg.id || `msg-${Date.now()}`,
        role: 'user',
        content: lastUserMsg.content,
        attachments: attachments || [],
        createdAt: new Date().toISOString()
      });
    }

    await streamInference({
      conversationId,
      modelId,
      messages,
      attachments,
      systemInstruction,
      res,
      abortSignal: abortController.signal
    });

  } catch (err) {
    console.error('[Chat Stream Error]:', err);
    if (!res.writableEnded) {
      res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ status: 'error' })}\n\n`);
      res.end();
    }
  }
});

/**
 * POST /api/chat/suggestions
 * Generates dynamic, context-aware follow-up chips.
 */
router.post('/suggestions', async (req, res) => {
  try {
    const { prompt = '', answer = '', history = [], modelId = 'auto' } = req.body;
    const suggestions = await generateFollowUpSuggestions(prompt, answer, history, modelId);
    res.json({ suggestions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
