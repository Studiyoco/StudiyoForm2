// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { taskIds: string[] } — 4 Nano Banana Pro task ids, not done yet.
// Poll them via /api/poll-task.
//
// Nano Banana Pro is the sole model across this entire pipeline, by
// explicit instruction, no other model to be introduced without a
// direct decision to change it. 4 variations (not 10), square 1:1
// aspect ratio, cheapest reasonable resolution -- see VARIATION_ANGLES
// in _prompt.js for the prompt-angle spread across those 4.

const { buildAllVariationPrompts, safeParseResponse } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const NANO_BANANA_ENDPOINT = 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro';

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
        fetch(NANO_BANANA_ENDPOINT, {
          method: 'POST',
          headers: {
            'x-magnific-api-key': MAGNIFIC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            aspect_ratio: '1:1',
            resolution: '1K'
          })
        }).then(safeParseResponse)
      )
    );

    const taskIds = results
      .filter((r) => r.status === 'fulfilled' && r.value.json?.data?.task_id)
      .map((r) => r.value.json.data.task_id);

    const failed = results.filter((r) => r.status === 'rejected' || !r.value?.json?.data?.task_id);
    if (taskIds.length === 0) {
      const sample = failed[0]?.value || failed[0]?.reason;
      return res.status(502).json({
        error: 'All variation submissions failed',
        failedCount: failed.length,
        sampleStatus: sample?.status,
        sampleError: sample?.json || sample?.text || String(sample)
      });
    }

    return res.status(200).json({ taskIds, model: 'nano-banana-pro', failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
