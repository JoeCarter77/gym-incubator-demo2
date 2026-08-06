// api/track.js — Vercel Serverless Function
// POST /api/track
// Records that a prospect opened / engaged with their mirror page.
// Body: { event, first_name, company, url, ts, ua, ref }
//
// Forwards each event to a webhook set in the TRACKING_WEBHOOK_URL env var.
// Point that at a Google Sheet (see TRACKING_SETUP.md), Zapier, Make, or GHL —
// anything that accepts a JSON POST. If the env var is unset the endpoint is a
// silent no-op, so the page never breaks and no event is ever lost to a 500.

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') return res.status(200).end();
  if (req.method !== 'POST') return res.status(405).json({ error: 'Method not allowed' });

  const hook = process.env.TRACKING_WEBHOOK_URL;
  if (!hook) return res.status(200).json({ ok: true, forwarded: false });

  try {
    const b = req.body || {};
    const payload = {
      event:      b.event      || 'page_open',
      first_name: b.first_name || '',
      company:    b.company    || '',
      url:        b.url        || '',
      ts:         b.ts         || new Date().toISOString(),
      ua:         b.ua         || req.headers['user-agent'] || '',
      ref:        b.ref        || req.headers['referer'] || '',
      ip:         (req.headers['x-forwarded-for'] || '').split(',')[0].trim(),
    };

    // Fire the webhook but never let a slow/failed hook hang the request.
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 4000);
    await fetch(hook, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    }).catch(() => {});
    clearTimeout(timeout);

    return res.status(200).json({ ok: true, forwarded: true });
  } catch (err) {
    // Tracking must never surface an error to the client.
    return res.status(200).json({ ok: true, forwarded: false });
  }
}
