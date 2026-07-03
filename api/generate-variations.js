// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { taskIds: string[] } — 10 Magnific/Seedream task ids, not done yet.
// Poll them via /api/poll-task.
//
// Uses Magnific's Seedream (Legacy) endpoint — fully confirmed and
// documented at docs.magnific.com/api-reference/text-to-image/seedream.
// Newer Seedream 4/4.5 endpoints exist in Magnific's catalog but their
// exact path wasn't confirmed; swap MYSTIC_ENDPOINT below once known.

const { buildAllVariationPrompts } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const SEEDREAM_ENDPOINT = 'https://api.magnific.com/v1/ai/text-to-image/seedream';

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
        fetch(SEEDREAM_ENDPOINT, {
          method: 'POST',
          headers: {
            'x-magnific-api-key': MAGNIFIC_API_KEY,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            prompt,
            aspect_ratio: 'traditional_3_4',
            guidance_scale: 7 // stronger prompt adherence than the 2.5 default, mascot briefs are specific
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

    return res.status(200).json({ taskIds, model: 'seedream', failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
