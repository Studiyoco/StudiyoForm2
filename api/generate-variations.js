// POST /api/generate-variations
// Body: the form payload from index.html (company, kind, vibe, style, ...)
// Returns: { taskIds: string[] } — 10 Magnific/Mystic task ids, not done yet.
// Poll them via /api/poll-task.
//
// Uses Mystic — Magnific's own quickstart example endpoint, confirmed
// stable after the Legacy Seedream path returned real 404s.
// Response parsing goes through safeParseResponse so a gateway-level
// error (HTML/plain text, not JSON) never gets silently swallowed.

const { buildAllVariationPrompts, safeParseResponse } = require('./_prompt');

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
            model: 'flexible',
            resolution: '1k',
            aspect_ratio: 'traditional_3_4'
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
        error: 'All 10 variation submissions failed',
        failedCount: failed.length,
        sampleStatus: sample?.status,
        sampleError: sample?.json || sample?.text || String(sample)
      });
    }

    return res.status(200).json({ taskIds, model: 'mystic', failed: failed.length });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
