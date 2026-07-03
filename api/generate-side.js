// POST /api/generate-side
// Body: { lockedCharacterBlock: string, frontImageUrl: string }
// Returns: { sideTaskId } — poll via /api/poll-task with model 'nano-banana-pro-flash'.
//
// Back pose dropped per cost-cutting decision (front + side only). To
// restore it: duplicate the submit() call with pose='back', add backTaskId
// to the response, and update index.html's pollUntilDone call to include
// it alongside sideTaskId. buildPosePrompt in _prompt.js already supports
// 'back', nothing there needs to change.

const { buildPosePrompt, safeParseResponse } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const NANO_BANANA_ENDPOINT = 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro-flash';

async function detectMimeType(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.headers.get('content-type') || 'image/png';
  } catch (e) {
    return 'image/png';
  }
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock, frontImageUrl } = req.body || {};
  if (!lockedCharacterBlock || !frontImageUrl) {
    return res.status(400).json({ error: 'lockedCharacterBlock and frontImageUrl required' });
  }

  try {
    const mimeType = await detectMimeType(frontImageUrl);

    const r = await fetch(NANO_BANANA_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-magnific-api-key': MAGNIFIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: buildPosePrompt(lockedCharacterBlock, 'side'),
        aspect_ratio: '3:4',
        resolution: '1K',
        reference_images: [{
          image: frontImageUrl,
          text: 'Reference for exact character identity, colors, and design. Do not copy this pose or angle, only the character itself.',
          mime_type: mimeType
        }]
      })
    }).then(safeParseResponse);

    const sideTaskId = r.json?.data?.task_id;
    if (!sideTaskId) {
      return res.status(502).json({
        error: 'Missing task_id from Magnific',
        status: r.status, body: r.json || r.text
      });
    }
    return res.status(200).json({ sideTaskId, mimeType });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
