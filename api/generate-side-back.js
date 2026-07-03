// POST /api/generate-side-back
// Body: { lockedCharacterBlock: string, frontImageUrl: string }
// Returns: { sideTaskId, backTaskId } — poll via /api/poll-task with
// model 'nano-banana-pro-flash'.
//
// Nano Banana Pro Flash's reference_images field takes a plain URL, not
// base64. Each reference image carries a `text` field describing its
// purpose: an identity anchor, not a pose to copy exactly.
//
// Two fixes from the first real failure here:
// 1. mime_type was hardcoded to image/png, a guess never verified against
//    what Mystic actually returns. Now fetched via HEAD request and used
//    for real, falling back to png only if the header is missing.
// 2. Response parsing now goes through safeParseResponse, which reads
//    text first rather than assuming JSON — a 502 gateway error is often
//    HTML, and blindly calling .json() on it throws and hides the real
//    error message. That masking is what turned Magnific's actual 502
//    into an opaque generic 500 on the first attempt.

const { buildPosePrompt, safeParseResponse } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const NANO_BANANA_ENDPOINT = 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro-flash';

async function detectMimeType(url) {
  try {
    const r = await fetch(url, { method: 'HEAD' });
    return r.headers.get('content-type') || 'image/png';
  } catch (e) {
    return 'image/png'; // fallback only if HEAD itself fails
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

    const submit = (pose) => fetch(NANO_BANANA_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-magnific-api-key': MAGNIFIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: buildPosePrompt(lockedCharacterBlock, pose),
        aspect_ratio: '3:4',
        resolution: '1K',
        reference_images: [{
          image: frontImageUrl,
          text: 'Reference for exact character identity, colors, and design. Do not copy this pose or angle, only the character itself.',
          mime_type: mimeType
        }]
      })
    }).then(safeParseResponse);

    const [sideRes, backRes] = await Promise.all([submit('side'), submit('back')]);
    const sideTaskId = sideRes.json?.data?.task_id;
    const backTaskId = backRes.json?.data?.task_id;

    if (!sideTaskId || !backTaskId) {
      return res.status(502).json({
        error: 'Missing task_id from Magnific',
        sideStatus: sideRes.status, sideBody: sideRes.json || sideRes.text,
        backStatus: backRes.status, backBody: backRes.json || backRes.text
      });
    }
    return res.status(200).json({ sideTaskId, backTaskId, mimeType });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
