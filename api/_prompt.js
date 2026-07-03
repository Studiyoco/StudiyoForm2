// Shared prompt construction. Server-side only so the prompt logic
// (and therefore your generation spend) can't be edited from devtools.
//
// Variation prompts are NOT built here anymore -- that used to be pure
// template-filling (form fields looked up in fixed maps, concatenated),
// which meant zero actual reasoning happened before a prompt got written.
// Real analysis now lives in _brief.js: Claude reads the brief and writes
// the 4 variation prompts itself, using these same style/avoid constants
// as fixed requirements it must incorporate, not creative choices it's
// free to drop.
//
// Pose prompts (front/side/back) stay templated here, deliberately, not
// as leftover shortcuts. By the time a pose prompt gets built, the
// creative decision is already made twice over: once by Claude's brief
// analysis, once by Claude's winner selection in pick-winner.js. There's
// no judgment left to apply, only a mechanical camera-angle change on an
// already-locked character. Templating that is correct, not a regression.

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

// Locked character block prompt fragment, built from the winner's own
// description once Claude has picked it (see pick-winner.js).
function buildPosePrompt(lockedBlock, pose) {
  const base = `${lockedBlock}\n\nUsing the attached character as exact reference, keep every `
    + `design detail identical: colors, proportions, features, style.`;
  const shading = `No outline, no black linework around shapes, colors meet directly. Real `
    + `dimensional shading, highlights and shadow shapes must be visible, never a flat `
    + `solid-color silhouette.`;

  if (pose === 'front') {
    return `${lockedBlock}\n\n${shading} `
      + `Full body front view, standing centered, facing the viewer directly, `
      + `default expression, arms/appendages relaxed at rest. Plain solid white background, soft `
      + `even lighting, character fills 70% of frame height. No text, no logo, no watermark, single `
      + `character only. Aspect ratio 3:4.\n\nAvoid: ${AVOID_BASE}.`;
  }
  if (pose === 'side') {
    return `${base}\n\n${shading} `
      + `Same character, full body, strict profile view facing left, default `
      + `expression, same rest pose. Plain solid white background, identical lighting and framing `
      + `to the reference. No text, no watermark, single character only. Aspect ratio 3:4.\n\n`
      + `Avoid: ${AVOID_BASE}, redesigned features, changed colors, 3/4 angle instead of profile.`;
  }
  // back
  return `${base}\n\n${shading} `
    + `Same character, full body, seen directly from behind, same rest pose. Show `
    + `how the back of the head and body resolve; invent nothing that contradicts the front view. `
    + `Plain solid white background, identical lighting and framing. No text, no watermark, single `
    + `character only. Aspect ratio 3:4.\n\nAvoid: ${AVOID_BASE}, face visible, redesigned `
    + `silhouette, changed colors.`;
}

module.exports = { buildPosePrompt, STYLE_MAP, STYLE_IMAGE_MAP, AVOID_BASE };
