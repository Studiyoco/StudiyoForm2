// Fetches whatever's at form.website and extracts readable text, so
// brief analysis can be grounded in actual product copy instead of
// reasoning purely from the chip selections and one-line description.
//
// Real limitation, not hidden: this is a plain server-side fetch, no
// JavaScript execution. Marketing sites generally work. App Store and
// Play Store listings, and any JS-rendered SPA, often return close to
// nothing useful this way, since their real content loads client-side.
// Degrades gracefully on any failure -- returns null, brief analysis
// proceeds without it, same pattern as fetchStyleReference.

const MAX_CHARS = 2000; // capped deliberately -- today already had one
// truncation incident from letting prompt input balloon uncontrolled.

function stripHtml(html) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
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
    const text = stripHtml(html).slice(0, MAX_CHARS);
    return text.length > 100 ? text : null; // too short to be useful content
  } catch (e) {
    return null;
  }
}

module.exports = { fetchWebsiteContext };
