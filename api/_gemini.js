// Shared helper for calling Google's Gemini API directly (generateContent),
// used by all three generation stages. Built against Google's own
// documented REST pattern, not inferred from third-party aggregators the
// way today's earlier Magnific integration had to be.
//
// MODEL NAME: 'gemini-3-pro-image-preview' -- moderate-high confidence,
// consistent across multiple recent sources describing Nano Banana Pro's
// Gemini API identifier, but it's a preview name and Google can change
// these. Verify against the model picker in Google AI Studio once the key
// is live; if this string is wrong, the failure is a clean 404, same
// pattern as every wrong-model-name failure today, not a mystery.
//
// AUTH: x-goog-api-key header -- this is Google's standard documented
// pattern for generativelanguage.googleapis.com, high confidence.
//
// ASPECT RATIO: Gemini's generateContent may or may not accept a
// dedicated imageConfig.aspectRatio field depending on model version --
// low-moderate confidence on that exact field name. Included as a
// best-effort attempt, but the prompt text ALSO states the aspect ratio
// explicitly as a fallback that works regardless, since prompt-based
// framing is always honored even if the structured field is ignored or
// rejected.

const GOOGLE_API_KEY = process.env.GOOGLE_API_KEY;
const MODEL = 'gemini-3-pro-image-preview';
const ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:generateContent`;

// referenceImage: optional { data: base64string, mimeType: string }
async function generateImage(prompt, referenceImage, aspectRatio) {
  const parts = [{ text: prompt }];
  if (referenceImage) {
    parts.push({ inlineData: { mimeType: referenceImage.mimeType, data: referenceImage.data } });
  }

  const body = {
    contents: [{ parts }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      imageConfig: aspectRatio ? { aspectRatio } : undefined
    }
  };

  // 40s per-request cap, under the function limits (45-60s), so a genuine
  // hang fails with a clear, attributable error instead of taking the
  // whole function down silently. Raised from an initial 35s after a real
  // front-pose call hit that boundary exactly -- variations succeeded
  // within it, so this is headroom for single-call variance, not a
  // structural fix for a suspected bug.
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 40000);

  let res;
  try {
    res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'x-goog-api-key': GOOGLE_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });
  } catch (e) {
    if (e.name === 'AbortError') {
      const err = new Error('Gemini request timed out after 40s');
      err.status = 504;
      throw err;
    }
    throw e;
  } finally {
    clearTimeout(timeout);
  }

  const text = await res.text();
  let json = null;
  try { json = JSON.parse(text); } catch (e) { /* not JSON */ }

  if (!res.ok) {
    const err = new Error(`Gemini API error ${res.status}`);
    err.status = res.status;
    err.body = json || text.slice(0, 500);
    throw err;
  }

  const imagePart = json?.candidates?.[0]?.content?.parts?.find((p) => p.inlineData);
  if (!imagePart) {
    const err = new Error('No image in Gemini response');
    err.status = 502;
    err.body = json;
    throw err;
  }

  return {
    data: imagePart.inlineData.data,       // base64 string
    mimeType: imagePart.inlineData.mimeType // e.g. 'image/png'
  };
}

module.exports = { generateImage, MODEL };
