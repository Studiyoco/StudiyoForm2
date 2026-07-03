// POST /api/poll-task
// Body: { tasks: [{ id: string, model: 'nano-banana-pro-flash' }] }
// Returns: { done: boolean, results: { id, status, url, error? }[] }

const { safeParseResponse } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;

const ENDPOINTS = {
  'nano-banana-pro-flash': 'https://api.freepik.com/v1/ai/text-to-image/nano-banana-pro-flash'
};

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const { tasks } = req.body || {};
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return res.status(400).json({ error: 'tasks array required, each {id, model}' });
  }

  try {
    const results = await Promise.all(tasks.map(async ({ id, model }) => {
      const base = ENDPOINTS[model];
      if (!base) return { id, status: 'FAILED', url: null, error: `Unknown model: ${model}` };
      try {
        const r = await fetch(`${base}/${id}`, {
          headers: { 'x-magnific-api-key': MAGNIFIC_API_KEY }
        }).then(safeParseResponse);
        const status = r.json?.data?.status || 'unknown';
        return {
          id,
          status,
          url: status === 'COMPLETED' ? (r.json?.data?.generated || [])[0] : null,
          error: status === 'unknown' ? (r.json || r.text) : undefined
        };
      } catch (e) {
        return { id, status: 'FAILED', url: null, error: String(e) };
      }
    }));

    const done = results.every((r) => r.status === 'COMPLETED' || r.status === 'FAILED');
    return res.status(200).json({ done, results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
