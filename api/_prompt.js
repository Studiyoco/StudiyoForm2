// Shared prompt construction. Server-side only so the prompt logic
// (and therefore your generation spend) can't be edited from devtools.

const KIND_MAP = {
  'Blob': 'a soft rounded blob mascot with a simple ownable silhouette',
  'Animal': 'an original animal mascot with a simple ownable silhouette',
  'Food or object': 'a mascot based on a food item or everyday object, anthropomorphized with a friendly face',
  'Robot': 'a friendly rounded robot mascot',
  'Surprise us': 'an original, instantly likable mascot with a simple ownable silhouette'
};

const STYLE_MAP = {
  '2D flat & minimal': 'flat vector illustration, clean bezier curves, solid color fills, flat 2D highlight shapes for dimension (solid-color highlight shapes, not smooth gradient shading), minimal detail, no gradients',
  'Soft 3D + 2D': 'flat 2D shapes with linear gradient shading for gentle dimensionality, no full 3D render, no cast shadows, no textures',
  '3D': 'soft 3D render, glossy matte-plush material, smooth continuous gradient shading across '
    + 'rounded volumes, diffused soft lighting with no sharp specular hotspots, subtle gentle '
    + 'highlights only, no visible texture, no photorealism, premium toy-like plush finish',
  'Oil pastel': 'oil pastel illustration texture, visible waxy strokes, warm hand-painted feel, soft edges, painterly but still a clean readable character silhouette',
  'Not sure yet': 'flat vector illustration, clean curves, solid fills, flat 2D highlight shapes for dimension, minimal detail'
};

// Maps the same style chip values to the actual reference image files
// deployed at /styles/*.jpg (technique-study spheres, not illustrated
// characters -- deliberately isolates shading approach from character
// design). Used to attach a real visual reference to generation calls,
// not just describe the style in text.
const STYLE_IMAGE_MAP = {
  '2D flat & minimal': 'flat.jpg',
  'Soft 3D + 2D': 'soft3d2d.jpg',
  '3D': '3d.jpg',
  'Oil pastel': 'oilpastel.jpg',
  'Not sure yet': 'flat.jpg'
};

// Shared across every generation regardless of style chosen. "No outline"
// is universal per direct instruction, not a per-style choice, so it lives
// here once instead of being duplicated (and inevitably drifting) across
// every template function that builds a prompt.
const AVOID_BASE = 'extra limbs, duplicate character, text, background objects, gradient background, '
  + 'cropped body, heavy shadows, realistic materials, black outlines, outlined linework, sharp '
  + 'specular highlights, existing copyrighted mascots';

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
    + `Style: ${pick(STYLE_MAP, style, 'Not sure yet')}. No outline, no black linework around `
    + `shapes, colors meet directly. The character must show real dimensional shading, highlights `
    + `and shadow shapes appropriate to the chosen style, never a flat solid-color silhouette with `
    + `no depth cues. `
    + `Full body front view, standing centered, facing the viewer, default friendly expression. `
    + `Flat solid pure white background, always, regardless of style. Soft even lighting, `
    + `character fills 70% of frame height. Single character only, no text, no logo, no watermark. `
    + `Aspect ratio 3:4.\n\nAvoid: ${AVOID_BASE}.`;
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
    return `${lockedBlock}\n\nNo outline, no black linework around shapes, colors meet directly. Real dimensional shading, highlights and shadow shapes must be visible, never a flat solid-color silhouette. `
      + `Full body front view, standing centered, facing the viewer directly, `
      + `default expression, arms/appendages relaxed at rest. Plain solid white background, soft `
      + `even lighting, character fills 70% of frame height. No text, no logo, no watermark, single `
      + `character only. Aspect ratio 3:4.\n\nAvoid: ${AVOID_BASE}.`;
  }
  if (pose === 'side') {
    return `${base}\n\nNo outline, no black linework around shapes, colors meet directly. Real dimensional shading, highlights and shadow shapes must be visible, never a flat solid-color silhouette. `
      + `Same character, full body, strict profile view facing left, default `
      + `expression, same rest pose. Plain solid white background, identical lighting and framing `
      + `to the reference. No text, no watermark, single character only. Aspect ratio 3:4.\n\n`
      + `Avoid: ${AVOID_BASE}, redesigned features, changed colors, 3/4 angle instead of profile.`;
  }
  // back
  return `${base}\n\nNo outline, no black linework around shapes, colors meet directly. Real dimensional shading, highlights and shadow shapes must be visible, never a flat solid-color silhouette. `
    + `Same character, full body, seen directly from behind, same rest pose. Show `
    + `how the back of the head and body resolve; invent nothing that contradicts the front view. `
    + `Plain solid white background, identical lighting and framing. No text, no watermark, single `
    + `character only. Aspect ratio 3:4.\n\nAvoid: ${AVOID_BASE}, face visible, redesigned `
    + `silhouette, changed colors.`;
}

module.exports = { buildAllVariationPrompts, buildPosePrompt, KIND_MAP, STYLE_MAP, STYLE_IMAGE_MAP };
