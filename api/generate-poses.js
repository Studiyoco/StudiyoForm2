// POST /api/generate-poses
// Body: { lockedCharacterBlock: string }
// Returns: { frontUrl: string } — blocking call, waits for the generation.

const { higgsfield, config } = require('@higgsfield/client/v2');
const { buildPosePrompt } = require('./_prompt');

config({
  apiKey: process.env.HIGGSFIELD_API_KEY,
  apiSecret: process.env.HIGGSFIELD_API_SECRET
});

const MODEL = 'nano_banana_pro';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.HIGGSFIELD_API_KEY || !process.env.HIGGSFIELD_API_SECRET) {
    return res.status(500).json({ error: 'Higgsfield credentials not set on the server' });
  }

  const { lockedCharacterBlock } = req.body || {};
  if (!lockedCharacterBlock) {
    return res.status(400).json({ error: 'lockedCharacterBlock required' });
  }

  try {
    const jobSet = await higgsfield.subscribe(MODEL, {
      input: {
        prompt: buildPosePrompt(lockedCharacterBlock, 'front'),
        aspect_ratio: '3:4'
      }
    });
    const frontUrl = jobSet?.jobs?.[0]?.results?.raw?.url;
    if (!frontUrl) return res.status(502).json({ error: 'No image returned', raw: jobSet });
    return res.status(200).json({ frontUrl });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
