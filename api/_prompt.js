// Shared prompt construction. Server-side only so the prompt logic
// (and therefore your Higgsfield spend) can't be edited from devtools.

const KIND_MAP = {
  'Blob': 'a soft rounded blob mascot with a simple ownable silhouette',
  'Animal': 'an original animal mascot with a simple ownable silhouette',
  'Food or object': 'a mascot based on a food item or everyday object, anthropomorphized with a friendly face',
  'Robot': 'a friendly rounded robot mascot',
  'Surprise us': 'an original, instantly likable mascot with a simple ownable silhouette'
};

const STYLE_MAP = {
  '2D flat & minimal': 'flat vector illustration, clean bezier curves, solid color fills, minimal detail, no gradients, no outlines',
  'Soft 3D + 2D': 'hybrid style, flat vector shapes with soft linear gradient shading for gentle dimensionality, no full 3D render, no cast shadows, no textures',
  '3D': 'soft 3D render, matte clay-like material, soft studio lighting, rounded plush forms, no photorealism, no glossy plastic',
  'Oil pastel': 'oil pastel illustration texture, visible waxy strokes, warm hand-painted feel, soft edges, painterly but still a clean readable character silhouette',
  'Not sure yet': 'flat vector illustration, clean curves, solid fills, minimal detail'
};

function pick(map, val, fallbackKey) {
  return map[val] || map[fallbackKey];
}

// One variation prompt. `seedHint` nudges the model toward a different
// take each time since Nano Banana / Higgsfield models don't expose a
// literal seed parameter through the MCP-equivalent REST surface.
function buildVariationPrompt(form, seedHint) {
  const kind = (form.kind && form.kind[0]) || 'Surprise us';
  const style = form.style || 'Not sure yet';
  const vibe = (form.vibe && form.vibe.length) ? form.vibe.join(' and ').toLowerCase() : 'friendly';
  const ctx = form.company && form.product
    ? ` for ${form.company}, ${String(form.product).replace(/\.+$/, '')}`
    : (form.company ? ` for ${form.company}` : '');

  return `Mascot concept${ctx}. Design ${pick(KIND_MAP, kind, 'Surprise us')}. `
    + `Personality: ${vibe}. Variation angle: ${seedHint}. `
    + `Style: ${pick(STYLE_MAP, style, 'Not sure yet')}. `
    + `Full body front view, standing centered, facing the viewer, default friendly expression. `
    + `Flat solid pure white background, always, regardless of style. Soft even lighting, `
    + `character fills 70% of frame height. Single character only, no text, no logo, no watermark. `
    + `Aspect ratio 3:4.\n\nAvoid: extra limbs, duplicate character, text, background objects, `
    + `gradient background, cropped body, existing copyrighted mascots.`;
}

// Ten distinct angles so the batch isn't ten near-duplicates of one prompt.
const VARIATION_ANGLES = [
  'a straightforward, on-brief read of the character',
  'an unexpected lateral twist on the form',
  'a bold, ownable single distinguishing feature',
  'the most surprising, screenshot-worthy version'
];

function buildAllVariationPrompts(form) {
  return VARIATION_ANGLES.map((angle) => buildVariationPrompt(form, angle));
}

// Locked character block prompt fragment, built from the winner's own
// description once Claude has picked it (see pick-winner.js).
function buildPosePrompt(lockedBlock, pose) {
  const base = `${lockedBlock}\n\nUsing the attached character as exact reference, keep every `
    + `design detail identical: colors, proportions, features, style.`;

  if (pose === 'front') {
    return `${lockedBlock}\n\nFull body front view, standing centered, facing the viewer directly, `
      + `default expression, arms/appendages relaxed at rest. Plain solid white background, soft `
      + `even lighting, character fills 70% of frame height. No text, no logo, no watermark, single `
      + `character only. Aspect ratio 3:4.\n\nAvoid: extra limbs, duplicate character, text, `
      + `background objects, gradient background, cropped body.`;
  }
  if (pose === 'side') {
    return `${base}\n\nSame character, full body, strict profile view facing left, default `
      + `expression, same rest pose. Plain solid white background, identical lighting and framing `
      + `to the reference. No text, no watermark, single character only. Aspect ratio 3:4.\n\n`
      + `Avoid: redesigned features, changed colors, 3/4 angle instead of profile, text.`;
  }
  // back
  return `${base}\n\nSame character, full body, seen directly from behind, same rest pose. Show `
    + `how the back of the head and body resolve; invent nothing that contradicts the front view. `
    + `Plain solid white background, identical lighting and framing. No text, no watermark, single `
    + `character only. Aspect ratio 3:4.\n\nAvoid: face visible, redesigned silhouette, changed `
    + `colors, text.`;
}

module.exports = { buildAllVariationPrompts, buildPosePrompt, KIND_MAP, STYLE_MAP, safeParseResponse };

// Reads a fetch Response as text first, then attempts JSON.parse. Gateway-
// level errors (502/504/etc) are very often HTML or plain text, not JSON —
// calling .json() directly on those throws and masks the real error behind
// a generic parse failure. This always returns something inspectable.
async function safeParseResponse(response) {
  const text = await response.text();
  let parsed = null;
  try { parsed = JSON.parse(text); } catch (e) { /* not JSON, that's fine */ }
  return {
    ok: response.ok,
    status: response.status,
    json: parsed,
    text: parsed ? null : text.slice(0, 500) // cap raw text, gateway error pages can be huge
  };
}
// deploy-verification bump 2026-07-03T12:01:27Z
