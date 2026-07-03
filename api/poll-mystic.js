// POST /api/poll-mystic
// Body: { taskIds: string[] }
// Returns: { done: boolean, results: { id, status, url }[] }
//
// Confirmed against docs.magnific.com/api-reference/mystic/get-mystic-task:
// status is one of CREATED, IN_PROGRESS, COMPLETED, FAILED.
// On COMPLETED, data.generated is an array of image URLs.

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const MYSTIC_ENDPOINT = 'https://api.magnific.com/v1/ai/mystic';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const { taskIds } = req.body || {};
  if (!Array.isArray(taskIds) || taskIds.length === 0) {
    return res.status(400).json({ error: 'taskIds array required' });
  }

  try {
    const results = await Promise.all(taskIds.map((id) =>
      fetch(`${MYSTIC_ENDPOINT}/${id}`, {
        headers: { 'x-magnific-api-key': MAGNIFIC_API_KEY }
      })
        .then((r) => r.json())
        .then((j) => ({
          id,
          status: j.data?.status || 'unknown',
          url: j.data?.status === 'COMPLETED' ? (j.data?.generated || [])[0] : null
        }))
        .catch(() => ({ id, status: 'FAILED', url: null }))
    ));

    const done = results.every((r) => r.status === 'COMPLETED' || r.status === 'FAILED');
    return res.status(200).json({ done, results });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
