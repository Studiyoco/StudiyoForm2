// POST /api/generate-poses
// Body: { lockedCharacterBlock, style, submissionId }
// Returns: { front: { data, mimeType } }
//
// After generation: uploads the front image to Firebase Storage and
// writes the permanent URL + final status 'complete' to Firestore.

const { buildPosePrompt } = require('./_prompt');
const { generateImage, fetchStyleReference } = require('./_gemini');
const { updateSubmission, uploadImage } = require('./_firebase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { lockedCharacterBlock, style, submissionId } = req.body || {};
  if (!lockedCharacterBlock) {
    return res.status(400).json({ error: 'lockedCharacterBlock required' });
  }

  try {
    const styleRef = await fetchStyleReference(req.headers.host, style);
    const front = await generateImage(
      buildPosePrompt(lockedCharacterBlock, 'front') + '\n\nSquare 1:1 aspect ratio.',
      styleRef ? [styleRef] : [],
      '1:1'
    );

    // Upload to Firebase Storage and store the permanent URL
    const frontImageUrl = await uploadImage(
      front.data,
      front.mimeType,
      submissionId,
      'front'
    );

    await updateSubmission(submissionId, {
      frontImageUrl,
      status: 'complete'
    });

    return res.status(200).json({ front });
  } catch (err) {
    await updateSubmission(submissionId, {
      status: 'failed',
      errorMessage: err.message || String(err)
    });
    return res.status(err.status || 500).json({ error: err.message, body: err.body });
  }
};
