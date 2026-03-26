import { NextApiRequest, NextApiResponse } from 'next';
import fs from 'fs';
import path from 'path';
import { SHARED_DIR, ensureSharedDir } from '@/lib/files';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') return res.status(405).end();
  ensureSharedDir();

  const { name, subfolder, content } = req.body as { name?: string; subfolder?: string; content?: string };
  if (!name) return res.status(400).json({ error: 'Missing name' });

  const safeName = path.basename(name);
  const base = subfolder ? path.join(SHARED_DIR, path.normalize(subfolder).replace(/^(\.\.[/\\])+/, '')) : SHARED_DIR;
  const targetDir = base;
  const target = path.join(targetDir, safeName);

  if (!target.startsWith(SHARED_DIR)) return res.status(403).json({ error: 'Forbidden' });
  if (fs.existsSync(target)) return res.status(409).json({ error: 'Already exists' });

  try {
    if (!fs.existsSync(targetDir)) fs.mkdirSync(targetDir, { recursive: true });
    fs.writeFileSync(target, content || '');
    res.status(200).json({ created: safeName });
  } catch (e) {
    console.error('create-file error', e);
    res.status(500).json({ error: 'Failed to create file' });
  }
}
