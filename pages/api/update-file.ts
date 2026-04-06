import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();

  const { name, subfolder, content } = req.body as {
    name?: string;
    subfolder?: string;
    content?: string;
  };

  if (!name || typeof name !== 'string') return res.status(400).json({ error: 'Missing name' });
  if (typeof content !== 'string') return res.status(400).json({ error: 'Missing content' });

  const safeName = path.basename(name);
  const base = subfolder
    ? path.join(SHARED_DIR, path.normalize(subfolder).replace(/^(\.\.[/\\])+/, ''))
    : SHARED_DIR;
  const target = path.join(base, safeName);

  if (!target.startsWith(SHARED_DIR)) return res.status(403).json({ error: 'Forbidden' });
  if (!fs.existsSync(target)) return res.status(404).json({ error: 'File not found' });

  try {
    const stat = fs.statSync(target);
    if (!stat.isFile()) return res.status(400).json({ error: 'Not a file' });

    fs.writeFileSync(target, content, 'utf8');
    return res.status(200).json({ saved: safeName });
  } catch (e) {
    console.error('update-file error', e);
    return res.status(500).json({ error: 'Failed to save file' });
  }
}
