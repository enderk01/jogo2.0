/* ai-wrapper.js
   Wrapper to call local model servers (text-generation-webui or a simple HTTP server)
   Falls back to a mock generator when no server is available.
   Usage: await generateResponse(userText, {max_tokens, temperature})
*/

import { getTopMemories } from './memory-store.js';

const LOCAL_ENDPOINTS = [
  // common endpoints: text-generation-webui (oobabooga) and simple servers
  'http://localhost:7860/api/predict',
  'http://localhost:7860/api/generate',
  'http://localhost:5000/generate',
  'http://localhost:5000/api/generate'
];

async function tryEndpoints(prompt, opts) {
  for (const url of LOCAL_ENDPOINTS) {
    try {
      // Try common payload shapes
      // First: /api/predict (oobabooga style)
      if (url.endsWith('/api/predict')) {
        const body = { data: [prompt] };
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('not ok');
        const j = await res.json();
        // response may have data[0] or result
        const text = j?.data?.[0] || j?.result || JSON.stringify(j);
        return String(text);
      }
      // Second: /api/generate (some servers)
      if (url.includes('/api/generate') || url.endsWith('/generate')) {
        const body = { prompt, max_tokens: opts?.max_tokens || 256, temperature: opts?.temperature || 0.7 };
        const res = await fetch(url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body)
        });
        if (!res.ok) throw new Error('not ok');
        const j = await res.json();
        // try common fields
        const text = j?.text || j?.generated_text || j?.result || j?.data?.[0] || JSON.stringify(j);
        return String(text);
      }
    } catch (e) {
      // continue to next endpoint
      console.warn('Endpoint failed', url, e.message);
      continue;
    }
  }
  return null;
}

export async function generateResponse(userText, opts = {}) {
  // retrieve relevant memories (top 5)
  const memories = await getTopMemories(5, userText);
  const memString = (memories && memories.length) ? memories.map(m => `- ${m.text}`).join('\n') : 'Nenhuma memória relevante.';

  const prompt = `Você é o NPC interativo gerado pelo Perchance. Use o contexto abaixo para responder de forma imersiva e consistente.\n\nMemórias relevantes:\n${memString}\n\nAção do jogador: ${userText}\n\nResposta:`;

  // 1) Try local endpoints
  const remote = await tryEndpoints(prompt, opts);
  if (remote) return remote;

  // 2) Fallback: simple rule-based/mock with memory injection
  const mock = `NPC (offline): Eu lembro: ${memories.map(m => m.text).slice(0,3).join(' | ')}. Você disse: "${userText}". Respondo: Isso parece interessante — continue.`;
  return mock;
}
