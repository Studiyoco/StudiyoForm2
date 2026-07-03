// POST /api/generate-side-back
// Body: { lockedCharacterBlock: string, frontImageUrl: string }
// Returns: { sideUrl: string, backUrl: string }
//
// ⚠ UNVERIFIED FIELD: the key used to pass a reference image into
// nano_banana_pro through the direct SDK/REST path is a guess. Through
// MCP this was `medias: [{ role: 'image', value: <id> }]`, but the direct
// API's `input` object may use a different key entirely — `image_url`,
// `reference_image`, `init_image` are all plausible depending on how
// Higgsfield structured this model's schema outside MCP. Before trusting
// this in production: run one test call, inspect whether the output
// actually resembles the front pose, and check the model's schema in the
// cloud.higgsfield.ai dashboard (click into nano_banana_pro's detail page,
// it should list accepted input fields). If it's wrong, the side/back
// poses will come back as unrelated characters instead of the same one —
// that failure mode is visually obvious, so it won't ship silently broken.

const { higgsfield, config } = require('@higgsfield/client/v2');
const { buildPosePrompt } = require('./_prompt');

config({
  apiKey: process.env.HIGGSFIELD_API_KEY,
  apiSecret: process.env.HIGGSFIELD_API_SECRET
});

const MODEL = 'nano_banana_2'; // see generate-variations.js for why

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.HIGGSFIELD_API_KEY || !process.env.HIGGSFIELD_API_SECRET) {
    return res.status(500).json({ error: 'Higgsfield credentials not set on the server' });
  }

  const { lockedCharacterBlock, frontImageUrl } = req.body || {};
  if (!lockedCharacterBlock || !frontImageUrl) {
    return res.status(400).json({ error: 'lockedCharacterBlock and frontImageUrl required' });
  }

  const submit = (pose) => higgsfield.subscribe(MODEL, {
    input: {
      prompt: buildPosePrompt(lockedCharacterBlock, pose),
      aspect_ratio: '3:4',
      image_url: frontImageUrl // TODO verify this is the correct field name, see note above
    }
  });

  try {
    const [sideJobSet, backJobSet] = await Promise.all([submit('side'), submit('back')]);
    const sideUrl = sideJobSet?.jobs?.[0]?.results?.raw?.url;
    const backUrl = backJobSet?.jobs?.[0]?.results?.raw?.url;
    if (!sideUrl || !backUrl) {
      return res.status(502).json({ error: 'Missing image in response', sideJobSet, backJobSet });
    }
    return res.status(200).json({ sideUrl, backUrl });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
