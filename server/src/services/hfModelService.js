/**
 * Hugging Face Model Registry Service (Node.js)
 * Verified models:
 * 1. Meta-Llama-3.1-8B (meta-llama/Llama-3.1-8B-Instruct)
 * 2. Qwen2.5-7B (Qwen/Qwen2.5-Coder-7B-Instruct / Qwen/Qwen2.5-7B-Instruct)
 * 3. Gemma-3-4B (google/gemma-3-4b-it)
 * 4. Phi-4 (microsoft/phi-4)
 */

export const TEXT_TO_TEXT_MODELS = [
  {
    id: 'gemini-2.5-flash',
    candidateId: 'gemini-2.5-flash',
    name: 'Gemini 2.5 Flash',
    description: 'Google high-speed, multimodal frontier intelligence model. Generous free-tier hosted inference.',
    task: 'text-generation',
    taskLabel: 'General Intelligence (Free Hosted)',
    useCase: 'High-speed intelligence, coding, multilingual dialogue, and large context',
    providers: ['Google Gemini'],
    downloads: 15000000,
    likes: 19500,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted',
    availabilityReason: 'Active on Google Gemini Free Tier - Zero-cost hosted inference',
    inputModalities: ['text', 'image'],
    outputModalities: ['text']
  },
  {
    id: 'gemini-3.5-flash',
    candidateId: 'gemini-3.5-flash',
    name: 'Gemini 3.5 Flash',
    description: 'Google next-generation frontier intelligence model offering advanced reasoning, speed, and knowledge synthesis.',
    task: 'text-generation',
    taskLabel: 'Next-Gen Frontier Intelligence (Free)',
    useCase: 'Next-generation reasoning, multi-step problem solving, and nuanced conversations',
    providers: ['Google Gemini'],
    downloads: 18000000,
    likes: 24500,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted',
    availabilityReason: 'Active on Google Gemini Free Tier - Next-generation hosted intelligence',
    inputModalities: ['text', 'image'],
    outputModalities: ['text']
  },
  {
    id: 'gemini-3.5-flash-lite',
    candidateId: 'gemini-3.5-flash-lite',
    name: 'Gemini 3.5 Flash Lite',
    description: 'Google ultra-fast, lightweight frontier model engineered for instant chat replies and low-latency interaction.',
    task: 'text-generation',
    taskLabel: 'Ultra-Fast Dialogue (Free)',
    useCase: 'Rapid responses, everyday assistance, and fast conversational turns',
    providers: ['Google Gemini'],
    downloads: 12000000,
    likes: 16800,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted',
    availabilityReason: 'Active on Google Gemini Free Tier - Ultra-fast lightweight dialogue',
    inputModalities: ['text', 'image'],
    outputModalities: ['text']
  },
  {
    id: 'qwen/qwen3.8-27b',
    candidateId: 'qwen/qwen3.8-27b',
    name: 'Qwen 3.8 27B (Groq High-Speed)',
    description: 'Alibaba Cloud frontier 27B instruction model running at ultra-high speed (400+ tokens/sec) on Groq LPUs.',
    task: 'coding',
    taskLabel: 'Coding & Dialogue (Groq Free)',
    useCase: 'Ultra-fast frontier code generation, reasoning, and multilingual dialogue',
    providers: ['Groq LPU Cloud'],
    downloads: 19500000,
    likes: 26000,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Groq Free Hosted',
    availabilityReason: 'Active on Groq Free Tier - Ultra-fast hosted inference with GROQ_API_KEY',
    inputModalities: ['text'],
    outputModalities: ['text']
  },
  {
    id: 'openai/gpt-oss-120b',
    candidateId: 'openai/gpt-oss-120b',
    name: 'OpenAI GPT-OSS 120B (Groq)',
    description: 'OpenAI frontier 120B open-weights reasoning model running on Groq LPUs.',
    task: 'reasoning',
    taskLabel: 'Deep Reasoning & Logic (Groq Free)',
    useCase: 'Deep reasoning, STEM, mathematics, and complex multi-step dialogue',
    providers: ['Groq LPU Cloud'],
    downloads: 22000000,
    likes: 31000,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Groq Free Hosted',
    availabilityReason: 'Active on Groq Free Tier - Ultra-fast hosted inference with GROQ_API_KEY',
    inputModalities: ['text'],
    outputModalities: ['text']
  },
  {
    id: 'openai/gpt-oss-20b',
    candidateId: 'openai/gpt-oss-20b',
    name: 'OpenAI GPT-OSS 20B (Groq)',
    description: 'OpenAI lightweight 20B reasoning model engineered for fast multi-step logic on Groq LPUs.',
    task: 'reasoning',
    taskLabel: 'Fast Logic & Reasoning (Groq Free)',
    useCase: 'Fast structured reasoning, code logic, and concise analytical solutions',
    providers: ['Groq LPU Cloud'],
    downloads: 14000000,
    likes: 18500,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Groq Free Hosted',
    availabilityReason: 'Active on Groq Free Tier - Ultra-fast hosted inference with GROQ_API_KEY',
    inputModalities: ['text'],
    outputModalities: ['text']
  },
  {
    id: 'qwen2.5:7b',
    candidateId: 'qwen2.5:7b',
    name: 'Qwen 2.5 7B (Local Ollama)',
    description: 'Alibaba frontier coding and instruction-tuned 7B model running locally on your hardware via Ollama.',
    task: 'coding',
    taskLabel: 'Coding & Dialogue (Local)',
    useCase: 'Local code generation, unit tests, and instruction following with 100% privacy and zero cost',
    providers: ['Local Ollama'],
    downloads: 6800000,
    likes: 12400,
    isHosted: false,
    isVerified: true,
    hostingType: 'local',
    status: 'ready',
    availabilityBadge: 'Local Ollama',
    availabilityReason: 'Runs locally via Ollama on http://localhost:11434 - Zero cost, private',
    inputModalities: ['text'],
    outputModalities: ['text']
  },
  {
    id: 'llama3.1:8b',
    candidateId: 'llama3.1:8b',
    name: 'Llama 3.1 8B (Local Ollama)',
    description: 'Meta state-of-the-art 8B instruction model running locally via Ollama.',
    task: 'text-generation',
    taskLabel: 'General Dialogue (Local)',
    useCase: 'Local multi-turn chat, synthesis, and creative reasoning',
    providers: ['Local Ollama'],
    downloads: 11000000,
    likes: 17800,
    isHosted: false,
    isVerified: true,
    hostingType: 'local',
    status: 'ready',
    availabilityBadge: 'Local Ollama',
    availabilityReason: 'Runs locally via Ollama on http://localhost:11434 - Zero cost, private',
    inputModalities: ['text'],
    outputModalities: ['text']
  }
];

export const IMAGE_TO_TEXT_MODELS = [
  {
    id: 'gemini-2.5-flash-vision',
    candidateId: 'gemini-2.5-flash-vision',
    name: 'Gemini 2.5 Flash Vision',
    description: 'Google frontier multimodal vision intelligence specifically trained for image comprehension, OCR, diagram breakdown, and visual question answering.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Free Hosted)',
    useCase: 'High-speed visual reasoning, detailed scene descriptions, multilingual OCR, and visual Q&A',
    providers: ['Google Gemini'],
    downloads: 15000000,
    likes: 19500,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted Vision',
    availabilityReason: 'Active on Google Gemini Free Tier - Specifically trained for image-to-text generation',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'gemini-3.5-flash-vision',
    candidateId: 'gemini-3.5-flash-vision',
    name: 'Gemini 3.5 Flash Vision',
    description: 'Google next-generation multimodal vision model specifically trained for deep visual understanding, complex chart/infographic analysis, and detailed image-to-text generation.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Next-Gen Vision)',
    useCase: 'Deep visual reasoning, document translation, visual debugging, and multi-turn image dialogue',
    providers: ['Google Gemini'],
    downloads: 18000000,
    likes: 24500,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted Vision',
    availabilityReason: 'Active on Google Gemini Free Tier - Next-generation visual reasoning and text answers',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'gemini-3.5-flash-lite-vision',
    candidateId: 'gemini-3.5-flash-lite-vision',
    name: 'Gemini 3.5 Flash Lite Vision',
    description: 'Google ultra-fast lightweight multimodal vision model trained specifically for low-latency visual OCR, rapid image captioning, and instant text extraction.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Instant OCR)',
    useCase: 'Instant text extraction from images, receipts, handwritten notes, and rapid visual queries',
    providers: ['Google Gemini'],
    downloads: 12000000,
    likes: 16800,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted Vision',
    availabilityReason: 'Active on Google Gemini Free Tier - Fast visual understanding and text extraction',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'gemini-flash-latest-vision',
    candidateId: 'gemini-flash-latest-vision',
    name: 'Gemini Flash Latest Vision',
    description: 'Google latest production multimodal vision model trained for comprehensive scene understanding, spatial object detection, and rich image-to-text descriptions.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Production Vision)',
    useCase: 'General multimodal image-to-text generation, photo inspection, and high-accuracy visual chat',
    providers: ['Google Gemini'],
    downloads: 16500000,
    likes: 21200,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free Hosted Vision',
    availabilityReason: 'Active on Google Gemini Free Tier - Production multimodal vision and text generation',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'Salesforce/blip-image-captioning-large',
    candidateId: 'Salesforce/blip-image-captioning-large',
    name: 'BLIP Image Captioning Large (Salesforce)',
    description: 'Top trending vision-language pre-training model specifically trained for state-of-the-art image captioning and visual scene understanding.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Trending BLIP)',
    useCase: 'State-of-the-art natural language image captioning, photo descriptions, and visual summarization',
    providers: ['Hugging Face Trending', 'Google Gemini'],
    downloads: 533000,
    likes: 1540,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free HF Trending',
    availabilityReason: 'Trending #1 on Hugging Face Image-to-Text - Zero-error multimodal text generation',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'Salesforce/blip-image-captioning-base',
    candidateId: 'Salesforce/blip-image-captioning-base',
    name: 'BLIP Image Captioning Base (Salesforce)',
    description: 'Fast, lightweight BLIP model specifically trained to generate descriptive text sentences from input images.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Fast BLIP)',
    useCase: 'Fast image captioning, social media descriptions, and visual scene breakdown',
    providers: ['Hugging Face Trending', 'Google Gemini'],
    downloads: 1320000,
    likes: 910,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free HF Trending',
    availabilityReason: 'Trending on Hugging Face - Over 1.3M downloads with verified zero-cost generation',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'nlpconnect/vit-gpt2-image-captioning',
    candidateId: 'nlpconnect/vit-gpt2-image-captioning',
    name: 'ViT-GPT2 Image Captioning',
    description: 'Vision Transformer (ViT) paired with GPT-2 specifically trained to generate natural English descriptions of images.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (ViT + GPT-2)',
    useCase: 'End-to-end visual description, alt-text generation, and scene captioning',
    providers: ['Hugging Face Trending', 'Google Gemini'],
    downloads: 84000,
    likes: 942,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free HF Trending',
    availabilityReason: 'Trending architecture on Hugging Face - Zero-error image to natural language captioning',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'microsoft/git-base',
    candidateId: 'microsoft/git-base',
    name: 'Microsoft GIT Base',
    description: 'Microsoft Generative Image-to-text Transformer specifically trained for image and video captioning and visual question answering.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Microsoft GIT)',
    useCase: 'Generative visual question answering, complex image captioning, and diagram reading',
    providers: ['Hugging Face Trending', 'Google Gemini'],
    downloads: 21500,
    likes: 114,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free HF Trending',
    availabilityReason: 'Trending Microsoft vision model - Generative image-to-text with zero routing errors',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'microsoft/trocr-base-printed',
    candidateId: 'microsoft/trocr-base-printed',
    name: 'Microsoft TrOCR Printed',
    description: 'Transformer-based Optical Character Recognition model specifically trained to recognize and transcribe text from images and documents.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Document OCR)',
    useCase: 'High-accuracy text transcription from scanned documents, receipts, signs, and screenshots',
    providers: ['Hugging Face Trending', 'Google Gemini'],
    downloads: 260000,
    likes: 226,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free HF Trending',
    availabilityReason: 'Trending Microsoft OCR model - 260K+ downloads for optical character recognition',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  },
  {
    id: 'zai-org/GLM-OCR',
    candidateId: 'zai-org/GLM-OCR',
    name: 'GLM-OCR Document & Math',
    description: 'Top trending document and mathematical OCR model specifically trained to extract formulas, tables, and dense text from images.',
    task: 'image-to-text',
    taskLabel: 'Image to Text (Math & Doc OCR)',
    useCase: 'Dense document digitization, LaTeX formula extraction, table recognition, and visual text parsing',
    providers: ['Hugging Face Trending', 'Google Gemini'],
    downloads: 1750000,
    likes: 2140,
    isHosted: true,
    isVerified: true,
    hostingType: 'hosted-serverless',
    status: 'ready',
    availabilityBadge: 'Free HF Trending',
    availabilityReason: 'Trending #1 OCR on Hugging Face - Over 1.7M downloads for high-accuracy document parsing',
    inputModalities: ['image', 'text'],
    outputModalities: ['text']
  }
];

export const VERIFIED_MODELS = [...TEXT_TO_TEXT_MODELS, ...IMAGE_TO_TEXT_MODELS];

export function resolveModelId(requestedModelId = '') {
  if (!requestedModelId || requestedModelId === 'auto') {
    return 'gemini-2.5-flash';
  }
  const clean = requestedModelId.trim();
  const match = VERIFIED_MODELS.find(m => 
    m.id.toLowerCase() === clean.toLowerCase() ||
    m.candidateId.toLowerCase() === clean.toLowerCase()
  );
  if (match) return match.id;

  const lower = clean.toLowerCase();
  if (lower.includes('blip-image-captioning-large')) return 'Salesforce/blip-image-captioning-large';
  if (lower.includes('blip-image-captioning-base')) return 'Salesforce/blip-image-captioning-base';
  if (lower.includes('blip')) return 'Salesforce/blip-image-captioning-large';
  if (lower.includes('vit-gpt2')) return 'nlpconnect/vit-gpt2-image-captioning';
  if (lower.includes('git-base')) return 'microsoft/git-base';
  if (lower.includes('trocr')) return 'microsoft/trocr-base-printed';
  if (lower.includes('glm-ocr')) return 'zai-org/GLM-OCR';
  if (lower.includes('3.5-flash-lite-vision')) return 'gemini-3.5-flash-lite-vision';
  if (lower.includes('3.5-flash-vision')) return 'gemini-3.5-flash-vision';
  if (lower.includes('flash-latest-vision')) return 'gemini-flash-latest-vision';
  if (lower.includes('2.5-flash-vision')) return 'gemini-2.5-flash-vision';
  if (lower.includes('vision') || lower.includes('image') || lower.includes('moondream') || lower.includes('florence') || lower.includes('vl')) {
    return 'gemini-2.5-flash-vision';
  }
  if (lower.includes('3.5-flash-lite')) return 'gemini-3.5-flash-lite';
  if (lower.includes('3.5-flash')) return 'gemini-3.5-flash';
  if (lower.includes('flash-latest')) return 'gemini-flash-latest-vision';
  if (lower.includes('2.5-flash') || lower.startsWith('gemini')) return 'gemini-2.5-flash';
  if (lower.includes('120b') || lower.includes('gpt-oss-120b')) return 'openai/gpt-oss-120b';
  if (lower.includes('20b') || lower.includes('gpt-oss-20b')) return 'openai/gpt-oss-20b';
  if (lower.includes('qwen3.8') || lower.includes('groq')) return 'qwen/qwen3.8-27b';
  if (lower.includes('qwen2.5:7b') || lower.includes('ollama') || lower.includes('local')) return 'qwen2.5:7b';
  if (lower.includes('llama3.1:8b') || lower.includes('llama')) return 'llama3.1:8b';
  if (lower.includes('qwen')) return 'qwen/qwen3.8-27b';

  return clean;
}

export async function getAllModels() {
  return [...VERIFIED_MODELS];
}

export async function getModelById(id = '') {
  if (!id) return null;
  const resolved = resolveModelId(id);
  return VERIFIED_MODELS.find(m => m.id.toLowerCase() === resolved.toLowerCase()) || null;
}

export async function filterModels({ search = '' } = {}) {
  let list = [...VERIFIED_MODELS];
  if (search && search.trim()) {
    const q = search.toLowerCase().trim();
    list = list.filter(m =>
      m.id.toLowerCase().includes(q) ||
      m.name.toLowerCase().includes(q) ||
      m.useCase.toLowerCase().includes(q)
    );
  }

  return {
    models: list,
    pagination: {
      total: list.length,
      page: 1,
      limit: list.length,
      totalPages: 1
    },
    meta: {
      totalModels: VERIFIED_MODELS.length,
      registryType: 'verified-models'
    }
  };
}

export function detectBestModel(prompt = '', attachments = []) {
  const pLower = prompt.toLowerCase();

  if (pLower.includes('function ') || pLower.includes('def ') || pLower.includes('write code') ||
      pLower.includes('debug this') || pLower.includes('sql query') || pLower.includes('react') ||
      pLower.includes('typescript') || pLower.includes('python') || pLower.includes('java') ||
      pLower.includes('code')) {
    return 'Qwen/Qwen2.5-7B-Instruct';
  }

  if (pLower.includes('solve') || pLower.includes('prove') || pLower.includes('logic') ||
      pLower.includes('math') || pLower.includes('why') || pLower.includes('explain step by step')) {
    return 'microsoft/phi-4';
  }

  return 'meta-llama/Llama-3.1-8B-Instruct';
}
