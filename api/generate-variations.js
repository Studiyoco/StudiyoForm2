// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { images: string[] } — completed image URLs, blocking call.
//
// Uses the official @higgsfield/client SDK's subscribe(), which submits
// and polls internally. That means this function runs for as long as the
// slowest of the 10 parallel generations, likely 15-40s. Vercel's default
// function timeout (10s on Hobby) will kill this before it finishes — see
// vercel.json in this project, which raises maxDuration. If you're on the
// Hobby plan, confirm in your Vercel dashboard whether the raised timeout
// actually applies to your plan; some tiers cap it regardless of config.

const { HiggsfieldClient } = require('@higgsfield/client');
const { buildAllVariationPrompts } = require('./_prompt');

const higgsfield = new HiggsfieldClient({
  apiKey: process.env.HIGGSFIELD_API_KEY,
  apiSecret: process.env.HIGGSFIELD_API_SECRET
});

const MODEL = 'nano_banana_pro'; // confirmed against live MCP usage this session

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
      .map((r) => r.value?.images?.[0]?.url)
      .filter(Boolean);

    const failed = results.filter((r) => r.status === 'rejected').length;
    if (images.length === 0) {
      return res.status(502).json({ error: 'All 10 variations failed', failed });
    }

    return res.status(200).json({ images, failed });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
