// POST /api/generate-side
// Body: { lockedCharacterBlock: string, frontImage: { data, mimeType }, style: string }
// Returns: { side: { data, mimeType } } -- synchronous, base64 inline.
//
// Sends TWO reference images together: the approved front pose (identity
// anchor) and the style-technique sphere (rendering anchor). Back pose
// still dropped per the earlier cost-cutting decision.

const { buildPosePrompt } = require('./_prompt');
const { generateImage, fetchStyleReference } = require('./_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock, frontImage, style } = req.body || {};
  if (!lockedCharacterBlock || !frontImage?.data) {
    return res.status(400).json({ error: 'lockedCharacterBlock and frontImage {data, mimeType} required' });
  }

  try {
    const styleRef = await fetchStyleReference(req.headers.host, style);
    const refs = [frontImage, ...(styleRef ? [styleRef] : [])];

    const side = await generateImage(
      buildPosePrompt(lockedCharacterBlock, 'side') + '\n\nPortrait 3:4 aspect ratio.',
      refs,
      '3:4'
    );
    return res.status(200).json({ side });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, body: err.body });
  }
};
