const OpenAI = require('openai');
const { buildSystemPrompt } = require('../config/prompt');

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
  baseURL: process.env.AI_BASE_URL || undefined,
});

const FALLBACK_REPLY = 'Извините, не совсем понял. Не могли бы вы переформулировать?';

function parseModelOutput(raw) {
  try {
    const parsed = JSON.parse(raw);
    const reply =
      typeof parsed.reply === 'string' && parsed.reply.trim() ? parsed.reply.trim() : FALLBACK_REPLY;
    const data = parsed.data && typeof parsed.data === 'object' ? parsed.data : {};
    return { reply, data };
  } catch {
    return { reply: FALLBACK_REPLY, data: {} };
  }
}

/**
 * @param {{history: {role: string, content: string}[], leadData: object}} params
 * @returns {Promise<{reply: string, data: object}>}
 */
async function askAI({ history, leadData }) {
  const messages = [
    { role: 'system', content: buildSystemPrompt(leadData) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const completion = await openai.chat.completions.create({
    model: MODEL,
    messages,
    response_format: { type: 'json_object' },
    temperature: 0.4,
  });

  return parseModelOutput(completion.choices[0].message.content);
}

module.exports = { askAI };
