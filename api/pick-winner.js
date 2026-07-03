// POST /api/pick-winner
// Body: { images: [{ data, mimeType }], form: {...} }
// Returns: { winnerIndex, reasoning, lockedCharacterBlock }
//
// Fully specified against the real, documented Anthropic API
// (api.anthropic.com/v1/messages, vision content blocks). No guesswork.
//
// Images now arrive already base64-encoded straight from Gemini, so the
// fetch-and-encode round trip this used to need against Magnific's URLs
// is gone entirely -- one less network call, one less place to break.

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-5';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on the server' });
  }

  const { images, form } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images array required' });
  }

  try {
    const content = [
      {
        type: 'text',
        text: `You are Studiyo's character strategy director. Below are ${images.length} mascot `
          + `concept variations generated from this brief:\n\n`
          + `Company: ${form.company}\nProduct: ${form.product || 'n/a'}\n`
          + `Kind: ${(form.kind || []).join(', ')}\nVibe: ${(form.vibe || []).join(', ')}\n`
          + `Style: ${form.style || 'n/a'}\nUsage: ${(form.usage || []).join(', ')}\n\n`
          + `Score each on brand fit, distinctiveness, rig-ability (simple silhouette, readable `
          + `small), and emotional range. Pick the single strongest winner. Then write a locked `
          + `character description block: one paragraph under 120 words fixing species/shape, `
          + `proportions, exact colors, face style, and material, precise enough that another `
          + `image model reproduces this exact character consistently.\n\n`
          + `Respond ONLY with JSON, no markdown fences, no preamble:\n`
          + `{"winnerIndex": <0-based int>, "reasoning": "<2-3 sentences>", "lockedCharacterBlock": "<paragraph>"}`
      },
      ...images.map((img) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.data }
      }))
    ];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 600,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await resp.json();
    const text = (data.content || []).map((c) => c.text || '').join('').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    return res.status(200).json(parsed);
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
