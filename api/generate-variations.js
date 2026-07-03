// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { images: [{ data, mimeType }] } -- 4 base64-encoded images,
// generated synchronously in this single request. No task_id, no polling:
// Gemini's generateContent returns the image inline in the response.

const { buildAllVariationPrompts } = require('./_prompt');
const { generateImage, fetchStyleReference } = require('./_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not set on the server' });
  }

  const form = req.body || {};
  if (!form.company || !form.contact || !form.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompts = buildAllVariationPrompts(form).map(
    (p) => `${p}\n\nSquare 1:1 aspect ratio.`
  );

  try {
    const styleRef = await fetchStyleReference(req.headers.host, form.style);
    const refs = styleRef ? [styleRef] : [];

    const results = await Promise.allSettled(
      prompts.map((prompt) => generateImage(prompt, refs, '1:1'))
    );

    const images = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value);

    const failed = results.filter((r) => r.status === 'rejected');
    if (images.length === 0) {
      const sample = failed[0]?.reason;
      return res.status(502).json({
        error: 'All variation generations failed',
        failedCount: failed.length,
        sampleStatus: sample?.status,
        sampleError: sample?.body || sample?.message || String(sample)
      });
    }

    return res.status(200).json({ images, failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
