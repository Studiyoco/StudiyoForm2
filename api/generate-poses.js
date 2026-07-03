// POST /api/generate-poses
// Body: { lockedCharacterBlock: string }
// Returns: { frontTaskId } — poll via /api/poll-mystic.

const { buildPosePrompt } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const MYSTIC_ENDPOINT = 'https://api.magnific.com/v1/ai/mystic';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock } = req.body || {};
  if (!lockedCharacterBlock) {
    return res.status(400).json({ error: 'lockedCharacterBlock required' });
  }

  try {
    const r = await fetch(MYSTIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-magnific-api-key': MAGNIFIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: buildPosePrompt(lockedCharacterBlock, 'front'),
        model: 'flexible',
        resolution: '2k',
        aspect_ratio: 'traditional_3_4'
      })
    }).then((r) => r.json());

    const frontTaskId = r?.data?.task_id;
    if (!frontTaskId) return res.status(502).json({ error: 'No task_id returned', raw: r });
    return res.status(200).json({ frontTaskId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
