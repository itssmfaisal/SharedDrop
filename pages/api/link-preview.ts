import { NextApiRequest, NextApiResponse } from 'next';

function safeText(s: string | null) {
  if (!s) return null;
  return s.replace(/\s+/g, ' ').trim();
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  const url = Array.isArray(req.query.url) ? req.query.url[0] : req.query.url;
  if (!url) return res.status(400).json({ error: 'Missing url' });

  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'SharedDrop/1.0 (+https://example)' }, redirect: 'follow' });
    if (!resp.ok) return res.status(500).json({ error: 'Fetch failed' });
    const text = await resp.text();

    // Quick and dirty extraction of meta tags
    const meta = {} as any;
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    meta.title = safeText(titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : null);
    const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
                   || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    meta.description = safeText(descMatch ? descMatch[1] : null);

    // OpenGraph image
    const ogImage = text.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
                 || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
    meta.image = ogImage ? ogImage[1] : null;

    return res.status(200).json({ url, ...meta });
  } catch (e) {
    return res.status(500).json({ error: 'Failed to fetch' });
  }
}
