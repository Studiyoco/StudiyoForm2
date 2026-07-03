// POST /api/generate-poses
// Body: { lockedCharacterBlock: string }
// Returns: { frontTaskId } — poll via /api/poll-task with model 'nano-banana-pro'.

const { buildPosePrompt, safeParseResponse } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const NANO_BANANA_ENDPOINT = 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro';

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
    const r = await fetch(NANO_BANANA_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-magnific-api-key': MAGNIFIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: buildPosePrompt(lockedCharacterBlock, 'front'),
        aspect_ratio: '3:4',
        resolution: '1K'
      })
    }).then(safeParseResponse);

    const frontTaskId = r.json?.data?.task_id;
    if (!frontTaskId) {
      return res.status(502).json({ error: 'No task_id returned', status: r.status, body: r.json || r.text });
    }
    return res.status(200).json({ frontTaskId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
