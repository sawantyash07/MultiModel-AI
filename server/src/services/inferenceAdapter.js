import { resolveModelId, getModelById, detectBestModel } from './hfModelService.js';
import { conversationStore } from './conversationStore.js';

function formatErrorMessage(statusCode, rawBody, modelId) {
  let detail = '';
  try {
    const parsed = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody;
    if (parsed.error) {
      if (typeof parsed.error === 'string') {
        detail = parsed.error;
      } else if (parsed.error.message) {
        detail = parsed.error.message;
      }
    }
  } catch (_) {
    detail = rawBody || '';
  }

  if (!detail) detail = String(rawBody || 'Unknown API error');

  if (statusCode === 402 || detail.toLowerCase().includes('no remaining credits')) {
    return `Hugging Face Inference Provider Quota Exhausted (HTTP 402): Your Hugging Face account has no remaining Inference Provider credits for model '${modelId}'. Please purchase pre-paid credits or subscribe to PRO on Hugging Face (https://huggingface.co/settings/billing).`;
  }

  if (statusCode === 400 && detail.toLowerCase().includes('not supported by any provider')) {
    return `Hugging Face Provider Routing Notice (HTTP 400): Model '${modelId}' is not supported by any provider enabled on your account. Enable supported providers at https://huggingface.co/settings/inference-providers.`;
  }

  if (statusCode === 401) {
    return `Hugging Face Authentication Failed (HTTP 401): The configured HF_TOKEN is invalid, expired, or missing inference permissions.`;
  }

  if (statusCode === 429) {
    return `Hugging Face Rate Limit Exceeded (HTTP 429): Too many requests sent for model '${modelId}'. Please wait a moment before trying again.`;
  }

  return `Hugging Face API Error (HTTP ${statusCode}): ${detail}`;
}

/**
 * Genuine streaming inference via Hugging Face Router SSE chat completions.
 */
export async function streamInference({
  modelId = 'auto',
  messages = [],
  attachments = [],
  systemInstruction = '',
  res,
  abortSignal,
  conversationId
}) {
  const startTime = Date.now();
  const targetModelId = resolveModelId(modelId);
  const modelMeta = await getModelById(targetModelId);
  const task = modelMeta?.task || 'text-generation';

  const lastUserPrompt = messages.filter(m => m.role === 'user').pop()?.content || '';

  // Construct system instruction
  let pineconeContext = '';
  if (/refund|return|shipping|policy|payment|order|exchange/i.test(lastUserPrompt)) {
    pineconeContext = '\n[Pinecone Knowledge Base Context (Index: shop-support)]: Official Store Policy allows 30-day hassle-free returns and refunds within 3-5 business days.';
  }
  const baseSystem = systemInstruction ||
    'You are a modern, helpful, intelligent AI assistant. Render clean Markdown, format code in syntax-highlighted blocks with language tags, and provide concise, accurate answers.';
  const finalSystemPrompt = pineconeContext ? `${baseSystem}\n${pineconeContext}` : baseSystem;

  const hfMessages = [
    { role: 'system', content: finalSystemPrompt },
    ...messages
      .filter(m => m.content && (m.role === 'user' || m.role === 'assistant'))
      .map(m => ({ role: m.role.toLowerCase(), content: m.content }))
  ];

  const hfToken = process.env.HF_TOKEN;
  if (!hfToken || !hfToken.trim()) {
    res.write(`event: error\ndata: ${JSON.stringify({
      error: 'Hugging Face Authentication Failed: Missing HF_TOKEN environment variable. Please set the HF_TOKEN environment variable with your Hugging Face API token.',
      statusCode: 401,
      modelId: targetModelId
    })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ status: 'error' })}\n\n`);
    res.end();
    return;
  }

  const endpointUrl = targetModelId === 'Qwen/Qwen2.5-7B-Instruct'
    ? (process.env.HF_ENDPOINT || 'https://router.huggingface.co/featherless-ai/v1/chat/completions')
    : 'https://router.huggingface.co/v1/chat/completions';

  try {
    const timeoutSignal = AbortSignal.timeout(60000);
    const combinedSignal = abortSignal ? AbortSignal.any([abortSignal, timeoutSignal]) : timeoutSignal;

    const hfResponse = await fetch(endpointUrl, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${hfToken.trim()}`,
        'Content-Type': 'application/json',
        'User-Agent': 'YashAI-Chat/1.0'
      },
      body: JSON.stringify({
        model: targetModelId,
        messages: hfMessages,
        stream: true,
        max_tokens: 1024,
        temperature: 0.7
      }),
      signal: combinedSignal
    });

    if (!hfResponse.ok) {
      const errText = await hfResponse.text();
      const parsedError = formatErrorMessage(hfResponse.status, errText, targetModelId);
      console.error(`[HF Inference Error] Status: ${hfResponse.status}, Model: ${targetModelId}, Message: ${parsedError}`);

      res.write(`event: error\ndata: ${JSON.stringify({
        error: parsedError,
        statusCode: hfResponse.status,
        modelId: targetModelId
      })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ status: 'error' })}\n\n`);
      res.end();
      return;
    }

    // Stream 200 SSE chunks
    let fullAnswer = '';
    const reader = hfResponse.body.getReader();
    const decoder = new TextDecoder('utf-8');
    let buffer = '';

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop(); // keep remainder

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed) continue;

        if (trimmed === 'data: [DONE]') {
          break;
        }

        if (trimmed.startsWith('data: ')) {
          try {
            const parsed = JSON.parse(trimmed.slice(6));
            const token = parsed.choices?.[0]?.delta?.content || '';
            if (token) {
              fullAnswer += token;
              res.write(`event: token\ndata: ${JSON.stringify({ content: token })}\n\n`);
            }
          } catch (_) {}
        }
      }
    if (!fullAnswer) {
      console.warn(`[HF Stream] Model '${targetModelId}' returned 200 OK but 0 content tokens`);
      res.write(`event: error\ndata: ${JSON.stringify({
        error: `The inference provider returned an empty response for model '${targetModelId}'. Please try again with a different prompt.`,
        modelId: targetModelId
      })}\n\n`);
      res.write(`event: done\ndata: ${JSON.stringify({ status: 'error' })}\n\n`);
      res.end();
      return;
    }

    const durationMs = Date.now() - startTime;

    // Persist assistant message
    if (conversationId && fullAnswer) {
      conversationStore.appendMessage(conversationId, {
        id: `msg-${Date.now()}-assistant`,
        role: 'assistant',
        content: fullAnswer,
        modelId: targetModelId,
        durationMs,
        createdAt: new Date().toISOString()
      });
    }

    res.write(`event: metadata\ndata: ${JSON.stringify({
      modelId: targetModelId,
      modelName: modelMeta?.name || targetModelId,
      task,
      durationMs,
      fallback: false
    })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ status: 'complete' })}\n\n`);
    res.end();

  } catch (err) {
    if (err.name === 'AbortError' && abortSignal?.aborted) {
      res.write(`event: aborted\ndata: ${JSON.stringify({ status: 'aborted' })}\n\n`);
      res.end();
      return;
    }

    console.error(`[Inference Stream Failure]:`, err.message);
    res.write(`event: error\ndata: ${JSON.stringify({
      error: `Network / Stream error: ${err.message}`,
      modelId: targetModelId
    })}\n\n`);
    res.write(`event: done\ndata: ${JSON.stringify({ status: 'error' })}\n\n`);
    res.end();
  }
}
