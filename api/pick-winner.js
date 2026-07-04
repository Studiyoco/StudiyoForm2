// POST /api/pick-winner
// Body: { images, form, submissionId }
// Returns: { winnerIndex, reasoning, lockedCharacterBlock }

const { updateSubmission } = require('./_firebase');

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
const ANTHROPIC_MODEL = 'claude-sonnet-5';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' });
  if (!ANTHROPIC_API_KEY) {
    return res.status(500).json({ error: "Server configuration error" });
  }

  const { images, form, submissionId } = req.body || {};
  if (!Array.isArray(images) || images.length === 0) {
    return res.status(400).json({ error: 'images array required' });
  }

  try {
    const content = [
      {
        type: 'text',
        text: `You are Studiyo's character strategy director. Below are ${images.length} mascot `
          + `concept variations generated from this brief:\n\n`
          + `Company: ${form.company}\nProduct: ${form.product || 'n/a'}\n`
          + `Kind: ${(form.kind || []).join(', ')}\nVibe: ${(form.vibe || []).join(', ')}\n`
          + `Style: ${form.style || 'n/a'}\nUsage: ${(form.usage || []).join(', ')}\n\n`
          + `Score each on brand fit, distinctiveness, rig-ability (simple silhouette, readable `
          + `small), and emotional range. Pick the single strongest winner. Then write a locked `
          + `character description block: one paragraph under 120 words fixing species/shape, `
          + `proportions, exact colors, face style, and material, precise enough that another `
          + `image model reproduces this exact character consistently. The character must be a `
          + `solid closed form -- no holes, voids, ring shapes, or negative space cut through `
          + `the body. Do not describe any gap, tunnel, or hollow that passes through the character. `
          + `IMPORTANT: do not use double-quote characters (") anywhere inside the lockedCharacterBlock `
          + `value -- use single quotes or rephrase instead, since unescaped quotes break JSON parsing.\n\n`
          + `Respond ONLY with JSON, no markdown fences, no preamble:\n`
          + `{"winnerIndex": <0-based int>, "reasoning": "<2-3 sentences>", "lockedCharacterBlock": "<paragraph>"}`
      },
      ...images.map((img) => ({
        type: 'image',
        source: { type: 'base64', media_type: img.mimeType, data: img.data }
      }))
    ];

    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: ANTHROPIC_MODEL,
        max_tokens: 1500,
        messages: [{ role: 'user', content }]
      })
    });

    const data = await resp.json();

    if (!resp.ok || data.error) {
      throw new Error(`Anthropic API error ${resp.status}: ${data.error?.message || resp.statusText}`);
    }

    const text = (data.content || []).map((c) => c.text || '').join('').trim();
    const clean = text.replace(/```json|```/g, '').trim();
    const jsonMatch = clean.match(/\{[\s\S]*\}/);
    const jsonStr = jsonMatch ? jsonMatch[0] : clean;

    let parsed;
    try {
      parsed = JSON.parse(jsonStr);
    } catch (e) {
      // Unescaped double quotes inside the lockedCharacterBlock string are the
      // most common cause (Claude writes descriptions like '"round" eyes' and
      // the bare quotes break JSON.parse). Extract each field individually
      // rather than re-parsing the whole blob.
      const winnerMatch = jsonStr.match(/"winnerIndex"\s*:\s*(\d+)/);
      const reasoningMatch = jsonStr.match(/"reasoning"\s*:\s*"([\s\S]*?)"\s*,\s*"lockedCharacter/);
      const blockMatch = jsonStr.match(/"lockedCharacterBlock"\s*:\s*"([\s\S]*?)"\s*\}/);

      if (!winnerMatch || !blockMatch) {
        throw new Error(`pick-winner parse failed: ${e.message} | stopReason: ${data.stop_reason} | contentBlockTypes: ${JSON.stringify((data.content||[]).map(c=>c.type))} | preview: ${jsonStr.slice(0, 400)}`);
      }
      parsed = {
        winnerIndex: parseInt(winnerMatch[1]),
        reasoning: reasoningMatch ? reasoningMatch[1].replace(/\\"/g, '"') : '',
        lockedCharacterBlock: blockMatch[1].replace(/\\"/g, '"').replace(/\\n/g, '\n')
      };
    }

    await updateSubmission(submissionId, {
      winnerIndex: parsed.winnerIndex,
      winnerReasoning: parsed.reasoning,
      lockedCharacterBlock: parsed.lockedCharacterBlock,
      status: 'generating'
    });

    return res.status(200).json(parsed);
  } catch (err) {
    await updateSubmission(submissionId, {
      status: 'failed',
      errorMessage: err.message || String(err)
    });
    return res.status(500).json({ error: String(err) });
  }
};
