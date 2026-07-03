// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { images: string[] } — completed image URLs, blocking call.
//
// Uses the confirmed v2 SDK pattern: `higgsfield` object + `config()`,
// not the v1 `HiggsfieldClient` class (which has no `.subscribe()` method
// — that mismatch is what caused the earlier crash).
// subscribe() submits and polls internally, so this call blocks until
// the generation finishes or fails.

const { higgsfield, config } = require('@higgsfield/client/v2');
const { buildAllVariationPrompts } = require('./_prompt');

config({
  apiKey: process.env.HIGGSFIELD_API_KEY,
  apiSecret: process.env.HIGGSFIELD_API_SECRET
});

const MODEL = 'nano_banana_2'; // confirmed real via Higgsfield's own CLI docs; 'nano_banana_pro' was returning 404, not a valid route

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.HIGGSFIELD_API_KEY || !process.env.HIGGSFIELD_API_SECRET) {
    return res.status(500).json({ error: 'Higgsfield credentials not set on the server' });
  }

  const form = req.body || {};
  if (!form.company || !form.contact || !form.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompts = buildAllVariationPrompts(form);

  try {
    const results = await Promise.allSettled(
      prompts.map((prompt) =>
        higgsfield.subscribe(MODEL, {
          input: { prompt, aspect_ratio: '3:4' }
        })
      )
    );

    const images = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value?.jobs?.[0]?.results?.raw?.url)
      .filter(Boolean);

    const failed = results.filter((r) => r.status === 'rejected');
    if (images.length === 0) {
      const sample = failed[0]?.reason;
      const sampleMessage = sample?.message || sample?.toString?.() || String(sample);
      return res.status(502).json({
        error: 'All 10 variations failed',
        failedCount: failed.length,
        sampleError: sampleMessage
      });
    }

    return res.status(200).json({ images, failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
