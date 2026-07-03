// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { images: [{ data, mimeType }], briefAnalysis: string }
//
// Real analysis, not templating: Claude reads the brief and writes the 4
// prompts itself (see _brief.js), then each one gets generated via Gemini.
// briefAnalysis is returned so it's visible what reasoning actually
// produced these prompts, not just the prompts themselves.

const { analyzeAndBuildPrompts } = require('./_brief');
const { generateImage, fetchStyleReference } = require('./_gemini');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: 'GOOGLE_API_KEY not set on the server' });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: 'ANTHROPIC_API_KEY not set on the server' });
  }

  const form = req.body || {};
  if (!form.company || !form.contact || !form.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    const { briefAnalysis, prompts } = await analyzeAndBuildPrompts(form);
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

    return res.status(200).json({ images, briefAnalysis, failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
