// Fetches whatever's at form.website and extracts readable text to ground
// brief analysis in actual product copy. Prioritizes substantive content
// (headings, paragraphs, list items) over nav/footer boilerplate.
//
// Real limitation: plain server-side fetch, no JS execution. App Store /
// Play Store listings and JS-rendered SPAs often return nothing useful.
// Degrades gracefully on any failure.

const MAX_CHARS = 3500;

function extractContent(html) {
  // Pull text from high-signal tags first, in priority order, before
  // falling back to stripping all tags. This keeps headings and paragraphs
  // structurally separate from nav boilerplate instead of running them together.
  const highSignal = [];

  // Extract title
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (titleMatch) highSignal.push(titleMatch[1].trim());

  // Extract meta description -- often the single best product summary
  const metaDesc = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+name=["']description["']/i);
  if (metaDesc) highSignal.push(metaDesc[1].trim());

  // Extract og:description
  const ogDesc = html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i)
    || html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+property=["']og:description["']/i);
  if (ogDesc && ogDesc[1] !== metaDesc?.[1]) highSignal.push(ogDesc[1].trim());

  // Extract h1, h2, h3 headings (structural content, not nav)
  const headings = [...html.matchAll(/<h[123][^>]*>([\s\S]*?)<\/h[123]>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 5 && t.length < 200);
  highSignal.push(...headings.slice(0, 8));

  // Extract <p> paragraphs longer than 60 chars (filters out button labels etc)
  const paras = [...html.matchAll(/<p[^>]*>([\s\S]*?)<\/p>/gi)]
    .map(m => m[1].replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(t => t.length > 60);
  highSignal.push(...paras.slice(0, 6));

  const combined = highSignal.join(' | ').replace(/\s+/g, ' ').trim();
  return combined.length > 100 ? combined.slice(0, MAX_CHARS) : null;
}

async function fetchWebsiteContext(url) {
  if (!url) return null;
  const withProtocol = /^https?:\/\//i.test(url) ? url : `https://${url}`;

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 8000);
    const r = await fetch(withProtocol, {
      signal: controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; StudiyoBriefBot/1.0)' }
    });
    clearTimeout(timeout);
    if (!r.ok) return null;

    const html = await r.text();
    return extractContent(html);
  } catch (e) {
    return null;
  }
}

module.exports = { fetchWebsiteContext };
