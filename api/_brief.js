// Real analysis, not templating. Claude reads the full brief -- company,
// product, kind, vibe, style, usage, notes -- reasons about who this is
// for and what job the mascot needs to do, then WRITES 4 tailored image
// prompts itself. The technical constraints below (background, aspect
// ratio, no-outline rule, dimensional shading, the chosen style's
// rendering language, the avoid list) are handed to Claude as fixed
// requirements it must incorporate into every prompt, not creative
// choices it's free to drop. Judgment applies to the character concept
// and the four creative angles; the technical guardrails don't move.
//
// This adds one real Claude API call before generation starts, on top of
// the existing pick-winner vision call later in the pipeline. Real cost,
// real latency, stated plainly, not hidden: a few seconds and a small
// text-only API charge, in exchange for prompts that are actually
// informed by the brief instead of mechanically assembled from it.

const { STYLE_MAP, AVOID_BASE } = require('./_prompt');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-5';

async function analyzeAndBuildPrompts(form) {
  const styleText = STYLE_MAP[form.style] || STYLE_MAP['Not sure yet'];

  const instruction = `You are Studiyo's character strategy director. Read this brief and think `
    + `about it before writing anything -- who uses this product, what feeling gap a mascot fills, `
    + `what visual territory competitors in this space probably already occupy.\n\n`
    + `Brief:\n`
    + `Company: ${form.company || 'n/a'}\n`
    + `Product: ${form.product || 'n/a'}\n`
    + `Mascot shape feel: ${(form.kind || []).join(', ') || 'Surprise us'}\n`
    + `Vibe: ${(form.vibe || []).join(', ') || 'friendly'}\n`
    + `Where it mostly lives: ${(form.usage || []).join(', ') || 'n/a'}\n`
    + `Notes: ${form.notes || 'none'}\n\n`
    + `Write exactly 4 distinct image generation prompts for 4 different creative directions: `
    + `one straightforward on-brief read, one lateral unexpected twist, one bold ownable `
    + `distinguishing feature, one wildcard screenshot-worthy version. Each prompt must be a `
    + `complete, ready-to-use string that a text-to-image model can run directly, and each MUST `
    + `incorporate every one of these fixed technical requirements verbatim in spirit, not just `
    + `paraphrased away:\n\n`
    + `- Style rendering: ${styleText}\n`
    + `- No outline, no black linework around shapes, colors meet directly\n`
    + `- Real dimensional shading, highlights and shadow shapes must be visible, never a flat `
    + `solid-color silhouette, but not heavy shadows or sharp specular highlights either\n`
    + `- Full body, standing centered, facing the viewer, default friendly expression\n`
    + `- Flat solid pure white background, character fills 70% of frame height\n`
    + `- Single character only, no text, no logo, no watermark, square 1:1 aspect ratio\n`
    + `- Avoid: ${AVOID_BASE}\n\n`
    + `Respond ONLY with JSON, no markdown fences, no preamble:\n`
    + `{"briefAnalysis": "<2-3 sentences on the emotional job and the strategic opening>", `
    + `"prompts": ["<prompt 1>", "<prompt 2>", "<prompt 3>", "<prompt 4>"]}`;

  const resp = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': ANTHROPIC_API_KEY,
      'anthropic-version': '2023-06-01'
    },
    body: JSON.stringify({
      model: ANTHROPIC_MODEL,
      max_tokens: 1200,
      messages: [{ role: 'user', content: instruction }]
    })
  });

  const data = await resp.json();
  const text = (data.content || []).map((c) => c.text || '').join('').trim();
  const clean = text.replace(/```json|```/g, '').trim();
  const parsed = JSON.parse(clean);

  if (!Array.isArray(parsed.prompts) || parsed.prompts.length === 0) {
    throw new Error('Brief analysis returned no prompts');
  }
  return parsed;
}

module.exports = { analyzeAndBuildPrompts };
