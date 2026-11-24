import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

// Load environment variables
dotenv.config();

import modelsRouter from './routes/models.js';
import chatRouter from './routes/chat.js';
import conversationsRouter from './routes/conversations.js';
import healthRouter from './routes/health.js';
import { checkPineconeHealth } from './services/pineconeService.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// API Routes
app.use('/api/models', modelsRouter);
app.use('/api/chat', chatRouter);
app.use('/api/conversations', conversationsRouter);
app.use('/api', healthRouter);

// Root informational endpoint
app.get('/', (req, res) => {
  res.json({
    name: 'AI Chat Production Backend',
    version: '1.0.0',
    endpoints: [
      '/api/models',
      '/api/chat/stream',
      '/api/chat/suggestions',
      '/api/conversations',
      '/api/health',
      '/api/settings'
    ]
  });
});

// Error handling middleware
app.use((err, req, res, next) => {
  console.error('[Unhandled Server Error]:', err);
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

app.listen(PORT, async () => {
  console.log(`===================================================`);
  console.log(`🚀 Production AI Chat Server running on port ${PORT}`);
  console.log(`   Health Check: http://localhost:${PORT}/api/health`);
  console.log(`   Models API:   http://localhost:${PORT}/api/models`);
  console.log(`===================================================`);

  // Initial Pinecone connection check
  try {
    const pcStatus = await checkPineconeHealth();
    console.log(`🌲 Pinecone Status: ${pcStatus.connected ? 'Connected' : 'Disconnected'} (Index: ${pcStatus.indexName})`);
  } catch (e) {
    console.warn(`🌲 Pinecone check warning:`, e.message);
  }
});
