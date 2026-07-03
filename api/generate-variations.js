// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { taskIds: string[] } — 10 Magnific task ids, not yet complete.
// Poll them via /api/poll-mystic.
//
// Built directly against Magnific's confirmed OpenAPI spec
// (docs.magnific.com/api-reference/mystic/post-mystic). No SDK, no guessing.

const { buildAllVariationPrompts } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const MYSTIC_ENDPOINT = 'https://api.magnific.com/v1/ai/mystic';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const form = req.body || {};
  if (!form.company || !form.contact || !form.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const prompts = buildAllVariationPrompts(form);

  try {
    const results = await Promise.allSettled(
      prompts.map((prompt) =>
        fetch(MYSTIC_ENDPOINT, {
          method: 'POST',
          headers: {
            'x-magnific-api-key': MAGNIFIC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            model: 'flexible', // Mystic's own docs: best for illustration, not the 'realism' default
            resolution: '1k',
            aspect_ratio: 'traditional_3_4'
          })
        }).then((r) => r.json())
      )
    );

    const taskIds = results
      .filter((r) => r.status === 'fulfilled')
      .map((r) => r.value?.data?.task_id)
      .filter(Boolean);

    const failed = results.filter((r) => r.status === 'rejected' || !r.value?.data?.task_id);
    if (taskIds.length === 0) {
      const sample = failed[0]?.reason || failed[0]?.value;
      return res.status(502).json({
        error: 'All 10 variation submissions failed',
        failedCount: failed.length,
        sampleError: sample?.message || JSON.stringify(sample)
      });
    }

    return res.status(200).json({ taskIds, failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
