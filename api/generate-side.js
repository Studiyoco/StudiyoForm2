// POST /api/generate-side
// Body: { lockedCharacterBlock: string, frontImage: { data, mimeType } }
// Returns: { side: { data, mimeType } } -- synchronous, base64 inline.
//
// Front's base64 data is passed straight through as the reference image,
// no fetch, no mime-type detection needed -- Gemini already told us the
// real mimeType when it generated the front pose, carried through as-is.
// Back pose still dropped per the earlier cost-cutting decision; restoring
// it is one more generateImage() call with pose='back', same shape as this.

const { buildPosePrompt } = require('./_prompt');
const { generateImage } = require('./_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock, frontImage } = req.body || {};
  if (!lockedCharacterBlock || !frontImage?.data) {
    return res.status(400).json({ error: 'lockedCharacterBlock and frontImage {data, mimeType} required' });
  }

  try {
    const side = await generateImage(
      buildPosePrompt(lockedCharacterBlock, 'side') + '\n\nPortrait 3:4 aspect ratio.',
      frontImage,
      '3:4'
    );
    return res.status(200).json({ side });
  } catch (err) {
    return res.status(err.status || 500).json({ error: err.message, body: err.body });
  }
};
