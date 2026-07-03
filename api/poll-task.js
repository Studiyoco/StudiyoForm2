// POST /api/poll-task
// Body: { tasks: [{ id: string, model: 'seedream' | 'nano-banana-pro-flash' }] }
// Returns: { done: boolean, results: { id, status, url }[] }
//
// Each Magnific product has its own status path (/v1/ai/{product}/{task-id}),
// so the model name travels with each task id rather than assuming one
// shared endpoint the way Mystic's single-product version could.

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;

const ENDPOINTS = {
  'seedream': 'https://api.magnific.com/v1/ai/text-to-image/seedream',
  'nano-banana-pro-flash': 'https://api.magnific.com/v1/ai/text-to-image/nano-banana-pro-flash'
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
    const results = await Promise.all(tasks.map(({ id, model }) => {
      const base = ENDPOINTS[model];
      if (!base) return Promise.resolve({ id, status: 'FAILED', url: null });
      return fetch(`${base}/${id}`, {
        headers: { 'x-magnific-api-key': MAGNIFIC_API_KEY }
      })
        .then((r) => r.json())
        .then((j) => ({
          id,
          status: j.data?.status || 'unknown',
          url: j.data?.status === 'COMPLETED' ? (j.data?.generated || [])[0] : null
        }))
        .catch(() => ({ id, status: 'FAILED', url: null }));
    }));

    const done = results.every((r) => r.status === 'COMPLETED' || r.status === 'FAILED');
    return res.status(200).json({ done, results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
