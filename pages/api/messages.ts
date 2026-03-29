import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR, ensureSharedDir } from '@/lib/files';

ensureSharedDir();

const MSG_FILE = path.join(SHARED_DIR, 'shared_messages.json');

type Message = {
  id: string;
  type: 'text' | 'file' | 'link';
  content: string;
  file?: string;
  preview?: any;
  createdAt: string;
};

function readMessages(): Message[] {
  try {
    if (!fs.existsSync(MSG_FILE)) return [];
    const raw = fs.readFileSync(MSG_FILE, 'utf8');
    return JSON.parse(raw || '[]');
  } catch (e) { return []; }
}

function writeMessages(list: Message[]) {
  fs.writeFileSync(MSG_FILE, JSON.stringify(list, null, 2));
}

async function fetchPreview(url: string) {
  try {
    const resp = await fetch(url, { headers: { 'User-Agent': 'SharedDrop/1.0 (+https://example)' }, redirect: 'follow' });
    if (!resp.ok) return null;
    const text = await resp.text();
    const safeText = (s: string | null) => s ? s.replace(/\s+/g, ' ').trim() : null;
    const titleMatch = text.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const title = safeText(titleMatch ? titleMatch[1].replace(/<[^>]*>/g, '') : null);
    const descMatch = text.match(/<meta[^>]+name=["']description["'][^>]*content=["']([^"']+)["'][^>]*>/i)
                   || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]*name=["']description["'][^>]*>/i);
    const description = safeText(descMatch ? descMatch[1] : null);
    const ogImage = text.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["'][^>]*>/i)
                 || text.match(/<meta[^>]+content=["']([^"']+)["'][^>]*property=["']og:image["'][^>]*>/i);
    const image = ogImage ? ogImage[1] : null;
    return { url, title, description, image };
  } catch (e) { return null; }
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'GET') {
    const msgs = readMessages();
    return res.status(200).json({ messages: msgs });
  }

  if (req.method === 'POST') {
    const body = req.body as any || {};
    const type = body.type || 'text';
    const content = body.content || '';
    const file = body.file;

    const msgs = readMessages();
    const msg: Message = {
      id: String(Date.now()) + Math.random().toString(36).slice(2,8),
      type: type === 'file' ? 'file' : (body.preview ? 'link' : (type === 'link' ? 'link' : 'text')),
      content: content,
      file: file,
      preview: body.preview || null,
      createdAt: new Date().toISOString(),
    };

    // If text contains an http(s) URL and no preview provided, try to fetch preview
    if (msg.type === 'text' && !msg.preview) {
      const m = content.match(/https?:\/\/[\w\-./?=&%#]+/i);
      if (m) {
        const url = m[0];
        const p = await fetchPreview(url);
        if (p) { msg.preview = p; msg.type = 'link'; }
      }
    }

    msgs.push(msg);
    try { writeMessages(msgs); } catch (e) { return res.status(500).json({ error: 'Failed to save' }); }
    return res.status(200).json({ message: msg });
  }

  if (req.method === 'PUT') {
    const body = req.body as any || {};
    const id = body.id;
    const content = body.content;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const msgs = readMessages();
    const idx = msgs.findIndex(m => m.id === id);
    if (idx === -1) return res.status(404).json({ error: 'Not found' });
    msgs[idx].content = typeof content === 'string' ? content : msgs[idx].content;
    try { writeMessages(msgs); } catch (e) { return res.status(500).json({ error: 'Failed to save' }); }
    return res.status(200).json({ message: msgs[idx] });
  }

  if (req.method === 'DELETE') {
    const body = req.body as any || {};
    const id = body.id;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const msgs = readMessages();
    const filtered = msgs.filter(m => m.id !== id);
    try { writeMessages(filtered); } catch (e) { return res.status(500).json({ error: 'Failed to save' }); }
    return res.status(200).json({ success: true });
  }

  res.setHeader('Allow', 'GET,POST,PUT,DELETE');
  res.status(405).end();
}
