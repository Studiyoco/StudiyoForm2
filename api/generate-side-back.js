// POST /api/generate-side-back
// Body: { lockedCharacterBlock: string, frontImageUrl: string }
// Returns: { sideTaskId, backTaskId } — poll via /api/poll-mystic.
//
// Mystic's structure_reference and style_reference fields require base64
// image data, not URLs (confirmed in the OpenAPI spec: format: byte). The
// front pose comes back from Magnific as a URL, so it's fetched and
// re-encoded here before use.
//
// Using style_reference rather than structure_reference: structure_reference
// locks geometry/composition from the reference, which actively fights a
// request for a different camera angle. style_reference carries aesthetic
// and identity without locking pose. This is a judgment call, moderate
// confidence, not a documented guarantee — Mystic's reference system isn't
// explicitly built for "same character, different angle." Watch the actual
// output closely on the first real test.

const { buildPosePrompt } = require('./_prompt');

const MAGNIFIC_API_KEY = process.env.MAGNIFIC_API_KEY;
const MYSTIC_ENDPOINT = 'https://api.magnific.com/v1/ai/mystic';

async function urlToBase64(url) {
  const r = await fetch(url);
  const buf = Buffer.from(await r.arrayBuffer());
  return buf.toString('base64');
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!MAGNIFIC_API_KEY) {
    return res.status(500).json({ error: 'MAGNIFIC_API_KEY not set on the server' });
  }

  const { lockedCharacterBlock, frontImageUrl } = req.body || {};
  if (!lockedCharacterBlock || !frontImageUrl) {
    return res.status(400).json({ error: 'lockedCharacterBlock and frontImageUrl required' });
  }

  try {
    const styleReferenceB64 = await urlToBase64(frontImageUrl);

    const submit = (pose) => fetch(MYSTIC_ENDPOINT, {
      method: 'POST',
      headers: {
        'x-magnific-api-key': MAGNIFIC_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: buildPosePrompt(lockedCharacterBlock, pose),
        model: 'flexible',
        resolution: '2k',
        aspect_ratio: 'traditional_3_4',
        style_reference: styleReferenceB64,
        adherence: 65 // lean toward prompt (the new angle) over pure style copy
      })
    }).then((r) => r.json());

    const [sideRes, backRes] = await Promise.all([submit('side'), submit('back')]);
    const sideTaskId = sideRes?.data?.task_id;
    const backTaskId = backRes?.data?.task_id;

    if (!sideTaskId || !backTaskId) {
      return res.status(502).json({ error: 'Missing task_id', sideRes, backRes });
    }
    return res.status(200).json({ sideTaskId, backTaskId });
  } catch (err) {
    return res.status(500).json({ error: String(err) });
  }
};
