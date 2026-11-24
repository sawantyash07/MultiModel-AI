import { GoogleGenerativeAI } from '@google/generative-ai';

let genAI = null;
function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;
  if (!genAI) genAI = new GoogleGenerativeAI(apiKey);
  return genAI;
}

export async function generateFollowUpSuggestions(prompt = '', answer = '', history = [], modelId = 'auto') {
  const groqKey = process.env.GROQ_API_KEY;

  // 1. Try Groq high-speed provider (~300ms response)
  if (groqKey) {
    try {
      const groqModel = (modelId && modelId.includes('qwen')) ? 'qwen/qwen3.8-27b' : 'qwen/qwen3.8-27b';
      const systemPrompt = `You are an expert conversational AI assistant.
Generate exactly 3 relevant, insightful, and distinct follow-up questions that the user would naturally ask next.
Rules:
- Directly base questions on the assistant's latest response and dialogue.
- Make each question explore a unique angle (edge case, implementation, comparison).
- Avoid repeating questions already asked.
- Keep each under 15 words.
- Return ONLY a valid JSON array of 3 strings: ["Question 1?", "Question 2?", "Question 3?"].
- No markdown or extra commentary.`;

      const userText = `Recent Context: ${history.slice(-3).map(m => `${m.role}: ${m.content?.slice(0, 200)}`).join('\n')}
User Prompt: ${prompt}
Assistant Answer: ${answer.slice(0, 800)}`;

      const resp = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${groqKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: groqModel,
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userText }
          ],
          temperature: 0.7,
          max_tokens: 256
        })
      });

      if (resp.ok) {
        const data = await resp.json();
        const content = data?.choices?.[0]?.message?.content || '';
        const clean = content.replace(/```json/g, '').replace(/```/g, '').trim();
        const parsed = JSON.parse(clean);
        if (Array.isArray(parsed) && parsed.length >= 3) {
          return parsed.slice(0, 3).map(q => q.trim().endsWith('?') ? q.trim() : `${q.trim()}?`);
        }
      }
    } catch (e) {
      console.warn('[Suggestions] Groq suggestion failed, attempting Gemini:', e.message);
    }
  }

  // 2. Try Gemini
  const gemini = getGeminiClient();
  if (gemini) {
    try {
      const model = gemini.getGenerativeModel({ model: 'gemini-2.5-flash' });
      const query = `
Based on this conversation exchange, generate exactly 3 short, insightful follow-up questions that the user might want to ask next.
User Prompt: ${prompt}
Assistant Answer: ${answer.substring(0, 600)}

Output ONLY a JSON array of 3 strings. Example:
["Follow up 1?", "Follow up 2?", "Follow up 3?"]
`;
      const result = await model.generateContent(query);
      const text = result.response.text();
      const clean = text.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsed = JSON.parse(clean);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed.slice(0, 3);
      }
    } catch (err) {
      console.warn('[Suggestions] Gemini suggestion failed:', err.message);
    }
  }

  // 3. Dynamic contextual fallback
  const topic = prompt.replace(/^(explain|what is|how to|write|describe|tell me about)\s+/i, '').slice(0, 30).trim() || 'this topic';
  return [
    `Can you provide a practical example of ${topic}?`,
    `What are common pitfalls and edge cases with ${topic}?`,
    `How does this compare to alternative approaches?`
  ];
}
