// POST /api/generate-side-back
// Body: { lockedCharacterBlock: string, frontImageUrl: string }
// Returns: { sideTaskId, backTaskId } — poll via /api/poll-task with
// model 'nano-banana-pro-flash'.
//
// Nano Banana Pro Flash's reference_images field takes a plain URL, not
// base64 — simpler and more reliable than Mystic's structure/style
// reference split. Each reference image carries a `text` field describing
// its purpose, used here to make clear this is an identity/style anchor,
// not a pose to copy exactly, since the whole point is a new camera angle.

const { buildPosePrompt } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const NANO_BANANA_ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro-flash';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock, frontImageUrl } = req.body || {};
  if (!lockedCharacterBlock || !frontImageUrl) {
    return res.status(400).json({ error: 'lockedCharacterBlock and frontImageUrl required' });
  }

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
        mime_type: 'image/png'
      }]
    })
  }).then((r) => r.json());

  try {
    const [sideRes, backRes] = await Promise.all([submit('side'), submit('back')]);
    const sideTaskId = sideRes?.data?.task_id;
    const backTaskId = backRes?.data?.task_id;

    if (!sideTaskId || !backTaskId) {
      return res.status(502).json({ error: 'Missing task_id', sideRes, backRes });
    }
    return res.status(200).json({ sideTaskId, backTaskId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
