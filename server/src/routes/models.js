import express from 'express';
import { filterModels, getModelById, getAllModels } from '../services/hfModelService.js';

const router = express.Router();

/**
 * GET /api/models
 * Retrieves, normalizes, and filters Hugging Face models.
 * Query params:
 *  - search: string
 *  - task: 'all' | 'text-generation' | 'coding' | 'reasoning' | 'image-understanding' | 'image-generation' | 'speech-recognition' | 'text-to-speech' | 'video-generation' | 'embeddings'
 *  - provider: string
 *  - hostingType: 'all' | 'hosted-serverless' | 'dedicated-only'
 *  - page: number
 *  - limit: number
 *  - refresh: boolean
 */
router.get('/', async (req, res) => {
  try {
    const {
      search = '',
      task = 'all',
      provider = 'all',
      hostingType = 'all',
      sort = 'popular',
      page = 1,
      limit = 24,
      refresh = 'false'
    } = req.query;

    const forceRefresh = refresh === 'true' || refresh === '1';
    const result = await filterModels({
      search,
      task,
      provider,
      hostingType,
      sort,
      page: parseInt(page, 10) || 1,
      limit: parseInt(limit, 10) || 24,
      forceRefresh
    });

    res.json(result);
  } catch (err) {
    console.error('[API /models Error]:', err);
    res.status(500).json({ error: 'Failed to fetch models: ' + err.message });
  }
});

/**
 * POST /api/models/refresh
 * Forces cache invalidation and re-fetches from Hugging Face Router.
 */
router.post('/refresh', async (req, res) => {
  try {
    const list = await getAllModels(true);
    res.json({ message: 'Model cache refreshed successfully', count: list.length });
  } catch (err) {
    res.status(500).json({ error: 'Failed to refresh model cache: ' + err.message });
  }
});

/**
 * GET /api/models/:id
 */
router.get('/:id(*)', async (req, res) => {
  try {
    const model = await getModelById(req.params.id);
    if (!model) {
      return res.status(404).json({ error: 'Model not found' });
    }
    res.json(model);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
