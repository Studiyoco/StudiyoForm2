// POST /api/generate-poses
// Body: { lockedCharacterBlock: string }
// Returns: { front: { data, mimeType } } -- synchronous, base64 inline.

const { buildPosePrompt } = require('./_prompt');
const { generateImage } = require('./_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock } = req.body || {};
  if (!lockedCharacterBlock) {
    return res.status(400).json({ error: 'lockedCharacterBlock required' });
  }

  try {
    const front = await generateImage(
      buildPosePrompt(lockedCharacterBlock, 'front') + '\n\nPortrait 3:4 aspect ratio.',
      null,
      '3:4'
    );
    return res.status(200).json({ front });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, body: err.body });
  }
};
