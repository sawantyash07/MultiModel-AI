import express from 'express';
import { checkPineconeHealth } from '../services/pineconeService.js';

const router = express.Router();

router.get('/health', async (req, res) => {
  const pineconeInfo = await checkPineconeHealth();
  const hasHfToken = !!process.env.HF_TOKEN;
  const hasGeminiKey = !!process.env.GEMINI_API_KEY;

  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    services: {
      server: { status: 'running', port: process.env.PORT || 5000 },
      huggingface: {
        configured: hasHfToken,
        status: hasHfToken ? 'Token Configured' : 'Missing Token'
      },
      pinecone: {
        configured: !!process.env.PINECONE_API_KEY,
        status: pineconeInfo.connected ? 'Connected' : (pineconeInfo.error ? 'Error: ' + pineconeInfo.error : 'Not Connected'),
        indexName: pineconeInfo.indexName,
        dimension: pineconeInfo.dimension,
        indexes: pineconeInfo.indexes
      },
      gemini: {
        configured: hasGeminiKey,
        status: hasGeminiKey ? 'Active (Fallback Engine)' : 'Missing Key'
      }
    }
  });
});

router.get('/settings', async (req, res) => {
  const pineconeInfo = await checkPineconeHealth();
  res.json({
    pinecone: {
      indexName: pineconeInfo.indexName,
      connected: pineconeInfo.connected,
      dimension: pineconeInfo.dimension,
      indexes: pineconeInfo.indexes
    },
    huggingFace: {
      tokenConfigured: !!process.env.HF_TOKEN,
      routerEndpoint: 'https://router.huggingface.co/v1'
    },
    defaultModel: 'meta-llama/Llama-3.1-8B-Instruct'
  });
});

export default router;
