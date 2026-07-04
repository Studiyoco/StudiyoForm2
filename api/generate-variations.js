// POST /api/generate-variations
// Body: the form payload from index.html
// Returns: { images, briefAnalysis, submissionId }
//
// Two Firestore writes here:
// 1. Immediately on request -- contact info + chip choices, status 'submitted'
//    so a lead is never fully lost even if generation fails downstream.
// 2. After brief analysis -- briefAnalysis + generated prompts, status 'analyzing'

const { analyzeAndBuildPrompts } = require('./_brief');
const { generateImage, fetchStyleReference } = require('./_gemini');
const { createSubmission, updateSubmission } = require('./_firebase');

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!process.env.GOOGLE_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const form = req.body || {};
  if (!form.company || !form.contact || !form.email) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Write 1: capture the lead immediately before any generation starts
  const submissionId = await createSubmission(form).catch(() => null);

  try {
    const { briefAnalysis, prompts } = await analyzeAndBuildPrompts(form);

    // Write 2: record what the brief analysis produced
    await updateSubmission(submissionId, {
      briefAnalysis,
      prompts,
      status: 'analyzing'
    });

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
      await updateSubmission(submissionId, {
        status: 'failed',
        errorMessage: sample?.message || String(sample)
      });
      return res.status(502).json({
        error: 'All variation generations failed',
        failedCount: failed.length,
        sampleStatus: sample?.status,
        sampleError: sample?.body || sample?.message || String(sample)
      });
    }

    return res.status(200).json({ images, briefAnalysis, submissionId, failed: failed.length });
  } catch (err) {
    await updateSubmission(submissionId, {
      status: 'failed',
      errorMessage: err.message || String(err)
    });
    return res.status(err.status || 500).json({ error: err.message || String(err), body: err.body });
  }
};
